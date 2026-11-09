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

export const CAPTION_CLASS_FULLSCREEN = ["text-xl", "text-3xl", "text-4xl", "text-6xl"] as const;

/* Estilo del subtítulo en el reproductor: fondo y posición. Preferencia local. */
export type CaptionBackground = "solid" | "soft" | "none";
export type CaptionPosition = "bottom" | "top";
export type CaptionStyle = { background: CaptionBackground; position: CaptionPosition };

const STYLE_KEY = "ia_caption_style";
const DEFAULT_STYLE: CaptionStyle = { background: "soft", position: "bottom" };
let cachedRaw: string | null = null;
let cachedStyle: CaptionStyle = DEFAULT_STYLE;

function readCaptionStyle(): CaptionStyle {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STYLE_KEY);
  } catch {
    return DEFAULT_STYLE;
  }
  if (raw === cachedRaw) return cachedStyle;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<CaptionStyle>;
    cachedStyle = {
      background: parsed.background === "solid" || parsed.background === "none" ? parsed.background : "soft",
      position: parsed.position === "top" ? "top" : "bottom",
    };
  } catch {
    cachedStyle = DEFAULT_STYLE;
  }
  return cachedStyle;
}

export function writeCaptionStyle(patch: Partial<CaptionStyle>): void {
  const next = { ...readCaptionStyle(), ...patch };
  try {
    window.localStorage.setItem(STYLE_KEY, JSON.stringify(next));
  } catch {
  }
  window.dispatchEvent(new Event(CAPTION_EVENT));
}

export function useCaptionStyle(): CaptionStyle {
  return useSyncExternalStore(subscribe, readCaptionStyle, () => DEFAULT_STYLE);
}

export const CAPTION_BACKGROUND_CLASS: Record<CaptionBackground, string> = {
  solid: "bg-black/85",
  soft: "bg-black/55 backdrop-blur-sm",
  none: "bg-transparent [text-shadow:0_1px_2px_rgb(0_0_0/0.9),0_0_8px_rgb(0_0_0/0.6)]",
};
