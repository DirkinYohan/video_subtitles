"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWsTicket, wsUrl, wsUrlWithTicket } from "@/lib/ws";
import type { Cue, Job } from "@/types/domain";

export type CuePayload = {
  start_ms: number;
  end_ms: number;
  text: string;
};

export type JobEvent =
  | { type: "snapshot"; id: string; status: string; progress: number; stage: string; last_cue_ms: number; stage_history?: Job["stage_history"] }
  | { type: "processing_started"; mode: string }
  | { type: "processing_progress"; status: string; stage: string; progress: number; covered_ms?: number; duration_ms?: number }
  | {
      type: "subtitle_created";
      covered_ms: number;
      duration_ms: number;
      progress: number;
      /** Cues del idioma ORIGINAL de este lote. */
      cues: CuePayload[];
      /** Cues por idioma: { es: [...], en: [...], fr: [...] }. */
      cues_by_language: Record<string, CuePayload[]>;
      /** Nº total de cues persistidos por idioma. */
      totals: Record<string, number>;
      /** Idioma original detectado/seleccionado. */
      source_language: string;
    }
  | { type: "translation_failed"; language: string; error: string }
  | { type: "processing_completed"; progress: number; status?: string; languages: string[]; cues: number; errors?: string[] }
  | { type: "processing_failed"; error: string }
  | { type: "processing_finished"; status: string; progress: number }
  | { type: "error"; message: string; code?: string };

type SubtitleCueEvent = Extract<JobEvent, { type: "subtitle_created" }>;

/**
 * Eventos del job por WebSocket.
 *
 * Los subtítulos llegan por evento (`subtitle_created`) y se entregan al
 * llamante en cuanto se crean. La base de datos sigue siendo la fuente de
 * verdad: `onResync` se invoca al conectar y tras cada reconexión para
 * recuperar lo que se haya podido perder.
 */
export function useJobEvents({
  jobId,
  onSubtitles,
  onResync,
  onFinished,
}: {
  jobId: string | null;
  onSubtitles: (event: SubtitleCueEvent) => void;
  onResync?: () => void;
  onFinished?: (status: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "closed">("idle");
  const [progress, setProgress] = useState(0);
  const [coveredMs, setCoveredMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState("");

  const retryRef = useRef(1000);

  // Los callbacks viven en un ref actualizado en un efecto: así el efecto de
  // conexión NO depende de ellos y no se reconecta en cada render.
  //
  // Sin esto, cada `setCurrentTracks` del padre recreaba las lambdas, el efecto
  // se limpiaba y volvía a conectar, `onResync` se disparaba en bucle y el
  // servidor recibía un torrente de peticiones (que además dejaba al worker sin
  // CPU). El WebSocket no llegaba a establecerse nunca.
  const handlers = useRef({ onSubtitles, onResync, onFinished });
  useEffect(() => {
    handlers.current = { onSubtitles, onResync, onFinished };
  }, [onSubtitles, onResync, onFinished]);

  const connect = useCallback((id: string) => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let timer = 0;
    // Sesión rechazada: reintentar sólo repetiría "No autenticado" en bucle.
    // El estado sigue llegando por el sondeo HTTP de `useJobProgress`.
    let stopped = false;
    const stop = (message: string) => {
      stopped = true;
      setStatus("closed");
      setError(message);
    };

    const open = async () => {
      if (disposed || stopped) return;
      setStatus("connecting");
      // El WebSocket vive en el BACKEND, no en Next: los rewrites de Next sólo
      // proxean HTTP y cierran el handshake WS. La autenticación va en un
      // ticket pedido al mismo origen, no en la cookie (que es de host).
      const ticket = await fetchWsTicket();
      if (disposed) return;
      if (ticket === "unauthorized") {
        stop("No autenticado");
        return;
      }
      if (ticket === null) {
        // Backend no disponible (p. ej. reiniciando): se reintenta más tarde
        // sin abrir un socket que sólo podría fallar.
        scheduleRetry();
        return;
      }
      console.debug("[WS] connecting…", wsUrl(`/api/jobs/${id}/events`));
      socket = new WebSocket(wsUrlWithTicket(`/api/jobs/${id}/events`, ticket));

      socket.onopen = () => {
        if (disposed) return;
        retryRef.current = 1000;
        setStatus("live");
        setError("");
        console.debug("[WS] connected");
        // Recupera el estado real: el bus no guarda historial.
        handlers.current.onResync?.();
      };

      socket.onmessage = (message) => {
        if (disposed) return;
        let event: JobEvent;
        try {
          event = JSON.parse(String(message.data)) as JobEvent;
        } catch {
          return;
        }
        switch (event.type) {
          case "snapshot":
          case "processing_progress":
            setProgress(Number(event.progress ?? 0));
            if ("covered_ms" in event && typeof event.covered_ms === "number") {
              setCoveredMs(event.covered_ms);
            }
            if ("duration_ms" in event && typeof event.duration_ms === "number") {
              setDurationMs(event.duration_ms);
            }
            break;
          case "subtitle_created": {
            setProgress(Number(event.progress ?? 0));
            setCoveredMs(Number(event.covered_ms ?? 0));
            setDurationMs(Number(event.duration_ms ?? 0));
            const languages = Object.keys(event.cues_by_language ?? {});
            console.debug(
              `[WS] subtitle_created · cubierto=${event.covered_ms}ms · idiomas=[${languages.join(", ")}]`,
            );
            handlers.current.onSubtitles(event);
            break;
          }
          case "translation_failed":
            console.warn("[WS] translation_failed", event.language, event.error);
            setError(event.error);
            break;
          case "processing_failed":
            console.error("[WS] processing_failed", event.error);
            setError(event.error);
            handlers.current.onFinished?.("FAILED");
            break;
          case "processing_completed":
          case "processing_finished":
            setProgress(100);
            console.debug(`[WS] ${event.type}`);
            handlers.current.onResync?.();
            handlers.current.onFinished?.(
              event.type === "processing_completed" ? "COMPLETED" : event.status,
            );
            break;
          case "error":
            if (event.code === "unauthorized") {
              console.warn("[WS] sesión no válida: se deja de reconectar", event.message);
              stop(event.message);
              break;
            }
            console.error("[WS] error", event.message);
            setError(event.message);
            break;
          default:
            break;
        }
      };

      socket.onerror = () => {
        if (!disposed) setStatus("connecting");
      };

      socket.onclose = () => {
        if (disposed || stopped) return;
        scheduleRetry();
      };
    };

    // Reconexión con backoff; al volver se resincroniza contra la BD.
    function scheduleRetry() {
      if (disposed || stopped) return;
      setStatus("connecting");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        retryRef.current = Math.min(retryRef.current * 2, 8000);
        void open();
      }, retryRef.current);
    }

    void open();

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      const current = socket;
      if (!current) return;
      current.onclose = null;
      if (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING) {
        current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!jobId) return;
    return connect(jobId);
  }, [jobId, connect]);

  // Sin job el estado se DERIVA: no hace falta limpiarlo dentro de un efecto.
  return {
    status: jobId ? status : ("idle" as const),
    progress: jobId ? progress : 0,
    coveredMs: jobId ? coveredMs : 0,
    durationMs: jobId ? durationMs : 0,
    error: jobId ? error : "",
  };
}

/**
 * Convierte los cues de un evento en cues de dominio.
 *
 * El evento trae TODOS los idiomas del lote (`cues_by_language`), de modo que
 * el reproductor recibe a la vez la pista original y cada traducción. Si el
 * evento es antiguo y sólo trae `cues`, se usa ese idioma como respaldo.
 */
export function cuesFromEvent(
  event: SubtitleCueEvent,
  language: string,
  startIndex: number,
): Cue[] {
  const batch = event.cues_by_language?.[language] ?? (language === event.source_language ? event.cues : []) ?? [];
  return batch.map((cue, offset) => ({
    index: startIndex + offset,
    start_ms: Number(cue.start_ms),
    end_ms: Number(cue.end_ms),
    text: String(cue.text),
    speaker: "",
    language,
    state: "final" as const,
  }));
}
