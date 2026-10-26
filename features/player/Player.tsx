"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { StatusDot, IconButton } from "@/components/ui";
import { CAPTION_CLASS, useCaptionSize, writeCaptionSize, type CaptionSize } from "@/lib/captions";
import { activeCue, formatClock } from "@/lib/cues";
import { languageLabel } from "@/lib/i18n";
import { flag } from "@/lib/languages";
import type { LiveEvent, LiveStatus } from "@/lib/useLiveSubtitles";
import type { Cue } from "@/types/domain";

export function Player({
  projectId,
  cues,
  tracks,
  lang,
  onLangChange,
  durationMs,
  timeMs,
  onTimeChange,
  onDurationChange,
  sourceLanguage,
  targetLanguages,
  seekRef,
  onVideoElement,
  liveEnabled,
  onLiveToggle,
  liveStatus,
  liveEvent,
  processing,
  coveredMs,
  bare = false,
}: {
  projectId: string;
  cues: Cue[];
  tracks: Record<string, Cue[]>;
  lang: string;
  onLangChange: (lang: string) => void;
  durationMs: number;
  timeMs: number;
  onTimeChange: (ms: number) => void;
  onDurationChange: (ms: number) => void;
  sourceLanguage: string;
  targetLanguages: string[];
  seekRef: RefObject<(ms: number) => void>;
  onVideoElement: (element: HTMLVideoElement | null) => void;
  liveEnabled: boolean;
  onLiveToggle: (next: boolean) => void;
  liveStatus: LiveStatus;
  liveEvent: LiveEvent | null;
  /** Hay un trabajo de producción en curso (independiente de la reproducción). */
  processing?: boolean;
  /** Hasta qué ms hay subtítulos listos. */
  coveredMs?: number;
  /** Sin borde ni redondeo: lo aporta el contenedor que comparte con la pista. */
  bare?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { t, locale } = useI18n();
  const [show, setShow] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState("");
  const size = useCaptionSize();

  const seek = useCallback(
    (ms: number, play = false) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(0, ms / 1000);
      onTimeChange(Math.max(0, ms));
      if (play) void video.play().catch(() => undefined);
    },
    [onTimeChange],
  );

  // Expone el seek al dueño del estado (editor y timeline) sin recrear el ref.
  useEffect(() => {
    seekRef.current = (ms: number) => seek(ms);
    return () => {
      seekRef.current = () => undefined;
    };
  }, [seek, seekRef]);

  // Cue del idioma elegido. Mientras su traducción no llega, se muestra el
  // original: es preferible leer algo en el idioma de origen a dejar el vídeo
  // sin texto o bloqueado esperando la traducción.
  const cue = activeCue(cues, timeMs);
  const sourceCues = tracks[sourceLanguage] ?? [];
  const fallbackCue =
    !cue && lang !== sourceLanguage && sourceLanguage ? activeCue(sourceCues, timeMs) : null;
  const liveShown = liveEvent
    ? liveEvent.translations[lang] || (lang === sourceLanguage ? liveEvent.text : "")
    : "";
  const overlay = liveShown || cue?.text || fallbackCue?.text || "";
  const overlayIsFallback = Boolean(!liveShown && !cue && fallbackCue);
  const provisional = Boolean(liveShown) && Boolean(liveEvent?.provisional);

  // --- Espera de subtítulos -------------------------------------------------
  // Con el trabajo en curso, el vídeo no puede adelantar al texto: si el tramo
  // que toca todavía no está transcrito, se pausa y se avisa. Antes el vídeo
  // arrancaba igual y el primer subtítulo llegaba con la reproducción ya
  // avanzada, que es justo lo que se veía como «los subtítulos van tarde».
  const [wantsPlay, setWantsPlay] = useState(false);
  const covered = Math.max(0, coveredMs ?? 0);
  const blocked = Boolean(processing) && timeMs >= covered && timeMs < (durationMs || Infinity);
  const waiting = blocked && wantsPlay;

  // Reanuda cuando el tramo pendiente ya tiene subtítulos. Es un efecto
  // secundario puro: no llama a setState, así que no provoca cascadas.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !wantsPlay || blocked) return;
    if (video.paused) void video.play().catch(() => undefined);
  }, [wantsPlay, blocked]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, [volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
  }, [rate]);

  const subtitleOptions = Array.from(
    new Set([sourceLanguage, ...targetLanguages, ...Object.keys(tracks)]),
  ).filter((code) => code && code !== "und");

  const liveLabel =
    liveStatus === "live"
      ? t("player.liveOn")
      : liveStatus === "connecting"
        ? t("player.liveConnecting")
        : liveStatus === "error"
          ? t("player.liveError")
          : t("player.liveOff");

  const liveTone =
    liveStatus === "live"
      ? "ok"
      : liveStatus === "connecting"
        ? "warn"
        : liveStatus === "error"
          ? "danger"
          : "neutral";

  return (
    <div className="grid min-w-0 gap-4">
      <div
        className={
          bare
            ? "bg-surface"
            : "overflow-hidden rounded-2xl border border-line bg-surface"
        }
      >
        {/* --- Imagen --- */}
        <div className="relative bg-stage">
          <video
            ref={videoRef}
            src={`/api/videos/${projectId}/media`}
            className="aspect-video w-full object-contain"
            onLoadedMetadata={(event) => {
              const element = event.currentTarget;
              const total = Math.round(element.duration * 1000);
              if (Number.isFinite(total) && total > 0) onDurationChange(total);
              // Salvaguarda: el vídeo debe sonar siempre. Si algo lo dejó
              // silenciado o con volumen 0, se restaura al cargar.
              element.muted = false;
              if (element.volume === 0) element.volume = 1;
              onVideoElement(element);
            }}
            onTimeUpdate={(event) => {
              const element = event.currentTarget;
              const ms = Math.round(element.currentTime * 1000);
              onTimeChange(ms);
              // Alcanzado el final de lo transcrito: se detiene y espera.
              if (processing && ms >= covered) {
                setWantsPlay(true);
                element.pause();
              }
            }}
            onPlay={() => {
              setPlaying(true);
              setError("");
              if (blocked) {
                // Quiere avanzar pero el tramo aún no tiene subtítulos.
                setWantsPlay(true);
                videoRef.current?.pause();
              } else {
                setWantsPlay(false);
              }
            }}
            onPause={() => {
              setPlaying(false);
              // Una pausa voluntaria cancela la intención de reanudar.
              if (!blocked) setWantsPlay(false);
            }}
            onError={() => setError(t("player.mediaError"))}
          />

          {show && overlay && !waiting && (
            <div className="pointer-events-none absolute inset-x-[7%] bottom-[11%] text-center">
              {provisional && (
                <p className="mb-1 text-xs font-medium text-white/85">{t("player.livePartial")}</p>
              )}
              {overlayIsFallback && (
                <p className="mb-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-white/70">
                  {languageLabel(locale, sourceLanguage)}
                </p>
              )}
              <span
                className={`inline-block max-w-[85%] rounded-md bg-scrim-strong px-3.5 py-2 leading-snug text-white backdrop-blur-sm [text-wrap:balance] ${CAPTION_CLASS[size]} ${
                  provisional ? "opacity-85" : ""
                }`}
              >
                {overlay}
              </span>
            </div>
          )}

          {waiting && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[11%] text-center">
              <span className="inline-flex items-center gap-2 rounded-md bg-scrim-strong px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <StatusDot tone="accent" pulse />
                {t("player.waitingCues")}
              </span>
            </div>
          )}
        </div>

        {/* --- Barra de progreso: fina, pegada al vídeo --- */}
        <div className="relative bg-surface px-0 pb-0 pt-0">
          <input
            type="range"
            min={0}
            max={durationMs || 0}
            value={Math.min(timeMs, durationMs || 0)}
            aria-label={t("player.position")}
            aria-valuetext={`${formatClock(timeMs)} / ${formatClock(durationMs)}`}
            className="scrub block"
            style={
              {
                "--progress": `${durationMs > 0 ? Math.min(100, (timeMs / durationMs) * 100) : 0}%`,
              } as CSSProperties
            }
            onChange={(event) => seek(Number(event.target.value))}
          />
        </div>

        {/* --- Transporte --- */}
        <div className="flex items-center gap-2 border-t border-line bg-surface px-2 py-2 sm:px-3">
          <div className="flex items-center gap-0.5">
            <IconButton
              label={t("player.back")}
              className="!h-9 !w-9"
              onClick={() => seek(Math.max(0, timeMs - 5000))}
            >
              <Icon name="skipBack" className="h-4 w-4" />
            </IconButton>

            <button
              type="button"
              aria-label={playing ? t("player.pause") : t("player.play")}
              className="mx-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-colors hover:bg-accent-strong"
              onClick={() =>
                void (playing
                  ? videoRef.current?.pause()
                  : videoRef.current?.play().catch(() => undefined))
              }
            >
              <Icon name={playing ? "pause" : "play"} className="h-3.5 w-3.5" />
            </button>

            <IconButton
              label={t("player.forward")}
              className="!h-9 !w-9"
              onClick={() => seek(timeMs + 5000)}
            >
              <Icon name="skipForward" className="h-4 w-4" />
            </IconButton>
          </div>

          <p className="tabular flex items-baseline gap-1 text-xs font-medium">
            <span className="text-ink">{formatClock(timeMs)}</span>
            <span className="text-subtle">/</span>
            <span className="text-muted">{formatClock(durationMs)}</span>
          </p>

          <div className="ml-auto flex items-center gap-0.5">
            <label className="hidden items-center gap-2 text-muted sm:flex">
              <Icon name="volume" className="h-4 w-4 shrink-0" />
              <span className="sr-only">{t("player.volume")}</span>
              <input
                className="w-16"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </label>

            <label className="relative">
              <span className="sr-only">{t("player.speed")}</span>
              <select
                value={rate}
                aria-label={t("player.speed")}
                onChange={(event) => setRate(Number(event.target.value))}
                className="tabular h-8 cursor-pointer appearance-none rounded-md px-2 pr-6 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink focus:outline-none"
              >
                {[0.75, 1, 1.25, 1.5, 2].map((value) => (
                  <option key={value} value={value}>
                    {value}x
                  </option>
                ))}
              </select>
              <Icon
                name="chevron"
                className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-subtle"
              />
            </label>

            <button
              type="button"
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
                liveEnabled
                  ? "bg-accent-soft text-accent-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
              aria-pressed={liveEnabled}
              onClick={() => onLiveToggle(!liveEnabled)}
            >
              <StatusDot tone={liveTone} pulse={liveEnabled && liveStatus === "connecting"} />
              <span className="hidden sm:inline">{t("player.live")}</span>
            </button>

            <button
              type="button"
              className={`inline-flex h-8 items-center rounded-md px-2 text-xs font-semibold transition-colors ${
                show
                  ? "bg-accent-soft text-accent-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
              aria-pressed={show}
              onClick={() => setShow((value) => !value)}
            >
              CC
            </button>

            <IconButton
              label={t("player.fullscreen")}
              className="!h-8 !w-8"
              onClick={() => void videoRef.current?.requestFullscreen()}
            >
              <Icon name="expand" className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        {/* --- Metadatos: audio, pista y tamaño --- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface px-3 py-2 text-xs">
          <p className="min-w-0 truncate text-muted">
            {t("player.audio")}
            <span aria-hidden="true" className="px-1.5 text-subtle">
              ·
            </span>
            <span className="font-medium text-ink">
              {flag(sourceLanguage)} {languageLabel(locale, sourceLanguage)}
            </span>
          </p>

          <label className="relative ml-auto flex items-center gap-2">
            <span className="text-muted">{t("player.subtitles")}</span>
            <span className="relative">
              <select
                value={lang}
                onChange={(event) => onLangChange(event.target.value)}
                className="h-8 min-w-0 cursor-pointer appearance-none rounded-md border border-line bg-surface pl-2 pr-7 text-xs font-medium text-ink transition-colors hover:border-line-strong focus:border-accent focus:outline-none"
              >
                {subtitleOptions.map((item) => (
                  <option key={item} value={item}>
                    {flag(item)} {languageLabel(locale, item)}
                  </option>
                ))}
              </select>
              <Icon
                name="chevron"
                className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
              />
            </span>
          </label>

          <label className="hidden items-center gap-1.5 text-muted md:flex">
            <span className="sr-only">{t("studio.size")}</span>
            <span aria-hidden className="text-[0.625rem] font-semibold text-subtle">
              A
            </span>
            <input
              className="w-16"
              type="range"
              min={0}
              max={3}
              step={1}
              value={size}
              aria-label={t("studio.size")}
              onChange={(event) => writeCaptionSize(Number(event.target.value) as CaptionSize)}
            />
            <span aria-hidden className="text-sm font-semibold text-subtle">
              A
            </span>
          </label>
        </div>

        {liveEnabled && (
          <p role="status" className="border-t border-line bg-surface px-3 py-2 text-xs text-muted">
            {liveLabel}
          </p>
        )}

        {processing && (
          <p
            role="status"
            className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-3 py-2 text-xs text-muted"
          >
            <StatusDot tone="accent" pulse />
            {t("process.backgroundShort")}
            {typeof coveredMs === "number" && coveredMs > 0 && (
              <span className="tabular">
                {t("process.upTo")} {formatClock(coveredMs)}
              </span>
            )}
          </p>
        )}

        {error && (
          <p role="alert" className="border-t border-line bg-surface px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
