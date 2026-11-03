"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { StatusDot, IconButton } from "@/components/ui";
import { CAPTION_CLASS, CAPTION_CLASS_FULLSCREEN, useCaptionSize, writeCaptionSize, type CaptionSize } from "@/lib/captions";
import { formatClock } from "@/lib/cues";
import { languageLabel } from "@/lib/i18n";
import { flag } from "@/lib/languages";
import { needsSubtitleWait, trackState } from "@/lib/subtitleSync";
import type { LiveStatus } from "@/lib/useLiveTrack";
import { useSubtitleSync } from "@/lib/useSubtitleSync";
import type { Cue } from "@/types/domain";

const MAX_HOLD_MS = 10_000;

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
  processing,
  coveredMs,
  generating = false,
  coveredAt,
  holdForSubtitles = false,
  trackFailed = false,
  poster,
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
  processing?: boolean;
  coveredMs?: number;
  generating?: boolean;
  coveredAt?: (ms: number) => boolean;
  holdForSubtitles?: boolean;
  trackFailed?: boolean;
  poster?: string;
  bare?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setElement(node);
  }, []);
  const { t, locale } = useI18n();

  const frameRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === frameRef.current && frameRef.current !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    const frame = frameRef.current;
    if (frame?.requestFullscreen) {
      void frame.requestFullscreen().catch(() => undefined);
      return;
    }
    (videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null)?.webkitEnterFullscreen?.();
  }, []);

  const applyMetadata = useCallback(
    (video: HTMLVideoElement) => {
      const total = Math.round(video.duration * 1000);
      if (Number.isFinite(total) && total > 0) onDurationChange(total);
      video.muted = false;
      if (video.volume === 0) video.volume = 1;
    },
    [onDurationChange],
  );

  useEffect(() => {
    if (!element) return;
    onVideoElement(element);
    if (element.readyState >= 1) applyMetadata(element);
    return () => onVideoElement(null);
  }, [element, onVideoElement, applyMetadata]);

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

  useEffect(() => {
    seekRef.current = (ms: number) => seek(ms);
    return () => {
      seekRef.current = () => undefined;
    };
  }, [seek, seekRef]);

  const { snapshot } = useSubtitleSync(element, cues);
  const overlay = snapshot.cue?.text || "";
  const firstShown = useRef(false);
  useEffect(() => {
    if (!overlay || firstShown.current) return;
    firstShown.current = true;
    console.debug(
      `[LIVE] primer subtítulo visible a los ${Math.round(performance.now())} ms de cargar la página (vídeo en ${snapshot.timeMs} ms)`,
    );
  }, [overlay, snapshot.timeMs]);

  const covered = coveredAt ? coveredAt(timeMs) : false;
  const state = trackState({ cueCount: cues.length, covered, generating, failed: trackFailed });

  const [holding, setHolding] = useState(false);
  const forcePlay = useRef(false);
  const shouldHold = (video: HTMLVideoElement) =>
    needsSubtitleWait({
      enabled: holdForSubtitles,
      captionsOn: show,
      forced: forcePlay.current,
      covered: coveredAt?.(Math.round(video.currentTime * 1000)) ?? true,
    });

  useEffect(() => {
    if (!holding || !covered) return;
    void videoRef.current?.play().catch(() => undefined);
  }, [holding, covered]);

  useEffect(() => {
    if (!holding) return;
    const timer = window.setTimeout(() => {
      forcePlay.current = true;
      void videoRef.current?.play().catch(() => undefined);
    }, MAX_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [holding]);

  const stateNote = holding
    ? t("player.holding", { lang: languageLabel(locale, lang) })
    : overlay || state === "ready"
      ? ""
      : state === "processing"
        ? t("player.trackProcessing", { lang: languageLabel(locale, lang) })
        : state === "failed"
          ? t("player.trackFailed", { lang: languageLabel(locale, lang) })
          : t("player.trackMissing", { lang: languageLabel(locale, lang) });

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
        : liveStatus === "busy"
          ? t("player.liveBusy")
          : liveStatus === "complete"
            ? t("player.liveDone")
          : liveStatus === "error"
            ? t("player.liveError")
            : t("player.liveOff");

  const liveTone =
    liveStatus === "live" || liveStatus === "complete"
      ? "ok"
      : liveStatus === "connecting"
        ? "warn"
        : liveStatus === "error"
          ? "danger"
          : "neutral";

  return (
    <div className="grid min-w-0 gap-4">
      <div
        ref={frameRef}
        className={
          fullscreen
            ? "flex h-full w-full flex-col bg-stage"
            : bare
              ? "bg-surface"
              : "overflow-hidden rounded-2xl border border-line bg-surface"
        }
      >
        <div className={fullscreen ? "relative min-h-0 flex-1 bg-stage" : "relative bg-stage"}>
          <video
            ref={attachVideo}
            src={`/api/videos/${projectId}/media`}
            poster={poster || undefined}
            className={fullscreen ? "h-full w-full object-contain" : "aspect-video w-full object-contain"}
            onDoubleClick={toggleFullscreen}
            onLoadedMetadata={(event) => applyMetadata(event.currentTarget)}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              onTimeChange(Math.round(video.currentTime * 1000));
              if (!video.paused && shouldHold(video)) {
                console.debug(
                  `[LIVE] espera de subtítulos en ${Math.round(video.currentTime * 1000)} ms (el vídeo alcanzó lo preparado)`,
                );
                setHolding(true);
                video.pause();
              }
            }}
            onSeeked={(event) => {
              const video = event.currentTarget;
              onTimeChange(Math.round(video.currentTime * 1000));
              if (!video.paused && shouldHold(video)) {
                setHolding(true);
                video.pause();
              }
            }}
            onPlay={(event) => {
              const video = event.currentTarget;
              setError("");
              if (shouldHold(video)) {
                setHolding(true);
                video.pause();
                return;
              }
              forcePlay.current = false;
              setHolding(false);
              setPlaying(true);
            }}
            onPause={() => setPlaying(false)}
            onError={() => setError(t("player.mediaError"))}
          />

          {show && overlay && (
            <div className="pointer-events-none absolute inset-x-[7%] bottom-[11%] text-center">
              <span
                lang={lang}
                className={`inline-block max-w-[85%] rounded-md bg-scrim-strong px-3.5 py-2 leading-snug text-white backdrop-blur-sm [text-wrap:balance] ${fullscreen ? CAPTION_CLASS_FULLSCREEN[size] : CAPTION_CLASS[size]}`}
              >
                {overlay}
              </span>
            </div>
          )}

          {show && stateNote && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[11%] text-center">
              <span
                role="status"
                className="inline-flex items-center gap-2 rounded-md bg-scrim-strong px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
              >
                {(holding || state === "processing") && <StatusDot tone="accent" pulse />}
                {stateNote}
              </span>
            </div>
          )}
        </div>

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
              label={fullscreen ? t("player.exitFullscreen") : t("player.fullscreen")}
              className="!h-8 !w-8"
              onClick={toggleFullscreen}
            >
              <Icon name={fullscreen ? "shrink" : "expand"} className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

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

        {(processing || (liveEnabled && liveStatus !== "off")) && (
          <p
            role="status"
            className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line bg-surface-2/60 px-4 py-2.5 text-xs text-muted"
          >
            <StatusDot tone={processing || liveStatus === "connecting" ? "accent" : liveTone} pulse={processing || liveStatus === "connecting"} />
            <span className="font-medium text-ink-2">{processing ? t("process.backgroundShort") : liveLabel}</span>
            {processing && typeof coveredMs === "number" && coveredMs > 0 && (
              <span className="tabular rounded-md bg-surface px-1.5 py-0.5 font-medium text-ink-2">
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
