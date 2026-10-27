/**
 * Sincronización de subtítulos con el reloj del reproductor.
 *
 * Contrato de tiempos: todo va en milisegundos ENTEROS sobre la línea temporal
 * del vídeo original. Un cue está activo en `t` cuando `start_ms <= t < end_ms`.
 *
 * La fuente de verdad es `media.currentTime`, nunca un temporizador propio ni
 * el progreso del procesamiento:
 * * reproduciendo, se lee en cada fotograma (`requestAnimationFrame`), así que
 *   un cue aparece y desaparece en su instante y no hasta 250 ms tarde, que es
 *   la cadencia de `timeupdate`;
 * * `seeking`/`seeked` recalculan en el acto para la nueva posición; lo que se
 *   mostraba antes del salto no sobrevive a él;
 * * `timeupdate` sigue escuchándose como respaldo (pestañas en segundo plano,
 *   donde el navegador congela `requestAnimationFrame`).
 *
 * Sólo se notifica cuando cambia el cue visible: el resto de la página no se
 * vuelve a pintar a 60 fps.
 *
 * El módulo no depende de React ni del DOM real: las pruebas lo ejercitan con
 * un reproductor simulado y un planificador manual.
 */

import type { Cue } from "@/types/domain";

/** Lo mínimo que se necesita de un `HTMLMediaElement`. */
export type SyncMedia = {
  currentTime: number;
  paused: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export type FrameScheduler = {
  request(callback: () => void): number;
  cancel(handle: number): void;
};

export type TimedText = Pick<Cue, "start_ms" | "end_ms" | "text">;

export type SyncSnapshot = {
  /** Cue de la pista elegida activo en el instante actual. */
  cue: Cue | null;
  /** Instante (ms) con el que se calculó la instantánea. */
  timeMs: number;
};

/**
 * Índice del cue activo en `t`, o -1. Búsqueda binaria: la pista está ordenada
 * por inicio (`normalizeCues`) y sin solapes, así que el candidato es el último
 * cue con `start_ms <= t`.
 */
export function findCueIndex(cues: readonly TimedText[], timeMs: number): number {
  let low = 0;
  let high = cues.length - 1;
  let candidate = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (cues[middle]!.start_ms <= timeMs) {
      candidate = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (candidate < 0) return -1;
  // Tolerancia a pistas editadas con solapes: si el candidato ya terminó se
  // mira hacia atrás mientras algún cue anterior pudiera seguir abierto.
  for (let index = candidate; index >= 0 && index >= candidate - 2; index -= 1) {
    const cue = cues[index]!;
    if (cue.start_ms <= timeMs && timeMs < cue.end_ms) return index;
  }
  return -1;
}

const browserScheduler: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

export class SubtitleSync {
  private media: SyncMedia | null = null;
  private cues: readonly Cue[] = [];
  private lastIndex = -1;
  private frame = 0;
  private listeners = new Set<() => void>();
  private snapshot: SyncSnapshot = { cue: null, timeMs: 0 };

  constructor(private readonly scheduler: FrameScheduler = browserScheduler) {}

  getSnapshot = (): SyncSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Engancha (o desengancha, con `null`) el reproductor. */
  attach(media: SyncMedia | null): void {
    if (media === this.media) return;
    this.detach();
    this.media = media;
    if (!media) return;
    media.addEventListener("play", this.onPlay);
    media.addEventListener("playing", this.onPlay);
    media.addEventListener("pause", this.onPause);
    media.addEventListener("ended", this.onPause);
    media.addEventListener("seeking", this.onSeek);
    media.addEventListener("seeked", this.onSeeked);
    media.addEventListener("timeupdate", this.onTimeUpdate);
    media.addEventListener("loadedmetadata", this.onTimeUpdate);
    this.update();
    if (!media.paused) this.loop();
  }

  detach(): void {
    const media = this.media;
    this.stop();
    if (!media) return;
    media.removeEventListener("play", this.onPlay);
    media.removeEventListener("playing", this.onPlay);
    media.removeEventListener("pause", this.onPause);
    media.removeEventListener("ended", this.onPause);
    media.removeEventListener("seeking", this.onSeek);
    media.removeEventListener("seeked", this.onSeeked);
    media.removeEventListener("timeupdate", this.onTimeUpdate);
    media.removeEventListener("loadedmetadata", this.onTimeUpdate);
    this.media = null;
  }

  /**
   * Pista del idioma elegido (ordenada). Cambiar de idioma o recibir cues
   * nuevos recalcula en el acto para la posición ACTUAL del reproductor.
   */
  setCues(cues: readonly Cue[]): void {
    if (cues === this.cues) return;
    this.cues = cues;
    this.lastIndex = -1;
    this.update();
  }

  /** Recalcula con el reloj del reproductor. Público para pruebas y efectos. */
  update(): void {
    const media = this.media;
    const timeMs = media ? Math.max(0, Math.round(media.currentTime * 1000)) : 0;
    const cue = this.lookup(timeMs);
    const previous = this.snapshot;
    if (previous.cue === cue) {
      // El instante no se publica por sí solo: sólo importa el cue visible.
      this.snapshot = { ...previous, timeMs };
      return;
    }
    this.snapshot = { cue, timeMs };
    for (const listener of this.listeners) listener();
  }

  private lookup(timeMs: number): Cue | null {
    const cues = this.cues;
    // Reproducción continua: casi siempre es el mismo cue o el siguiente.
    const last = this.lastIndex;
    for (const index of [last, last + 1]) {
      const cue = index >= 0 ? cues[index] : undefined;
      if (cue && cue.start_ms <= timeMs && timeMs < cue.end_ms) {
        this.lastIndex = index;
        return cue;
      }
    }
    const next = cues[last + 1];
    const current = cues[last];
    if (current && next && current.end_ms <= timeMs && timeMs < next.start_ms) return null;
    const index = findCueIndex(cues, timeMs);
    this.lastIndex = index;
    return index >= 0 ? cues[index]! : null;
  }

  private loop = (): void => {
    if (this.frame) return;
    const step = () => {
      this.frame = 0;
      this.update();
      if (this.media && !this.media.paused) this.frame = this.scheduler.request(step);
    };
    this.frame = this.scheduler.request(step);
  };

  private stop(): void {
    if (!this.frame) return;
    this.scheduler.cancel(this.frame);
    this.frame = 0;
  }

  private onPlay = (): void => {
    this.update();
    this.loop();
  };

  private onPause = (): void => {
    this.stop();
    // Pausado, el subtítulo queda fijado al fotograma detenido.
    this.update();
  };

  private onSeek = (): void => {
    // Empieza un salto: `currentTime` ya es la posición pedida y lo que se
    // mostraba para la posición anterior no sobrevive.
    this.lastIndex = -1;
    this.update();
  };

  private onSeeked = (): void => {
    // Posición efectiva tras el salto (puede diferir de la pedida).
    this.lastIndex = -1;
    this.update();
    if (this.media && !this.media.paused) this.loop();
  };

  private onTimeUpdate = (): void => {
    this.update();
  };
}

// --- Tramos procesados ----------------------------------------------------

/** Intervalo [inicio, fin) en ms del vídeo. */
export type TimeRange = [number, number];

/** Añade un intervalo a una lista ordenada, fusionando los que se tocan. */
export function addRange(ranges: readonly TimeRange[], range: TimeRange): TimeRange[] {
  let [start, end] = range;
  if (!(end > start)) return [...ranges];
  const out: TimeRange[] = [];
  for (const [a, b] of ranges) {
    if (b < start || a > end) out.push([a, b]);
    else {
      start = Math.min(a, start);
      end = Math.max(b, end);
    }
  }
  out.push([start, end]);
  return out.sort((x, y) => x[0] - y[0]);
}

export function inRanges(ranges: readonly TimeRange[] | undefined, timeMs: number): boolean {
  return Boolean(ranges?.some(([a, b]) => a <= timeMs && timeMs < b));
}

// --- Estado de la pista elegida -----------------------------------------

export type TrackState =
  /** Hay subtítulos procesados para el instante actual. */
  | "ready"
  /** Se está generando y este tramo aún no está listo en este idioma. */
  | "processing"
  /** No hay pista en este idioma y no se está generando. */
  | "missing"
  /** La traducción a este idioma falló. */
  | "failed";

/**
 * Estado de la pista elegida en el instante actual. No confunde el progreso
 * del procesamiento con la posición del vídeo: `covered` dice si ESTE instante
 * ya está procesado EN ESTE IDIOMA.
 */
export function trackState({
  cueCount,
  covered,
  generating,
  failed,
}: {
  cueCount: number;
  covered: boolean;
  generating: boolean;
  failed: boolean;
}): TrackState {
  if (failed && !covered) return "failed";
  if (generating) return covered ? "ready" : "processing";
  return cueCount > 0 || covered ? "ready" : "missing";
}

/** Fusiona coberturas por idioma sin retroceder nunca (eventos repetidos o tardíos). */
export function mergeCoverage(
  current: Record<string, number>,
  incoming: Record<string, number>,
): Record<string, number> {
  let next = current;
  for (const [language, value] of Object.entries(incoming)) {
    const ms = Number(value);
    if (!language || !Number.isFinite(ms) || ms <= (next[language] ?? 0)) continue;
    if (next === current) next = { ...current };
    next[language] = ms;
  }
  return next;
}

// --- Generación progresiva ---------------------------------------------------

/**
 * ¿Debe el vídeo esperar a sus subtítulos? Sólo si se están generando en vivo,
 * los subtítulos están visibles, el usuario no ha agotado ya la espera máxima
 * y el instante actual todavía no está procesado en el idioma elegido.
 */
export function needsSubtitleWait({
  enabled,
  captionsOn,
  forced,
  covered,
}: {
  enabled: boolean;
  captionsOn: boolean;
  forced: boolean;
  covered: boolean;
}): boolean {
  return enabled && captionsOn && !forced && !covered;
}

/**
 * ¿Es nuevo este evento? Los eventos del servidor van numerados; lo que ya
 * estaba en la instantánea o llega repetido tras reconectar se descarta.
 */
export function isNewEvent(lastSeq: number, seq: number | undefined): boolean {
  return typeof seq !== "number" || seq > lastSeq;
}
