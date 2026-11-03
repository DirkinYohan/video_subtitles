/**
 * Tema claro / oscuro.
 *
 * Sin elección del usuario, manda el sistema (`prefers-color-scheme`). Al
 * elegir, se guarda en una cookie y el servidor pinta `<html data-theme>` desde
 * el primer fotograma: no hay destello del tema equivocado al cargar.
 *
 * Módulo puro (sin `next/headers`): lo importan Server y Client Components.
 */

export const THEME_COOKIE = "ia_theme";
/** Evento de ventana que avisa de un cambio de tema hecho en esta pestaña. */
export const THEME_EVENT = "ia-theme";

export type Theme = "light" | "dark";

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

/** El tema contrario: lo que hace el botón. */
export function nextTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

/** Valor de la cookie: un año, todo el sitio. */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}
