"use client";

import { useEffect, useRef, useState } from "react";
import { addRange, isNewEvent, type TimeRange } from "@/lib/subtitleSync";
import { fetchWsTicket, wsUrl, wsUrlWithTicket } from "@/lib/ws";

export type LiveStatus = "off" | "connecting" | "live" | "complete" | "busy" | "error";

export type LiveCueBatch = { start_ms: number; end_ms: number; text: string }[];

const MAX_RETRY_MS = 8000;
/** Reintentos seguidos sin conseguir conexión antes de rendirse y avisar. */
const MAX_ATTEMPTS = 8;
/** Cada cuánto se recuerda la posición al servidor mientras se reproduce. */
const POSITION_EVERY_MS = 1000;

/**
 * Subtítulos en vivo generados por el SERVIDOR desde el archivo de vídeo.
 *
 * Antes se capturaba el audio del <video> con Web Audio y se enviaba por el
 * socket: el subtítulo sólo podía existir después de oírse la frase (llegaba
 * siempre tarde) y el AudioWorklet no devolvía el sonido, así que al activar el
 * modo en vivo el vídeo se quedaba mudo. Ahora el navegador no toca el audio:
 * sólo informa de la posición y del idioma, y el servidor transcribe POR
 * DELANTE del cabezal. Los cues llegan con sus tiempos del vídeo original y se
 * muestran con el reloj del reproductor como cualquier pista.
 */
export function useLiveTrack({
  projectId,
  video,
  language,
  enabled,
  onCues,
  onSourceLanguage,
}: {
  projectId: string;
  video: HTMLVideoElement | null;
  language: string;
  enabled: boolean;
  onCues: (language: string, cues: LiveCueBatch) => void;
  onSourceLanguage?: (language: string) => void;
}) {
  const [status, setStatus] = useState<LiveStatus>("off");
  const [coverage, setCoverage] = useState<Record<string, TimeRange[]>>({});
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  // Último evento aplicado: lo ya incluido en la instantánea o repetido tras
  // una reconexión no se vuelve a aplicar.
  const lastSeq = useRef(-1);
  const firstCueLogged = useRef(false);
  const videoRef = useRef(video);
  const languageRef = useRef(language);
  const handlers = useRef({ onCues, onSourceLanguage });
  useEffect(() => {
    handlers.current = { onCues, onSourceLanguage };
  }, [onCues, onSourceLanguage]);

  const sendPosition = useRef(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const media = videoRef.current;
    socket.send(
      JSON.stringify({
        type: "position",
        time_ms: Math.round((media?.currentTime ?? 0) * 1000),
        language: languageRef.current,
      }),
    );
  });

  // Idioma: se avisa al momento, sin reconectar.
  useEffect(() => {
    languageRef.current = language;
    sendPosition.current();
  }, [language]);

  // Posición: en cada cambio del reproductor y, reproduciendo, cada segundo.
  useEffect(() => {
    videoRef.current = video;
    if (!video || !enabled) return;
    const send = () => sendPosition.current();
    const events = ["play", "seeking", "seeked", "pause", "loadedmetadata"] as const;
    for (const name of events) video.addEventListener(name, send);
    const timer = window.setInterval(() => {
      if (!video.paused) send();
    }, POSITION_EVERY_MS);
    send();
    return () => {
      for (const name of events) video.removeEventListener(name, send);
      window.clearInterval(timer);
    };
  }, [video, enabled]);

  // Conexión con reintentos.
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let stopped = false;
    let retry = 1000;
    let attempts = 0;
    let timer = 0;
    let socket: WebSocket | null = null;

    const scheduleRetry = () => {
      if (disposed || stopped) return;
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) {
        // Sin reintentos infinitos: se informa y se deja de intentar.
        stopped = true;
        setStatus("error");
        setError("No se pudo conectar con el servidor de subtítulos.");
        console.error(`[LIVE] sin conexión tras ${MAX_ATTEMPTS} intentos`);
        return;
      }
      setStatus("connecting");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void connect(), retry);
      retry = Math.min(retry * 2, MAX_RETRY_MS);
    };

    const connect = async () => {
      if (disposed || stopped) return;
      setStatus("connecting");
      const ticket = await fetchWsTicket();
      if (disposed) return;
      if (ticket === "unauthorized") {
        stopped = true;
        setError("No autenticado");
        setStatus("error");
        return;
      }
      if (ticket === null) {
        scheduleRetry();
        return;
      }
      const path = `/api/videos/${projectId}/live`;
      console.debug("[LIVE] connecting…", wsUrl(path));
      socket = new WebSocket(wsUrlWithTicket(path, ticket));
      socketRef.current = socket;
      socket.onopen = () => {
        if (disposed) return;
        retry = 1000;
        sendPosition.current();
      };
      socket.onmessage = (message) => {
        if (disposed) return;
        let data: {
          type?: string;
          seq?: number;
          language?: string;
          cues?: LiveCueBatch;
          tracks?: Record<string, LiveCueBatch>;
          covered?: Record<string, TimeRange[]> | TimeRange[];
          range?: TimeRange;
          failed?: string[];
          complete?: boolean;
          source_language?: string;
          error?: string;
          message?: string;
          code?: string;
        };
        try {
          data = JSON.parse(String(message.data));
        } catch {
          return;
        }
        if (data.type === "snapshot") {
          attempts = 0;
          retry = 1000;
          // Todo lo generado hasta ahora, idempotente: tras reconectar no se
          // pierde ni se duplica nada (los cues se fusionan por intervalo).
          lastSeq.current = Number(data.seq ?? 0);
          for (const [lang, cues] of Object.entries(data.tracks ?? {})) {
            if (cues.length) handlers.current.onCues(lang, cues);
          }
          setCoverage((data.covered ?? {}) as Record<string, TimeRange[]>);
          setFailed(data.failed ?? []);
          if (data.source_language) handlers.current.onSourceLanguage?.(data.source_language);
          setStatus(data.complete ? "complete" : "live");
          setError("");
          console.debug(
            `[LIVE] instantánea seq=${lastSeq.current} · idiomas=[${Object.keys(data.tracks ?? {}).join(", ")}]`,
          );
          sendPosition.current();
          return;
        }
        if (!isNewEvent(lastSeq.current, data.seq)) return;
        if (typeof data.seq === "number") lastSeq.current = data.seq;
        if (data.type === "completed") {
          setStatus("complete");
          console.debug("[LIVE] procesamiento completado");
        } else if (data.type === "cues" && data.language) {
          const lang = data.language;
          if (data.cues?.length) {
            handlers.current.onCues(lang, data.cues);
            if (!firstCueLogged.current) {
              firstCueLogged.current = true;
              console.debug(
                `[LIVE] primer segmento recibido (${lang}) a los ${Math.round(performance.now())} ms de cargar la página`,
              );
            }
          }
          if (data.range) {
            const range = data.range;
            setCoverage((current) => ({ ...current, [lang]: addRange(current[lang] ?? [], range) }));
          }
        } else if (data.type === "source_language" && data.language) {
          handlers.current.onSourceLanguage?.(data.language);
        } else if (data.type === "translation_failed" && data.language) {
          const lang = data.language;
          setFailed((current) => (current.includes(lang) ? current : [...current, lang]));
          setError(data.error || "");
        } else if (data.type === "busy") {
          // «Producir» está en marcha: sus eventos alimentan el reproductor.
          stopped = true;
          setStatus("busy");
        } else if (data.type === "error") {
          if (data.code === "unauthorized" || data.code === "not_found") stopped = true;
          setError(data.message || "live");
          setStatus("error");
        }
      };
      socket.onerror = () => {
        if (!disposed) console.warn("[LIVE] error de conexión; se reintentará");
      };
      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed || stopped) return;
        console.warn(`[LIVE] conexión cerrada (código ${event.code}); reintento en ${retry} ms`);
        scheduleRetry();
      };
    };

    void connect();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      const current = socket;
      socketRef.current = null;
      if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
        current.onclose = null;
        current.close();
      }
    };
  }, [enabled, projectId]);

  return {
    status: enabled ? status : ("off" as const),
    coverage: enabled ? coverage : NO_COVERAGE,
    failed: enabled ? failed : NO_LANGUAGES,
    error: enabled ? error : "",
  };
}

const NO_COVERAGE: Record<string, TimeRange[]> = {};
const NO_LANGUAGES: string[] = [];
