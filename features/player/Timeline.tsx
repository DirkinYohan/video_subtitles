"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/ui";
import { formatClock, rulerTicks } from "@/lib/cues";
import type { Cue } from "@/types/domain";

const ZOOM_LEVELS = [1, 2, 4, 8, 16] as const;

/**
 * Línea de tiempo del estudio.
 *
 * Se dibuja dentro de la misma superficie que el reproductor (`bare`), de modo
 * que vídeo, transporte y pista se leen como una sola pieza: la regla arriba,
 * la tira de miniaturas encima de los subtítulos y el cursor de reproducción
 * atravesando ambos.
 */
export function Timeline({
  cues,
  durationMs,
  timeMs,
  activeIndex,
  selectedIndex,
  coveredMs = 0,
  labels,
  onSeek,
  onSelect,
  bare = false,
  filmstripSrc,
}: {
  cues: Cue[];
  durationMs: number;
  timeMs: number;
  activeIndex: number | null;
  selectedIndex: number | null;
  /** Hasta qué ms hay subtítulos procesados (zona procesada de la pista). */
  coveredMs?: number;
  labels: { title: string; zoomIn: string; zoomOut: string; empty: string; pending?: string };
  onSeek: (ms: number) => void;
  onSelect: (cue: Cue) => void;
  /** Sin borde ni fondo propios: lo aporta el contenedor del reproductor. */
  bare?: boolean;
  /** Tira de miniaturas ya montada por el servidor. */
  filmstripSrc?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [scrubbing, setScrubbing] = useState(false);
  const [filmstripFailed, setFilmstripFailed] = useState(false);

  const span = durationMs > 0 ? durationMs : 1;
  const ticks = useMemo(() => rulerTicks(span, Math.max(4, Math.round(10 * zoom))), [span, zoom]);
  const widthPct = (ms: number) => `${Math.min(100, Math.max(0, (ms / span) * 100))}%`;

  const positionFromEvent = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      return Math.round(Math.min(1, Math.max(0, ratio)) * span);
    },
    [span],
  );

  // Scrubbing global: el puntero puede salir del elemento sin perder el arrastre.
  useEffect(() => {
    if (!scrubbing) return;
    const move = (event: PointerEvent) => onSeek(positionFromEvent(event.clientX));
    const up = (event: PointerEvent) => {
      onSeek(positionFromEvent(event.clientX));
      setScrubbing(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [scrubbing, onSeek, positionFromEvent]);

  function nudge(deltaMs: number) {
    onSeek(Math.min(span, Math.max(0, timeMs + deltaMs)));
  }

  const zoomIndex = ZOOM_LEVELS.indexOf(zoom as 1);
  const playheadLeft = widthPct(timeMs);
  const showFilmstrip = Boolean(filmstripSrc) && !filmstripFailed;

  return (
    <section
      className={
        bare
          ? "border-t border-line bg-surface"
          : "overflow-hidden rounded-xl border border-line bg-surface"
      }
      aria-label={labels.title}
    >
      {/* Cabecera: nombre de la pista y zoom */}
      <div className="flex items-center gap-2 px-4 pb-1 pt-3">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-subtle">
          {labels.title}
        </p>

        <div className="ml-auto flex items-center gap-0.5">
          <IconButton
            label={labels.zoomOut}
            className="!h-6 !w-6"
            disabled={zoomIndex <= 0}
            onClick={() => setZoom(ZOOM_LEVELS[Math.max(0, zoomIndex - 1)] ?? 1)}
          >
            <Icon name="minus" className="h-3 w-3" />
          </IconButton>
          <span className="tabular min-w-7 text-center text-[0.6875rem] font-medium text-subtle">
            {zoom}×
          </span>
          <IconButton
            label={labels.zoomIn}
            className="!h-6 !w-6"
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
            onClick={() => setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1)] ?? 1)}
          >
            <Icon name="plus" className="h-3 w-3" />
          </IconButton>
        </div>
      </div>

      <div className="overflow-x-auto px-4 pb-4">
        <div style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
          {/* Regla temporal */}
          <div className="relative mb-1 h-4 select-none">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="tabular absolute top-0 -translate-x-1/2 text-[0.625rem] font-medium text-subtle"
                style={{ left: widthPct(tick) }}
              >
                {formatClock(tick)}
              </span>
            ))}
          </div>

          {/* Pista */}
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label={labels.title}
            aria-valuemin={0}
            aria-valuemax={span}
            aria-valuenow={Math.round(timeMs)}
            aria-valuetext={formatClock(timeMs)}
            className={`relative h-[5rem] cursor-pointer overflow-hidden rounded-lg bg-stage ${
              scrubbing ? "select-none" : ""
            }`}
            onPointerDown={(event) => {
              event.preventDefault();
              setScrubbing(true);
              onSeek(positionFromEvent(event.clientX));
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                nudge(1000);
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                nudge(-1000);
              }
              if (event.key === "Home") {
                event.preventDefault();
                onSeek(0);
              }
              if (event.key === "End") {
                event.preventDefault();
                onSeek(span);
              }
            }}
          >
            {/* Tira de miniaturas del vídeo, encima de los subtítulos */}
            {showFilmstrip && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={filmstripSrc}
                alt=""
                aria-hidden
                draggable={false}
                onError={() => setFilmstripFailed(true)}
                className="pointer-events-none absolute inset-x-0 top-0 h-8 w-full select-none object-fill opacity-80"
              />
            )}

            {/* Rejilla de la regla, dentro de la pista */}
            {ticks.map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="pointer-events-none absolute top-0 h-full w-px bg-white/[0.06]"
                style={{ left: widthPct(tick) }}
              />
            ))}

            {/* Zona ya procesada: lo que queda a la derecha aún no tiene subtítulos. */}
            {coveredMs > 0 && coveredMs < span && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 bg-scrim/40"
                style={{ left: widthPct(coveredMs) }}
              />
            )}

            {cues.map((cue) => {
              const isActive = activeIndex === cue.index;
              const isSelected = selectedIndex === cue.index;
              const width = Math.max(0.5, ((cue.end_ms - cue.start_ms) / span) * 100);
              return (
                <button
                  key={`${cue.index}-${cue.start_ms}`}
                  type="button"
                  title={cue.text}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(cue);
                    onSeek(cue.start_ms);
                  }}
                  className={`absolute top-9 h-[1.85rem] overflow-hidden rounded px-1.5 text-left text-[0.625rem] leading-[1.15] transition-colors ${
                    isSelected
                      ? "z-20 bg-accent font-medium text-on-accent"
                      : isActive
                        ? "z-10 bg-accent/85 text-on-accent"
                        : "bg-accent-soft text-accent-ink hover:bg-accent-softer"
                  }`}
                  style={{ left: widthPct(cue.start_ms), width: `${width}%` }}
                >
                  <span className="line-clamp-2">{cue.text}</span>
                </button>
              );
            })}

            {/* Playhead */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 z-30 h-full w-px bg-white/90"
              style={{ left: playheadLeft }}
            >
              <span className="absolute -left-[4px] -top-0.5 h-2 w-2 rotate-45 rounded-[1px] bg-white/90" />
            </span>
          </div>

          {coveredMs > 0 && coveredMs < span && labels.pending && (
            <p className="mt-2 text-xs leading-5 text-subtle">{labels.pending}</p>
          )}
          {cues.length === 0 && <p className="mt-3 text-sm text-subtle">{labels.empty}</p>}
        </div>
      </div>
    </section>
  );
}
