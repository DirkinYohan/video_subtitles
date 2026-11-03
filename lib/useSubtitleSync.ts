"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { SubtitleSync, type SyncSnapshot } from "@/lib/subtitleSync";
import type { Cue } from "@/types/domain";

const EMPTY: SyncSnapshot = { cue: null, timeMs: 0 };

export function useSubtitleSync(
  video: HTMLVideoElement | null,
  cues: readonly Cue[],
): { snapshot: SyncSnapshot; sync: SubtitleSync } {
  const [sync] = useState(() => new SubtitleSync());

  useEffect(() => {
    sync.attach(video);
    return () => sync.detach();
  }, [sync, video]);

  useEffect(() => {
    sync.setCues(cues);
  }, [sync, cues]);

  const snapshot = useSyncExternalStore(sync.subscribe, sync.getSnapshot, () => EMPTY);
  return { snapshot, sync };
}
