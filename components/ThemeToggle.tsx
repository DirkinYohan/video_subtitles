"use client";

import { useSyncExternalStore, type MouseEvent } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { isTheme, nextTheme, THEME_EVENT, themeCookie, type Theme } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/** Tema que se ve: el elegido o, si no hay, el del sistema. */
function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (isTheme(chosen)) return chosen;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.cookie = themeCookie(theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * Botón de tema claro / oscuro.
 *
 * El cambio se revela en círculo desde el propio botón (View Transitions).
 * Sin soporte del navegador, o con `prefers-reduced-motion`, cambia en el acto.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  // En el servidor no se conoce el tema del sistema: se asume claro y se
  // corrige al hidratar, sin descuadres (sólo cambia el icono).
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as Theme);
  const dark = theme === "dark";
  const label = dark ? t("theme.toLight") : t("theme.toDark");

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const target = nextTheme(currentTheme());
    const root = document.documentElement;
    const rect = event.currentTarget.getBoundingClientRect();
    root.style.setProperty("--theme-x", `${rect.left + rect.width / 2}px`);
    root.style.setProperty("--theme-y", `${rect.top + rect.height / 2}px`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
    if (!reduce && typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => applyTheme(target));
    } else {
      applyTheme(target);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${className}`}
    >
      {/* Los dos iconos se cruzan: uno sale girando, el otro entra. */}
      <Icon
        name="sun"
        className={`absolute h-[1.05rem] w-[1.05rem] transition-[transform,opacity] duration-300 ease-[var(--ease-out-quart)] ${
          dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
        }`}
      />
      <Icon
        name="moon"
        className={`absolute h-4 w-4 transition-[transform,opacity] duration-300 ease-[var(--ease-out-quart)] ${
          dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
      />
    </button>
  );
}
