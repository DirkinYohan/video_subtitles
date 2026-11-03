import type { Cue } from "@/types/domain";

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
  cue: Cue | null;
  timeMs: number;
};

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

  setCues(cues: readonly Cue[]): void {
    if (cues === this.cues) return;
    this.cues = cues;
    this.lastIndex = -1;
    this.update();
  }

  update(): void {
    const media = this.media;
    const timeMs = media ? Math.max(0, Math.round(media.currentTime * 1000)) : 0;
    const cue = this.lookup(timeMs);
    const previous = this.snapshot;
    if (previous.cue === cue) {
      this.snapshot = { ...previous, timeMs };
      return;
    }
    this.snapshot = { cue, timeMs };
    for (const listener of this.listeners) listener();
  }

  private lookup(timeMs: number): Cue | null {
    const cues = this.cues;
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
    this.update();
  };

  private onSeek = (): void => {
    this.lastIndex = -1;
    this.update();
  };

  private onSeeked = (): void => {
    this.lastIndex = -1;
    this.update();
    if (this.media && !this.media.paused) this.loop();
  };

  private onTimeUpdate = (): void => {
    this.update();
  };
}

export type TimeRange = [number, number];

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

export type TrackState =
  | "ready"
  | "processing"
  | "missing"
  | "failed";

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

export function isNewEvent(lastSeq: number, seq: number | undefined): boolean {
  return typeof seq !== "number" || seq > lastSeq;
}
