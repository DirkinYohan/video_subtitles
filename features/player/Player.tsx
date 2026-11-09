"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Flag } from "@/components/Flag";
import { useI18n } from "@/components/I18nProvider";
import { Icon, type IconName } from "@/components/icons";
import { Kbd, Popover, SegmentedControl, Tooltip, menuKeys, useDismiss, useFocusTrap } from "@/components/kit";
import { StatusDot } from "@/components/ui";
import {
  CAPTION_BACKGROUND_CLASS,
  CAPTION_CLASS,
  CAPTION_CLASS_FULLSCREEN,
  useCaptionSize,
  useCaptionStyle,
  writeCaptionSize,
  writeCaptionStyle,
  type CaptionBackground,
  type CaptionPosition,
  type CaptionSize,
} from "@/lib/captions";
import { formatClock } from "@/lib/cues";
import { languageLabel } from "@/lib/i18n";
import { needsSubtitleWait, trackState } from "@/lib/subtitleSync";
import type { LiveStatus } from "@/lib/useLiveTrack";
import { useSubtitleSync } from "@/lib/useSubtitleSync";
import type { Cue } from "@/types/domain";

const MAX_HOLD_MS = 10_000;
// Los controles se ocultan tras este tiempo sin actividad mientras se reproduce.
const CONTROLS_IDLE_MS = 2_500;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

type Menu = "speed" | "subtitles" | null;

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
  filmstripSrc,
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
  filmstripSrc?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setElement(node);
  }, []);
  const { t, locale } = useI18n();
  const reduce = useReducedMotion();

  const frameRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [overControls, setOverControls] = useState(false);
  const [controlsHeight, setControlsHeight] = useState(0);
  const [menu, setMenu] = useState<Menu>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [flash, setFlash] = useState<{ icon: IconName; key: number } | null>(null);
  const idleTimer = useRef<number | undefined>(undefined);

  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), CONTROLS_IDLE_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  useEffect(() => {
    const sync = () => {
      const on = document.fullscreenElement === frameRef.current && frameRef.current !== null;
      setFullscreen(on);
      wake();
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [wake]);

  useEffect(() => {
    const node = controlsRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setControlsHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
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
  const [muted, setMuted] = useState(false);
  const [buffered, setBuffered] = useState<[number, number][]>([]);
  const [error, setError] = useState("");
  const size = useCaptionSize();
  const captionStyle = useCaptionStyle();

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
    video.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
  }, [rate]);

  const subtitleOptions = useMemo(
    () =>
      Array.from(new Set([sourceLanguage, ...targetLanguages, ...Object.keys(tracks)])).filter(
        (code) => code && code !== "und",
      ),
    [sourceLanguage, targetLanguages, tracks],
  );

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

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
      setFlash({ icon: "play", key: Date.now() });
    } else {
      video.pause();
      setFlash({ icon: "pause", key: Date.now() });
    }
  }, []);

  const nudge = useCallback(
    (deltaMs: number) => {
      const video = videoRef.current;
      if (!video) return;
      const next = Math.min(durationMs || Infinity, Math.max(0, video.currentTime * 1000 + deltaMs));
      seek(next);
      setFlash({ icon: deltaMs < 0 ? "skipBack" : "skipForward", key: Date.now() });
    },
    [durationMs, seek],
  );

  const togglePip = useCallback(() => {
    const video = videoRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null;
    if (!video) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
    } else {
      void video.requestPictureInPicture?.().catch(() => undefined);
    }
  }, []);
  const [pipSupported, setPipSupported] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setPipSupported(Boolean(document.pictureInPictureEnabled)), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Atajos de teclado del reproductor (no actúan mientras se escribe).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]:not([data-player-dialog])")) return;
      const onButton = target?.tagName === "BUTTON" || target?.getAttribute("role") === "slider";
      const key = event.key;
      let handled = true;
      if (key === " " && !onButton) togglePlay();
      else if (key === "k" || key === "K") togglePlay();
      else if (key === "j" || key === "J") nudge(-10_000);
      else if (key === "l" || key === "L") nudge(10_000);
      else if (key === "ArrowLeft" && target?.getAttribute("role") !== "slider") nudge(-5_000);
      else if (key === "ArrowRight" && target?.getAttribute("role") !== "slider") nudge(5_000);
      else if (key === "m" || key === "M") setMuted((value) => !value);
      else if (key === "f" || key === "F") toggleFullscreen();
      else if (key === "c" || key === "C") setShow((value) => !value);
      else if (key === "?") setShortcuts((value) => !value);
      else handled = false;
      if (handled) {
        event.preventDefault();
        wake();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, nudge, toggleFullscreen, wake]);

  const controlsVisible = !playing || !idle || overControls || menu !== null || scrubbing;
  const captionOffset = controlsVisible && controlsHeight > 0 ? `${controlsHeight + 10}px` : fullscreen ? "7%" : "6%";
  const captionText = fullscreen ? CAPTION_CLASS_FULLSCREEN[size] : CAPTION_CLASS[size];
  const top = captionStyle.position === "top";

  const closeMenu = useCallback(() => setMenu(null), []);
  const toggleMenu = (next: Exclude<Menu, null>) => setMenu((current) => (current === next ? null : next));

  return (
    <div className="grid min-w-0 gap-2">
      <div
        ref={frameRef}
        role="region"
        aria-label={t("player.region")}
        onPointerMove={wake}
        onPointerDown={wake}
        onPointerLeave={() => playing && setIdle(true)}
        className={`group/player relative overflow-hidden bg-stage ${
          fullscreen ? "flex h-full w-full items-center" : "rounded-2xl ring-1 ring-inset ring-white/[0.06]"
        } ${controlsVisible ? "" : "cursor-none"}`}
      >
        <video
          ref={attachVideo}
          src={`/api/videos/${projectId}/media`}
          poster={poster || undefined}
          className={fullscreen ? "h-full w-full object-contain" : "block aspect-video w-full object-contain"}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
          onLoadedMetadata={(event) => applyMetadata(event.currentTarget)}
          onProgress={(event) => {
            const ranges = event.currentTarget.buffered;
            const next: [number, number][] = [];
            for (let index = 0; index < ranges.length; index += 1) {
              next.push([ranges.start(index) * 1000, ranges.end(index) * 1000]);
            }
            setBuffered(next);
          }}
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
            wake();
          }}
          onPause={() => setPlaying(false)}
          onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
          onError={() => setError(t("player.mediaError"))}
        />

        {/* Indicación central breve al reproducir, pausar o saltar. */}
        <AnimatePresence>
          {flash && (
            <motion.span
              key={flash.key}
              aria-hidden="true"
              initial={{ opacity: 0.9, scale: reduce ? 1 : 0.9 }}
              animate={{ opacity: 0, scale: reduce ? 1 : 1.15 }}
              transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
              onAnimationComplete={() => setFlash(null)}
              className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm"
            >
              <Icon name={flash.icon} weight="fill" className="h-7 w-7" />
            </motion.span>
          )}
        </AnimatePresence>

        {!playing && !holding && timeMs === 0 && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label={t("player.play")}
            className="absolute left-1/2 top-1/2 hidden h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 sm:grid text-stage shadow-[0_12px_40px_-8px_rgb(0_0_0/0.6)] backdrop-blur transition-transform duration-200 ease-[var(--ease-standard)] hover:scale-105"
          >
            <Icon name="play" weight="fill" className="ml-1 h-7 w-7" />
          </button>
        )}

        {show && overlay && (
          <div
            className="pointer-events-none absolute inset-x-[6%] text-center transition-[top,bottom] duration-200 ease-[var(--ease-standard)]"
            style={top ? { top: fullscreen ? "7%" : "6%" } : { bottom: captionOffset }}
          >
            <span
              lang={lang}
              className={`inline-block max-w-[88%] whitespace-pre-line rounded-lg px-3.5 py-1.5 font-medium leading-snug text-white shadow-[0_4px_16px_-4px_rgb(0_0_0/0.5)] [text-wrap:balance] ${CAPTION_BACKGROUND_CLASS[captionStyle.background]} ${captionText}`}
            >
              {overlay}
            </span>
          </div>
        )}

        {show && stateNote && (
          <div
            className="pointer-events-none absolute inset-x-0 text-center transition-[bottom] duration-200"
            style={{ bottom: captionOffset }}
          >
            <span
              role="status"
              className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
            >
              {(holding || state === "processing") && <StatusDot tone="accent" pulse />}
              {stateNote}
            </span>
          </div>
        )}

        <div
          ref={controlsRef}
          inert={!controlsVisible}
          onPointerEnter={() => setOverControls(true)}
          onPointerLeave={() => setOverControls(false)}
          onFocus={() => {
            setOverControls(true);
            wake();
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverControls(false);
          }}
          className={`player-scrim absolute inset-x-0 bottom-0 z-10 px-3 pb-2 pt-10 text-white transition-opacity duration-200 ease-[var(--ease-standard)] sm:px-4 ${
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <ProgressBar
            timeMs={timeMs}
            durationMs={durationMs}
            buffered={buffered}
            cues={cues}
            filmstripSrc={filmstripSrc}
            label={t("player.position")}
            onSeek={(ms) => seek(ms)}
            onScrubChange={setScrubbing}
          />

          <div className="mt-1.5 flex items-center gap-1">
            <ControlButton label={playing ? t("player.pause") : t("player.play")} shortcut="K" onClick={togglePlay}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={playing ? "pause" : "play"}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
                  transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                  className="grid place-items-center"
                >
                  <Icon name={playing ? "pause" : "play"} weight="fill" className="h-5 w-5" />
                </motion.span>
              </AnimatePresence>
            </ControlButton>
            <ControlButton label={t("player.back5")} shortcut="←" onClick={() => nudge(-5_000)}>
              <Icon name="skipBack" className="h-5 w-5" />
            </ControlButton>
            <ControlButton label={t("player.forward5")} shortcut="→" onClick={() => nudge(5_000)}>
              <Icon name="skipForward" className="h-5 w-5" />
            </ControlButton>

            <VolumeControl
              volume={volume}
              muted={muted}
              onVolume={(value) => {
                setVolume(value);
                if (value > 0) setMuted(false);
              }}
              onMute={() => setMuted((value) => !value)}
            />

            <p className="ml-1.5 whitespace-nowrap font-mono text-xs tabular-nums sm:text-[0.8125rem]">
              <span className="text-white">{formatClock(timeMs)}</span>
              <span className="text-white/50"> / {formatClock(durationMs)}</span>
            </p>

            <div className="ml-auto flex items-center gap-1">
              <Tooltip label={liveLabel}>
                <button
                  type="button"
                  aria-pressed={liveEnabled}
                  aria-label={`${t("player.live")}: ${liveLabel}`}
                  onClick={() => onLiveToggle(!liveEnabled)}
                  className={`hidden h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-colors sm:inline-flex ${
                    liveEnabled ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <StatusDot tone={liveEnabled ? liveTone : "neutral"} pulse={liveEnabled && liveStatus === "connecting"} />
                  LIVE
                </button>
              </Tooltip>

              <SpeedMenu
                rate={rate}
                open={menu === "speed"}
                onToggle={() => toggleMenu("speed")}
                onClose={closeMenu}
                onChange={setRate}
              />

              <ControlButton
                label={show ? t("player.captionsOff") : t("player.captionsOn")}
                shortcut="C"
                pressed={show}
                onClick={() => setShow((value) => !value)}
              >
                <Icon name="cc" weight={show ? "fill" : "regular"} className="h-5 w-5" />
              </ControlButton>

              <SubtitleMenu
                open={menu === "subtitles"}
                onToggle={() => toggleMenu("subtitles")}
                onClose={closeMenu}
                lang={lang}
                show={show}
                options={subtitleOptions}
                sourceLanguage={sourceLanguage}
                size={size}
                background={captionStyle.background}
                position={captionStyle.position}
                onLang={(code) => {
                  onLangChange(code);
                  setShow(true);
                }}
                onOff={() => setShow(false)}
              />

              {pipSupported && (
                <ControlButton label={t("player.pip")} onClick={togglePip} className="hidden sm:grid">
                  <Icon name="pip" className="h-5 w-5" />
                </ControlButton>
              )}
              <ControlButton
                label={fullscreen ? t("player.exitFullscreen") : t("player.fullscreen")}
                shortcut="F"
                onClick={toggleFullscreen}
              >
                <Icon name={fullscreen ? "shrink" : "expand"} className="h-5 w-5" />
              </ControlButton>
            </div>
          </div>
        </div>

        <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} />
      </div>

      {(processing || (liveEnabled && liveStatus !== "off") || error) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted">
          {(processing || (liveEnabled && liveStatus !== "off")) && (
            <p role="status" className="inline-flex items-center gap-2">
              <StatusDot
                tone={processing || liveStatus === "connecting" ? "accent" : liveTone}
                pulse={processing || liveStatus === "connecting"}
              />
              <span className="text-ink-2">{processing ? t("process.backgroundShort") : liveLabel}</span>
              {processing && typeof coveredMs === "number" && coveredMs > 0 && (
                <span className="font-mono tabular-nums text-subtle">
                  {t("process.upTo")} {formatClock(coveredMs)}
                </span>
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="font-medium text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShortcuts(true)}
            className="ml-auto hidden items-center gap-1.5 rounded-md px-1.5 py-0.5 text-subtle hover:text-ink sm:inline-flex"
          >
            <Icon name="keyboard" className="h-3.5 w-3.5" />
            <Kbd>?</Kbd>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ControlButton({
  label,
  shortcut,
  onClick,
  pressed,
  children,
  className = "",
  expanded,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
  className?: string;
  expanded?: boolean;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut} className={className}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        onClick={onClick}
        className="grid h-9 w-9 place-items-center rounded-lg text-white/90 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:shadow-[0_0_0_2px_rgb(255_255_255/0.7)] focus-visible:outline-none"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ProgressBar({
  timeMs,
  durationMs,
  buffered,
  cues,
  filmstripSrc,
  label,
  onSeek,
  onScrubChange,
}: {
  timeMs: number;
  durationMs: number;
  buffered: [number, number][];
  cues: Cue[];
  filmstripSrc?: string;
  label: string;
  onSeek: (ms: number) => void;
  onScrubChange: (scrubbing: boolean) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; ms: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [strip, setStrip] = useState<{ frames: number } | null>(null);
  const span = durationMs > 0 ? durationMs : 1;
  const played = Math.min(1, Math.max(0, timeMs / span));

  // Tira de fotogramas: se deduce cuántos hay a partir de sus proporciones (16:9).
  useEffect(() => {
    if (!filmstripSrc) return;
    const image = new Image();
    image.onload = () => {
      const frameWidth = (image.naturalHeight * 16) / 9;
      const frames = frameWidth > 0 ? Math.max(1, Math.round(image.naturalWidth / frameWidth)) : 1;
      setStrip({ frames });
    };
    image.src = filmstripSrc;
  }, [filmstripSrc]);

  const at = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return { x: 0, ms: 0, width: 1 };
      const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
      return { x, ms: Math.round((x / rect.width) * span), width: rect.width };
    },
    [span],
  );

  const markers = cues.length > 0 && cues.length <= 600 ? cues : [];
  const previewWidth = 160;
  const frameIndex = hover && strip ? Math.min(strip.frames - 1, Math.floor((hover.ms / span) * strip.frames)) : 0;

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(span)}
      aria-valuenow={Math.round(timeMs)}
      aria-valuetext={`${formatClock(timeMs)} / ${formatClock(durationMs)}`}
      className="group/bar relative flex h-4 cursor-pointer touch-none items-center outline-none focus-visible:[&>div:first-child]:shadow-[0_0_0_2px_rgb(255_255_255/0.6)]"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = at(event.clientX);
        setDragging(true);
        onScrubChange(true);
        setHover(point);
        onSeek(point.ms);
      }}
      onPointerMove={(event) => {
        const point = at(event.clientX);
        setHover(point);
        if (dragging) onSeek(point.ms);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false);
        onScrubChange(false);
      }}
      onPointerCancel={() => {
        setDragging(false);
        onScrubChange(false);
      }}
      onPointerLeave={() => !dragging && setHover(null)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          onSeek(Math.min(span, timeMs + 5000));
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          onSeek(Math.max(0, timeMs - 5000));
        } else if (event.key === "Home") {
          event.preventDefault();
          onSeek(0);
        } else if (event.key === "End") {
          event.preventDefault();
          onSeek(span);
        }
      }}
    >
      <div
        className={`relative h-1.5 w-full origin-center overflow-hidden rounded-full bg-white/20 transition-transform duration-150 ease-[var(--ease-standard)] ${
          dragging ? "scale-y-100" : "scale-y-[0.667] group-hover/bar:scale-y-100"
        }`}
      >
        {buffered.map(([start, end]) => (
          <span
            key={start}
            className="absolute inset-y-0 bg-white/30"
            style={{ left: `${(start / span) * 100}%`, width: `${((end - start) / span) * 100}%` }}
          />
        ))}
        <span
          className="absolute inset-0 origin-left bg-accent"
          style={{ transform: `scaleX(${played})` }}
        />
        {markers.map((cue) => (
          <span
            key={`${cue.index}-${cue.start_ms}`}
            className="absolute inset-y-0 w-px bg-black/35"
            style={{ left: `${(cue.start_ms / span) * 100}%` }}
          />
        ))}
      </div>

      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.5)] transition-transform duration-150 ease-[var(--ease-standard)] ${
          dragging ? "scale-100" : "scale-0 group-hover/bar:scale-100 group-focus-visible/bar:scale-100"
        }`}
        style={{ left: `${played * 100}%` }}
      />

      {hover && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-6 z-20 grid -translate-x-1/2 justify-items-center gap-1.5"
          style={{
            left: `${Math.min(hover.width - previewWidth / 2, Math.max(previewWidth / 2, hover.x))}px`,
          }}
        >
          {filmstripSrc && strip && (
            <span
              className="block overflow-hidden rounded-lg bg-black ring-1 ring-white/25 shadow-[0_8px_24px_-6px_rgb(0_0_0/0.7)]"
              style={{
                width: previewWidth,
                height: (previewWidth * 9) / 16,
                backgroundImage: `url(${filmstripSrc})`,
                backgroundSize: `${previewWidth * strip.frames}px 100%`,
                backgroundPosition: `-${frameIndex * previewWidth}px 0`,
              }}
            />
          )}
          <span className="rounded-md bg-black/80 px-2 py-0.5 font-mono text-xs font-medium tabular-nums text-white">
            {formatClock(hover.ms)}
          </span>
        </span>
      )}
    </div>
  );
}

function VolumeControl({
  volume,
  muted,
  onVolume,
  onMute,
}: {
  volume: number;
  muted: boolean;
  onVolume: (value: number) => void;
  onMute: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);
  const level = muted ? 0 : volume;
  return (
    <div
      className="group/vol flex items-center"
      onPointerEnter={onOpen}
      onPointerLeave={onClose}
      onFocus={onOpen}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
    >
      <ControlButton label={muted ? t("player.unmute") : t("player.mute")} shortcut="M" onClick={onMute}>
        <Icon name={level === 0 ? "mute" : "volume"} className="h-5 w-5" />
      </ControlButton>
      <div
        className={`hidden overflow-hidden transition-[width,opacity] duration-200 ease-[var(--ease-standard)] sm:block ${
          open ? "w-20 opacity-100" : "w-0 opacity-0"
        }`}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={level}
          aria-label={t("player.volume")}
          onChange={(event) => onVolume(Number(event.target.value))}
          className="player-range mx-1.5 w-[4.25rem]"
          style={{ ["--progress" as string]: `${level * 100}%` }}
        />
      </div>
    </div>
  );
}

function SpeedMenu({
  rate,
  open,
  onToggle,
  onClose,
  onChange,
}: {
  rate: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (rate: number) => void;
}) {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, onClose, [wrap], trigger);
  useEffect(() => {
    if (open) wrap.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);
  return (
    <div className="relative" ref={wrap}>
      <Tooltip label={t("player.speed")}>
        <button
          ref={trigger}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`${t("player.speed")}: ${rate}×`}
          onClick={onToggle}
          className="grid h-9 min-w-9 place-items-center rounded-lg px-1.5 font-mono text-xs font-semibold tabular-nums text-white/90 hover:bg-white/10 hover:text-white"
        >
          {rate}×
        </button>
      </Tooltip>
      <Popover open={open} placement="top-end" role="menu" label={t("player.speed")} className="w-40">
        <div onKeyDown={menuKeys}>
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-subtle">{t("player.speed")}</p>
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={value === rate}
              onClick={() => {
                onChange(value);
                onClose();
                trigger.current?.focus();
              }}
              className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left font-mono text-sm tabular-nums text-ink outline-none hover:bg-surface-2 focus-visible:bg-surface-2"
            >
              <span className="grid w-4 place-items-center text-accent">
                {value === rate && <Icon name="check" weight="bold" className="h-3.5 w-3.5" />}
              </span>
              {value === 1 ? `1× · ${t("player.normal")}` : `${value}×`}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}

function SubtitleMenu({
  open,
  onToggle,
  onClose,
  lang,
  show,
  options,
  sourceLanguage,
  size,
  background,
  position,
  onLang,
  onOff,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  lang: string;
  show: boolean;
  options: string[];
  sourceLanguage: string;
  size: CaptionSize;
  background: CaptionBackground;
  position: CaptionPosition;
  onLang: (code: string) => void;
  onOff: () => void;
}) {
  const { t, locale } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, onClose, [wrap], trigger);
  useEffect(() => {
    if (open) wrap.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
  }, [open]);
  const sizes: { value: string; label: string }[] = [
    { value: "0", label: "S" },
    { value: "1", label: "M" },
    { value: "2", label: "L" },
    { value: "3", label: "XL" },
  ];
  const itemClass =
    "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-ink outline-none hover:bg-surface-2 focus-visible:bg-surface-2";
  return (
    <div className="relative" ref={wrap}>
      <Tooltip label={t("player.subtitleSettings")}>
        <button
          ref={trigger}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("player.subtitleSettings")}
          onClick={onToggle}
          className="grid h-9 w-9 place-items-center rounded-lg text-white/90 hover:bg-white/10 hover:text-white"
        >
          <Icon name="settings" className={`h-5 w-5 transition-transform duration-300 ease-[var(--ease-standard)] ${open ? "rotate-45" : ""}`} />
        </button>
      </Tooltip>
      <Popover open={open} placement="top-end" role="menu" label={t("player.subtitleSettings")} className="max-h-[min(30rem,70vh)] w-72 overflow-y-auto">
        <div onKeyDown={menuKeys} className="grid gap-1">
          <p className="px-2.5 pt-1.5 text-xs font-medium text-subtle">{t("player.subtitles")}</p>
          {options.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={show && code === lang}
              onClick={() => onLang(code)}
              className={itemClass}
            >
              <span className="grid w-4 place-items-center text-accent">
                {show && code === lang && <Icon name="check" weight="bold" className="h-3.5 w-3.5" />}
              </span>
              <Flag code={code} />
              <span className="flex-1 truncate">{languageLabel(locale, code)}</span>
              {code === sourceLanguage && <span className="text-xs text-subtle">{t("export.original")}</span>}
            </button>
          ))}
          <button type="button" role="menuitemradio" aria-checked={!show} onClick={onOff} className={itemClass}>
            <span className="grid w-4 place-items-center text-accent">
              {!show && <Icon name="check" weight="bold" className="h-3.5 w-3.5" />}
            </span>
            {t("player.captionsDisabled")}
          </button>

          <div className="my-1 h-px bg-line" />

          <div className="grid gap-3 px-2.5 pb-2 pt-1">
            <div
              aria-hidden="true"
              className="grid h-16 place-items-center overflow-hidden rounded-lg bg-stage"
            >
              <span
                className={`rounded-md px-2.5 py-1 font-medium text-white ${CAPTION_BACKGROUND_CLASS[background]} ${
                  ["text-xs", "text-sm", "text-base", "text-lg"][size]
                }`}
              >
                {t("player.preview")}
              </span>
            </div>
            <Row label={t("studio.size")}>
              <SegmentedControl
                size="sm"
                label={t("studio.size")}
                value={String(size)}
                onChange={(value) => writeCaptionSize(Number(value) as CaptionSize)}
                options={sizes}
              />
            </Row>
            <Row label={t("player.background")}>
              <SegmentedControl
                size="sm"
                label={t("player.background")}
                value={background}
                onChange={(value) => writeCaptionStyle({ background: value })}
                options={[
                  { value: "solid", label: t("player.bgSolid") },
                  { value: "soft", label: t("player.bgSoft") },
                  { value: "none", label: t("player.bgNone") },
                ]}
              />
            </Row>
            <Row label={t("player.position2")}>
              <SegmentedControl
                size="sm"
                label={t("player.position2")}
                value={position}
                onChange={(value) => writeCaptionStyle({ position: value })}
                options={[
                  { value: "bottom", label: t("player.bottom") },
                  { value: "top", label: t("player.top") },
                ]}
              />
            </Row>
            <p className="flex items-center gap-2 text-xs text-muted">
              <Icon name="volume" className="h-3.5 w-3.5 text-subtle" />
              {t("player.audio")}:
              <Flag code={sourceLanguage} />
              <span className="text-ink-2">{languageLabel(locale, sourceLanguage)}</span>
            </p>
          </div>
        </div>
      </Popover>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(open, ref, onClose);
  const rows: [string, string][] = [
    ["Espacio · K", t("player.kPlay")],
    ["J · L", t("player.kJump10")],
    ["← · →", t("player.kJump5")],
    ["M", t("player.kMute")],
    ["F", t("player.kFullscreen")],
    ["C", t("player.kCaptions")],
    ["?", t("player.kHelp")],
  ];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <div
            ref={ref}
            role="dialog"
            data-player-dialog
            aria-modal="true"
            aria-label={t("player.shortcuts")}
            onClick={(event) => event.stopPropagation()}
            className="material-raised w-full max-w-sm rounded-2xl p-5 shadow-[var(--shadow-dialog)]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{t("player.shortcuts")}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("palette.close")}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-4 grid gap-2.5">
              {rows.map(([keys, label]) => (
                <div key={keys} className="flex items-center justify-between gap-4 text-sm">
                  <dt className="text-ink-2">{label}</dt>
                  <dd className="flex gap-1">
                    {keys.split(" · ").map((key) => (
                      <Kbd key={key}>{key === "Espacio" ? t("player.space") : key}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
