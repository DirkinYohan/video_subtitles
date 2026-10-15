/**
 * Clases CSS compartidas por Server y Client Components.
 *
 * Este módulo NO lleva `"use client"` a propósito: exporta sólo cadenas y
 * funciones puras, así que puede importarse desde un Server Component.
 * Los componentes interactivos viven en `components/ui.tsx`.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";

const BUTTON_BASE =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-[0_6px_16px_rgb(79_107_237/0.18)] hover:bg-accent-strong",
  secondary: "border border-line bg-white text-ink hover:border-line-strong hover:bg-paper",
  ghost: "text-muted hover:bg-white hover:text-ink",
  danger: "bg-danger-soft text-danger hover:bg-danger-softer",
  soft: "bg-accent-soft text-accent hover:bg-accent-softer",
};

export function buttonClass(variant: ButtonVariant = "primary"): string {
  return `${BUTTON_BASE} ${BUTTON_STYLES[variant]}`;
}

export const fieldClass =
  "min-h-11 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted/70 hover:border-line-strong focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted";
