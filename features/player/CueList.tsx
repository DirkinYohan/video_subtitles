"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/I18nProvider";
import { formatClock } from "@/lib/cues";
import type { Cue } from "@/types/domain";

/**
 * Lista de subtítulos del idioma elegido.
 *
 * Vive fuera del reproductor para que el vídeo, el transporte y la pista de
 * tiempo formen una sola pieza, y la lista quede debajo sin romper ese bloque.
 * La frase activa sigue a la reproducción desplazando SÓLO la lista (nunca la
 * página): quien lee no pierde su sitio en la pantalla.
 */
export function CueList({
  cues,
  activeIndex,
  selectedIndex,
  onSelect,
  onSeek,
  showHeader = true,
  heightClass = "max-h-80",
}: {
  cues: Cue[];
  activeIndex: number | null;
  selectedIndex: number | null;
  onSelect: (cue: Cue) => void;
  onSeek: (ms: number) => void;
  /** Sin cabecera cuando ya la pone el contenedor (p. ej. una pestaña). */
  showHeader?: boolean;
  /** Alto máximo de la lista (clase de Tailwind). */
  heightClass?: string;
}) {
  const { t } = useI18n();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || activeIndex === null) return;
    const item = list.querySelector<HTMLElement>("[aria-current=true]");
    if (!item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - list.clientHeight / 3), behavior: "smooth" });
    }
  }, [activeIndex]);

  if (cues.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
      {showHeader && (
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{t("player.cueList")}</h2>
          <span className="tabular rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
            {cues.length}
          </span>
        </header>
      )}
      <ol ref={listRef} className={`relative overflow-auto p-1.5 ${heightClass}`}>
        {cues.map((item) => {
          const isActive = activeIndex === item.index;
          const isSelected = selectedIndex === item.index;
          return (
            <li key={`${item.index}-${item.start_ms}`}>
              <button
                type="button"
                aria-current={isActive ? "true" : undefined}
                className={`relative flex w-full gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
                  isActive
                    ? "bg-accent-soft text-ink"
                    : isSelected
                      ? "bg-surface-2 text-ink"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
                onClick={() => {
                  onSelect(item);
                  onSeek(item.start_ms);
                }}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent transition-opacity duration-200 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
                <span
                  className={`tabular shrink-0 pt-px text-xs ${isActive ? "font-semibold text-accent-ink" : "text-subtle"}`}
                >
                  {formatClock(item.start_ms)}
                </span>
                <span className="min-w-0 whitespace-pre-line leading-relaxed">{item.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
