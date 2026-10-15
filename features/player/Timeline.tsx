"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatClock, rulerTicks } from "@/lib/cues";
import type { Cue } from "@/types/domain";

const ZOOM_LEVELS = [1, 2, 4, 8, 16] as const;

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
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [scrubbing, setScrubbing] = useState(false);

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

  return (
    <section className="mt-4 rounded-2xl border border-line bg-white" aria-label={labels.title}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{labels.title}</p>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink disabled:opacity-40"
            aria-label={labels.zoomOut}
            disabled={zoom === ZOOM_LEVELS[0]}
            onClick={() => setZoom((value) => ZOOM_LEVELS[Math.max(0, ZOOM_LEVELS.indexOf(value as 1) - 1)] ?? 1)}
          >
            −
          </button>
          <span className="min-w-9 text-center text-xs font-semibold tabular-nums text-muted">{zoom}×</span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink disabled:opacity-40"
            aria-label={labels.zoomIn}
            disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            onClick={() => setZoom((value) => ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, ZOOM_LEVELS.indexOf(value as 1) + 1)] ?? 1)}
          >
            +
          </button>
        </div>
      </div>
      <div className="overflow-x-auto p-3">
        <div style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
          {/* Regla temporal */}
          <div className="relative mb-1 h-5 select-none">
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute top-0 -translate-x-1/2 text-[10px] tabular-nums text-muted"
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
            className={`relative h-24 cursor-pointer rounded-xl border border-line bg-paper/60 ${scrubbing ? "select-none" : ""}`}
            onPointerDown={(event) => {
              event.preventDefault();
              setScrubbing(true);
              onSeek(positionFromEvent(event.clientX));
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") { event.preventDefault(); nudge(1000); }
              if (event.key === "ArrowLeft") { event.preventDefault(); nudge(-1000); }
              if (event.key === "Home") { event.preventDefault(); onSeek(0); }
              if (event.key === "End") { event.preventDefault(); onSeek(span); }
            }}
          >
            {ticks.map((tick) => (
              <span
                key={tick}
                aria-hidden
                className="pointer-events-none absolute top-0 h-full w-px bg-line/70"
                style={{ left: widthPct(tick) }}
              />
            ))}
            {/* Zona ya procesada: lo que queda a la derecha aún no tiene subtítulos. */}
            {coveredMs > 0 && coveredMs < span && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 bg-ink/[0.04]"
                style={{ left: widthPct(coveredMs) }}
              />
            )}
            {cues.map((cue) => {
              const isActive = activeIndex === cue.index;
              const isSelected = selectedIndex === cue.index;
              const width = Math.max(0.4, ((cue.end_ms - cue.start_ms) / span) * 100);
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
                  className={`absolute top-8 h-9 overflow-hidden rounded-md px-1.5 text-left text-[10px] leading-tight transition ${
                    isSelected
                      ? "z-20 bg-violet text-white ring-2 ring-violet/40"
                      : isActive
                        ? "z-10 bg-accent text-white"
                        : "bg-accent-soft text-accent hover:bg-accent/20"
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
              className="pointer-events-none absolute top-0 z-30 h-full w-0.5 bg-violet"
              style={{ left: widthPct(timeMs) }}
            >
              <span className="absolute -top-1 -left-[3px] h-2 w-2 rounded-full bg-violet" />
            </span>
          </div>
          {/* Leyenda de la zona pendiente de procesar. */}
          {coveredMs > 0 && coveredMs < span && labels.pending && (
            <p className="mt-2 text-xs text-muted">{labels.pending}</p>
          )}
          {cues.length === 0 && <p className="mt-3 text-sm text-muted">{labels.empty}</p>}
        </div>
      </div>
    </section>
  );
}
