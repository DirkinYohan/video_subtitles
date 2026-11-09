import type { Cue } from "@/types/domain";

export function activeCue(cues: Cue[], timeMs: number): Cue | null {
  for (const cue of cues) {
    if (cue.start_ms <= timeMs && timeMs < cue.end_ms) return cue;
  }
  return null;
}

export function cueAt(cues: Cue[], index: number): Cue | null {
  return cues.find((cue) => cue.index === index) ?? null;
}

export function normalizeCues(cues: Cue[], language?: string): Cue[] {
  return [...cues]
    .sort((a, b) => a.start_ms - b.start_ms || a.end_ms - b.end_ms)
    .map((cue, position) => ({
      ...cue,
      index: position + 1,
      language: language ?? cue.language,
    }));
}

export function repairCues(cues: Cue[], minDurationMs = 300): Cue[] {
  const sorted = normalizeCues(cues);
  return sorted.map((cue, position) => {
    const next = sorted[position + 1];
    const start = Math.max(0, cue.start_ms);
    let end = Math.max(start + minDurationMs, cue.end_ms);
    if (next && end > next.start_ms) end = Math.max(start + 1, next.start_ms - 1);
    return { ...cue, start_ms: start, end_ms: end };
  });
}

export function cuesDuration(cues: Cue[]): number {
  return cues.reduce((max, cue) => Math.max(max, cue.end_ms), 0);
}

export function rulerTicks(durationMs: number, targetCount = 10): number[] {
  if (durationMs <= 0) return [0];
  const raw = durationMs / Math.max(1, targetCount);
  const steps = [
    250, 500, 1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000,
    120_000, 300_000, 600_000, 900_000, 1_800_000, 3_600_000,
  ];
  const step = steps.find((value) => value >= raw) ?? steps[steps.length - 1] ?? 1000;
  const ticks: number[] = [];
  for (let at = 0; at <= durationMs; at += step) ticks.push(at);
  return ticks;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const body = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${body}` : body;
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function parseTimecode(value: string): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.round(Number(raw) * 1000);
  const parts = raw.split(":").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop());
  const hours = parts.length ? Number(parts[0]) : 0;
  if ([seconds, minutes, hours].some((n) => !Number.isFinite(n) || n < 0)) return null;
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

function cueKey(cue: Pick<Cue, "start_ms" | "end_ms">): string {
  return `${Math.round(cue.start_ms)}:${Math.round(cue.end_ms)}`;
}

export function appendCues(current: Cue[], incoming: Cue[], language: string): Cue[] {
  const seen = new Set(current.map(cueKey));
  const fresh = incoming.filter((cue) => {
    const key = cueKey(cue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (fresh.length === 0) return current;
  return normalizeCues([...current, ...fresh], language);
}

export function mergeServerTrack(server: Cue[], local: Cue[], language: string): Cue[] {
  const serverEnd = cuesDuration(server);
  const newer = local.filter((cue) => cue.start_ms >= serverEnd);
  return appendCues(normalizeCues(server, language), newer, language);
}

/* ------------------------------------------------------------------ */
/* Presentación de la transcripción                                    */
/* ------------------------------------------------------------------ */

/** Texto listo para mostrar: sin espacios antes de la puntuación ni dobles espacios. */
export function displayCueText(text: string): string {
  return String(text ?? "")
    .replace(/[ \t]+([.,!?;:…])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Un segmento vacío o sólo con puntuación no aporta nada a la lista. */
export function isBlankCue(cue: Pick<Cue, "text">): boolean {
  return displayCueText(cue.text).replace(/[\s.,!?;:…\-–—"'«»()¿¡]/g, "").length === 0;
}

const SENTENCE_END = /[.!?…]["'»)\]]*$/;

export type DisplayCue = Cue & { display: string; continues: boolean };

/**
 * Quita los segmentos vacíos y marca los que continúan la frase anterior
 * (la anterior no cierra con puntuación y el hueco es corto), para que la
 * lista los muestre unidos en lugar de como frases cortadas.
 */
export function transcriptCues(cues: Cue[], maxGapMs = 1200): DisplayCue[] {
  const out: DisplayCue[] = [];
  for (const cue of cues) {
    if (isBlankCue(cue)) continue;
    const display = displayCueText(cue.text);
    const previous = out[out.length - 1];
    const continues =
      previous !== undefined &&
      !SENTENCE_END.test(previous.display) &&
      cue.start_ms - previous.end_ms <= maxGapMs;
    out.push({ ...cue, display, continues });
  }
  return out;
}

/** Segmento de otra pista que más se solapa en el tiempo con `cue`. */
export function overlappingCue(cue: Pick<Cue, "start_ms" | "end_ms">, others: Cue[]): Cue | null {
  let best: Cue | null = null;
  let bestOverlap = 0;
  for (const other of others) {
    if (other.end_ms <= cue.start_ms) continue;
    if (other.start_ms >= cue.end_ms) break;
    const overlap = Math.min(cue.end_ms, other.end_ms) - Math.max(cue.start_ms, other.start_ms);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = other;
    }
  }
  return best;
}
