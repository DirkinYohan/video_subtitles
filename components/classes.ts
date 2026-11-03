/**
 * Clases CSS compartidas por Server y Client Components.
 *
 * Este módulo NO lleva `"use client"` a propósito: exporta sólo cadenas y
 * funciones puras, así que puede importarse desde un Server Component.
 * Los componentes interactivos viven en `components/ui.tsx`.
 *
 * Todo color sale de los tokens de `app/globals.css`. Aquí no hay literales.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  // `whitespace-nowrap`: una etiqueta nunca parte en dos líneas.
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold " +
  "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] " +
  // Un único estado deshabilitado para todas las variantes: caja neutra y
  // legible, en vez de un tinte translúcido del color de la acción.
  "disabled:cursor-not-allowed disabled:pointer-events-none " +
  "disabled:!border disabled:!border-line disabled:!bg-surface-2 disabled:!text-subtle disabled:!shadow-none";

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-10 px-4.5 text-sm",
};

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  // Profundidad: luz interior arriba y la sombra del propio acento.
  primary:
    "bg-accent text-on-accent shadow-[var(--shadow-button)] hover:bg-accent-strong hover:brightness-105",
  secondary:
    "border border-line bg-surface text-ink shadow-[var(--shadow-card)] hover:border-line-strong hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger-soft text-danger hover:bg-danger-softer",
  soft: "bg-accent-soft text-accent-ink hover:bg-accent-softer",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_STYLES[variant]}`;
}

/**
 * Campo de formulario.
 *
 * El foco se marca con el mismo halo que el resto de la interfaz, y el borde
 * cambia de color: dos señales para quien no distingue bien los matices.
 */
export const fieldClass =
  "min-h-11 w-full rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink shadow-[var(--shadow-card)] " +
  "placeholder:text-subtle hover:border-line-strong " +
  "focus:border-accent focus:outline-none focus:shadow-[var(--focus-ring)] " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted";

/** Superficie elevada: borde O sombra, nunca ambos. */
export const cardClass = "rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]";

/** Superficie elevada sólo con sombra (para lo que flota sobre el contenido). */
export const floatingClass = "rounded-xl bg-surface shadow-[var(--shadow-float)]";

/** Panel translúcido para la barra de navegación. */
export const glassClass =
  "glass border-b border-line/80 bg-surface/85 backdrop-blur-xl backdrop-saturate-150";

/** Enlace con subrayado que aparece al pasar el cursor. */
export const quietLinkClass =
  "text-ink-2 underline decoration-line-strong decoration-1 underline-offset-4 " +
  "hover:text-ink hover:decoration-ink-2";
