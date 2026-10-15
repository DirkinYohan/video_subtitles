"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
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
  selectedIndex,
  onSelectCue,
  seekRef,
  onVideoElement,
  liveEnabled,
  onLiveToggle,
  liveStatus,
  liveEvent,
  processing,
  coveredMs,
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
  selectedIndex: number | null;
  onSelectCue: (cue: Cue) => void;
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

  const cue = activeCue(cues, timeMs);
  const liveShown = liveEvent ? liveEvent.translations[lang] || (lang === sourceLanguage ? liveEvent.text : "") : "";
  const overlay = liveShown || cue?.text || "";
  const provisional = Boolean(liveShown) && Boolean(liveEvent?.provisional);

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

  return (
    <div className="grid min-w-0 gap-5">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_18px_55px_rgb(35_48_88/0.08)]">
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
              onTimeUpdate={(event) => onTimeChange(Math.round(event.currentTarget.currentTime * 1000))}
              onPlay={() => { setPlaying(true); setError(""); }}
              onPause={() => setPlaying(false)}
              onError={() => setError(t("player.mediaError"))}
            />
            {show && overlay && (
              <div className="pointer-events-none absolute inset-x-[8%] bottom-[12%] text-center">
                {provisional && <p className="mb-1 text-xs text-white/90">{t("player.livePartial")}</p>}
                <span className={`inline-block max-w-3xl rounded-lg bg-ink/85 px-4 py-2 leading-snug text-white shadow-lg backdrop-blur-sm ${CAPTION_CLASS[size]} ${provisional ? "italic opacity-80" : ""}`}>{overlay}</span>
              </div>
            )}
          </div>
          <div className="grid gap-4 bg-white px-3 py-3 text-ink sm:px-5 sm:py-4">
            <label className="grid gap-1.5 text-xs text-muted">
              <span className="sr-only">{t("player.position")}</span>
              <input
                type="range"
                min={0}
                max={durationMs || 0}
                value={Math.min(timeMs, durationMs || 0)}
                aria-label={t("player.position")}
                aria-valuetext={`${formatClock(timeMs)} / ${formatClock(durationMs)}`}
                onChange={(event) => seek(Number(event.target.value))}
              />
              <span className="text-right font-medium tabular-nums">{formatClock(timeMs)} / {formatClock(durationMs)}</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-paper hover:text-ink" aria-label={t("player.back")} onClick={() => seek(Math.max(0, timeMs - 5000))}>
                <Icon name="skipBack" />
              </button>
              <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-accent text-white shadow-[0_7px_18px_rgb(79_107_237/0.25)] hover:bg-accent-strong" aria-label={playing ? t("player.pause") : t("player.play")} onClick={() => void (playing ? videoRef.current?.pause() : videoRef.current?.play().catch(() => undefined))}>
                <Icon name={playing ? "pause" : "play"} />
              </button>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-paper hover:text-ink" aria-label={t("player.forward")} onClick={() => seek(timeMs + 5000)}>
                <Icon name="skipForward" />
              </button>
              <label className="flex min-w-28 items-center gap-2 px-1 text-xs text-muted">
                <Icon name="volume" className="h-4 w-4" />
                <span className="sr-only">{t("player.volume")}</span>
                <input
                  className="min-w-0 flex-1"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
              </label>
              <div className="ml-auto flex items-center gap-1.5">
                <label className="text-xs text-muted">
                  <span className="sr-only">{t("player.speed")}</span>
                  <select value={rate} aria-label={t("player.speed")} className="min-h-9 rounded-lg bg-paper px-2 py-1 font-medium outline-none" onChange={(event) => setRate(Number(event.target.value))}>
                    {[0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}x</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${liveEnabled ? "bg-accent-soft text-accent" : "text-muted hover:bg-paper"}`}
                  aria-pressed={liveEnabled}
                  onClick={() => onLiveToggle(!liveEnabled)}
                >
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${liveStatus === "live" ? "bg-ok" : liveStatus === "connecting" ? "bg-warn" : liveStatus === "error" ? "bg-danger" : "bg-muted/50"}`}
                  />
                  {t("player.live")}
                </button>
                <button type="button" className={`min-h-9 rounded-lg px-2.5 py-1 text-xs font-bold ${show ? "bg-accent-soft text-accent" : "text-muted hover:bg-paper"}`} aria-pressed={show} onClick={() => setShow((value) => !value)}>CC</button>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink" aria-label={t("player.fullscreen")} onClick={() => void videoRef.current?.requestFullscreen()}>
                  <Icon name="expand" />
                </button>
              </div>
              <label className="flex w-full items-center gap-2 rounded-xl bg-paper px-3 py-2 text-xs text-muted sm:ml-auto sm:w-auto sm:min-w-44">
                <span className="sr-only">{t("studio.size")}</span>
                <span aria-hidden>A−</span>
                <input className="min-w-0 flex-1" type="range" min={0} max={3} step={1} value={size} aria-label={t("studio.size")} onChange={(event) => writeCaptionSize(Number(event.target.value) as CaptionSize)} />
                <span aria-hidden>A+</span>
              </label>
            </div>
            <div className="grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2 sm:items-center">
              <p className="truncate"><span className="text-muted">{t("player.audio")}</span> · <span className="font-medium">{flag(sourceLanguage)} {languageLabel(locale, sourceLanguage)}</span></p>
              <label className="flex min-w-0 items-center gap-2 sm:justify-self-end">
                <span className="shrink-0 text-muted">{t("player.subtitles")}</span>
                <select value={lang} className="min-h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-1.5 font-medium outline-none focus:border-accent sm:flex-none" onChange={(event) => onLangChange(event.target.value)}>
                  {subtitleOptions.map((item) => (
                    <option key={item} value={item}>{flag(item)} {languageLabel(locale, item)}</option>
                  ))}
                </select>
              </label>
            </div>
            {liveEnabled && <p role="status" className="text-xs font-medium text-muted">{liveLabel}</p>}
            {processing && (
              <p role="status" className="flex flex-wrap items-center gap-2 text-xs font-medium text-accent">
                <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                {t("process.backgroundShort")}
                {typeof coveredMs === "number" && coveredMs > 0 && (
                  <span className="tabular-nums text-muted">
                    {t("process.upTo")} {formatClock(coveredMs)}
                  </span>
                )}
              </p>
            )}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </div>
        </div>
        {cues.length > 0 && (
          <div className="mt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("player.cueList")}</p>
            <ol className="grid max-h-72 gap-2 overflow-auto pr-1 sm:grid-cols-2">
              {cues.map((item) => {
                const isActive = cue?.index === item.index;
                const isSelected = selectedIndex === item.index;
                return (
                  <li key={`${item.index}-${item.start_ms}`}>
                    <button
                      type="button"
                      aria-current={isActive ? "true" : undefined}
                      className={`w-full rounded-2xl border px-3.5 py-3 text-left text-sm ${
                        isSelected
                          ? "border-violet/40 bg-violet-soft"
                          : isActive
                            ? "border-accent/30 bg-accent-soft"
                            : "border-line bg-white hover:border-line-strong hover:bg-paper"
                      }`}
                      onClick={() => { onSelectCue(item); seek(item.start_ms); }}
                    >
                      <span className="text-xs text-muted">{formatClock(item.start_ms)} → {formatClock(item.end_ms)}</span>
                      <span className="mt-1 block whitespace-pre-line">{item.text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
