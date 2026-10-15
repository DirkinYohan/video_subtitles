"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWsTicket, wsUrl, wsUrlWithTicket } from "@/lib/ws";

export type LiveStatus = "off" | "connecting" | "live" | "error";

export type LiveEvent = {
  text: string;
  translations: Record<string, string>;
  provisional: boolean;
  startMs: number;
  endMs: number;
};

const MAX_RETRY_MS = 8000;
const MAX_BUFFERED = 262_144;

type AudioGraph = {
  context: AudioContext;
  node: AudioWorkletNode;
};

// `createMediaElementSource` sólo puede llamarse UNA vez por elemento: el grafo
// se cachea por elemento y se reutiliza al activar/desactivar el modo en vivo.
const graphs = new WeakMap<HTMLMediaElement, AudioGraph>();
const pending = new WeakMap<HTMLMediaElement, Promise<AudioGraph | null>>();

/**
 * Subtitulado en vivo: AudioWorklet -> PCM 16 kHz -> WebSocket.
 *
 * * AudioWorklet en lugar de ScriptProcessorNode (hilo de audio real).
 * * El socket sólo se abre con `enabled`; al desactivar se cierra de verdad.
 * * Backpressure: si el socket acumula bytes se descartan tramas.
 */
export function useLiveSubtitles({
  video,
  sourceLanguage,
  targets,
  enabled,
}: {
  video: HTMLVideoElement | null;
  sourceLanguage: string;
  targets: string[];
  enabled: boolean;
}) {
  const [status, setStatus] = useState<LiveStatus>("off");
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [error, setError] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const enabledRef = useRef(enabled);
  const targetsKey = targets.join(",");

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const send = useCallback((payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  }, []);

  // --- Grafo de audio: SÓLO al activar el modo en vivo ----------------------
  //
  // `createMediaElementSource` enruta el audio del <video> al grafo de Web
  // Audio. Si el AudioContext queda suspendido (lo normal antes de un gesto del
  // usuario) el vídeo se reproduce SIN SONIDO. Por eso el grafo no se crea al
  // montar el reproductor, sino al activar «En vivo», que siempre es un clic.
  useEffect(() => {
    if (!video || !enabled) return;
    let disposed = false;

    const build = async (): Promise<AudioGraph | null> => {
      const cached = graphs.get(video);
      if (cached) return cached;
      const inFlight = pending.get(video);
      if (inFlight) return inFlight;
      const task = (async () => {
        try {
          const AudioCtor = window.AudioContext;
          if (!AudioCtor) throw new Error("AudioContext no disponible");
          const context = new AudioCtor();
          await context.audioWorklet.addModule("/pcm-tap-worklet.js");
          const source = context.createMediaElementSource(video);
          const node = new AudioWorkletNode(context, "pcm-tap", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
          });
          source.connect(node);
          node.connect(context.destination);
          const graph: AudioGraph = { context, node };
          graphs.set(video, graph);
          return graph;
        } catch {
          return null;
        }
      })();
      pending.set(video, task);
      const resolved = await task;
      pending.delete(video);
      return resolved;
    };

    void build().then((graph) => {
      if (!graph || disposed) return;
      graph.node.port.onmessage = (message: MessageEvent<Int16Array>) => {
        if (!enabledRef.current) return;
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        if (video.paused || video.seeking) return;
        if (socket.bufferedAmount > MAX_BUFFERED) return;
        const pcm = message.data;
        if (!pcm || pcm.length === 0) return;
        socket.send(
          JSON.stringify({
            type: "audio",
            pcm_b64: toBase64(pcm),
            time_ms: Math.round(video.currentTime * 1000),
          }),
        );
      };
    });

    const onSeek = () => {
      graphs.get(video)?.node.port.postMessage({ type: "reset" });
      send({ type: "seek", time_ms: Math.round(video.currentTime * 1000) });
      setEvent(null);
    };
    const onPause = () => send({ type: "pause", time_ms: Math.round(video.currentTime * 1000) });
    const onPlay = () => {
      const graph = graphs.get(video);
      if (graph && enabledRef.current && graph.context.state === "suspended") {
        void graph.context.resume().catch(() => undefined);
      }
      send({ type: "resume", time_ms: Math.round(video.currentTime * 1000) });
    };
    video.addEventListener("seeked", onSeek);
    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);

    return () => {
      disposed = true;
      video.removeEventListener("seeked", onSeek);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
      const graph = graphs.get(video);
      if (graph) {
        graph.node.port.onmessage = null;
        void graph.context.suspend().catch(() => undefined);
      }
    };
  }, [video, send, enabled]);

  // --- Suspender/reanudar el audio del grafo según el modo en vivo ---------
  useEffect(() => {
    if (!video) return;
    const graph = graphs.get(video);
    if (!graph) return;
    if (enabled) {
      if (graph.context.state === "suspended") void graph.context.resume().catch(() => undefined);
    } else if (graph.context.state === "running") {
      void graph.context.suspend().catch(() => undefined);
    }
  }, [enabled, video]);

  // --- Conexión WebSocket --------------------------------------------------
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let retry = 1000;
    let timer = 0;
    let socket: WebSocket | null = null;
    // Sesión rechazada: no se reintenta (sólo repetiría "No autenticado").
    let stopped = false;

    const connect = async () => {
      if (disposed || stopped) return;
      setStatus("connecting");
      // El WebSocket pertenece al BACKEND: los rewrites de Next sólo proxean
      // HTTP y cierran el handshake WS. Se autentica con un ticket del mismo
      // origen porque la cookie de sesión no viaja a otro host.
      const ticket = await fetchWsTicket();
      if (disposed) return;
      if (ticket === "unauthorized") {
        stopped = true;
        setError("No autenticado");
        setStatus("error");
        return;
      }
      if (ticket === null) {
        // Backend no disponible: se reintenta sin abrir un socket inútil.
        scheduleRetry();
        return;
      }
      console.debug("[WS] connecting…", wsUrl("/api/realtime"));
      socket = new WebSocket(wsUrlWithTicket("/api/realtime", ticket));
      socketRef.current = socket;
      socket.onopen = () => {
        if (disposed) return;
        retry = 1000;
        setStatus("live");
        setError("");
        console.debug("[WS] connected (realtime)");
        socket?.send(
          JSON.stringify({
            type: "config",
            source_language: sourceLanguage,
            targets: targetsKey ? targetsKey.split(",") : [],
          }),
        );
      };
      socket.onmessage = (message) => {
        if (disposed) return;
        let data: {
          type?: string;
          text?: string;
          message?: string;
          code?: string;
          translations?: Record<string, string>;
          translation_error?: string;
          start_ms?: number;
          end_ms?: number;
        };
        try {
          data = JSON.parse(String(message.data));
        } catch {
          return;
        }
        if (data.type === "partial" || data.type === "final") {
          setEvent({
            text: data.text || "",
            translations: data.translations || {},
            provisional: data.type === "partial",
            startMs: Number(data.start_ms || 0),
            endMs: Number(data.end_ms || 0),
          });
          if (data.translation_error) setError(data.translation_error);
        } else if (data.type === "error") {
          if (data.code === "unauthorized") stopped = true;
          setError(data.message || "realtime");
          setStatus("error");
        } else if (data.type === "cleared") {
          setEvent(null);
        }
      };
      socket.onerror = () => {
        if (!disposed) setStatus("error");
      };
      socket.onclose = () => {
        if (disposed || stopped) return;
        scheduleRetry();
      };
    };

    function scheduleRetry() {
      if (disposed || stopped) return;
      setStatus("connecting");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void connect(), retry);
      retry = Math.min(retry * 2, MAX_RETRY_MS);
    }

    void connect();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      const current = socket;
      socketRef.current = null;
      if (!current) return;
      if (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING) {
        current.close();
      }
    };
  }, [enabled, sourceLanguage, targetsKey]);

  // Con el modo desactivado el estado se DERIVA: no hace falta limpiarlo en un
  // efecto ni provoca renders en cascada. Los eventos se descartan igualmente.
  return {
    status: enabled ? status : "off",
    event: enabled ? event : null,
    error: enabled ? error : "",
  };
}

function toBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}
