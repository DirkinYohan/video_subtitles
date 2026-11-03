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
