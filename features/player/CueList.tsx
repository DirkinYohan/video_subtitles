"use client";

import { useI18n } from "@/components/I18nProvider";
import { formatClock } from "@/lib/cues";
import type { Cue } from "@/types/domain";

/**
 * Lista de subtítulos del idioma elegido.
 *
 * Vive fuera del reproductor para que el vídeo, el transporte y la pista de
 * tiempo formen una sola pieza, y la lista quede debajo sin romper ese bloque.
 */
export function CueList({
  cues,
  activeIndex,
  selectedIndex,
  onSelect,
  onSeek,
}: {
  cues: Cue[];
  activeIndex: number | null;
  selectedIndex: number | null;
  onSelect: (cue: Cue) => void;
  onSeek: (ms: number) => void;
}) {
  const { t } = useI18n();

  if (cues.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">{t("player.cueList")}</p>
      <ol className="grid max-h-72 gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
        {cues.map((item) => {
          const isActive = activeIndex === item.index;
          const isSelected = selectedIndex === item.index;
          return (
            <li key={`${item.index}-${item.start_ms}`}>
              <button
                type="button"
                aria-current={isActive ? "true" : undefined}
                className={`flex w-full gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? "border-accent bg-accent-soft text-ink"
                    : isActive
                      ? "border-accent/40 bg-surface text-ink"
                      : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
                }`}
                onClick={() => {
                  onSelect(item);
                  onSeek(item.start_ms);
                }}
              >
                <span className="tabular shrink-0 pt-0.5 text-[0.6875rem] text-subtle">
                  {formatClock(item.start_ms)}
                </span>
                <span className="min-w-0 whitespace-pre-line leading-snug">{item.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
