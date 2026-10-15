import { useSyncExternalStore } from "react";

export const CAPTION_KEY = "ia_caption_size";
export const CAPTION_EVENT = "ia-caption-size";

export type CaptionSize = 0 | 1 | 2 | 3;

export function readCaptionSize(): CaptionSize {
  if (typeof window === "undefined") return 1;
  const value = Number(window.localStorage.getItem(CAPTION_KEY));
  if (value === 0 || value === 1 || value === 2 || value === 3) return value;
  return 1;
}

export function writeCaptionSize(size: CaptionSize): void {
  window.localStorage.setItem(CAPTION_KEY, String(size));
  window.dispatchEvent(new Event(CAPTION_EVENT));
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(CAPTION_EVENT, onStoreChange);
  return () => window.removeEventListener(CAPTION_EVENT, onStoreChange);
}

export function useCaptionSize(): CaptionSize {
  return useSyncExternalStore(subscribe, readCaptionSize, () => 1);
}

export const CAPTION_CLASS = ["text-sm", "text-lg", "text-2xl", "text-4xl"] as const;
