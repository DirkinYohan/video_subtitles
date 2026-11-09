"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { LangCode } from "@/components/Flag";
import { ProgressRing, SegmentedControl } from "@/components/kit";
import { Button, StatusDot } from "@/components/ui";
import { Editor } from "@/features/editor/Editor";
import { ProcessPanel } from "@/features/jobs/ProcessPanel";
import { ExportMenu } from "@/features/studio/ExportMenu";
import { CueList } from "@/features/player/CueList";
import { Player } from "@/features/player/Player";
import { Timeline } from "@/features/player/Timeline";
import { appendCues, cuesDuration, formatClock, mergeServerTrack, normalizeCues, transcriptCues } from "@/lib/cues";
import { displayTitle } from "@/lib/format";
import { languageLabel } from "@/lib/i18n";
import { isActive } from "@/lib/status";
import { cuesFromEvent, useJobEvents } from "@/lib/useJobEvents";
import { useJobProgress } from "@/lib/useJobProgress";
import { findCueIndex, inRanges, mergeCoverage } from "@/lib/subtitleSync";
import { useLiveTrack, type LiveCueBatch } from "@/lib/useLiveTrack";
import { postJson } from "@/services/client";
import type { Cue, Job, VideoProject } from "@/types/domain";

export function WatchStudio({
  project,
  job,
  tracks,
}: {
  project: VideoProject;
  job: Job | null;
  tracks: Record<string, Cue[]>;
}) {
  const { t, locale } = useI18n();

  const [currentTracks, setCurrentTracks] = useState(tracks);
  const languages = useMemo(() => Object.keys(currentTracks), [currentTracks]);

  const [sourceLanguage, setSourceLanguage] = useState(project.source_language || "und");
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(null);
  const initialLanguage = useMemo(() => {
    const target = project.target_languages.find((code) => code && code !== sourceLanguage);
    return target || sourceLanguage || project.target_languages[0] || "es";
  }, [project.target_languages, sourceLanguage]);
  const language = chosenLanguage ?? initialLanguage;
  const setLanguage = setChosenLanguage;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [panel, setPanel] = useState<"subtitles" | "editor" | "production">("subtitles");
  const reduceMotion = useReducedMotion();
  const [producing, setProducing] = useState(false);
  const [produceError, setProduceError] = useState("");

  const [timeMs, setTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(project.duration_ms || 0);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const seekRef = useRef<(ms: number) => void>(() => undefined);

  const [liveEnabled, setLiveEnabled] = useState(true);

  const cues = useMemo(() => currentTracks[language] || [], [currentTracks, language]);
  const timelineDuration = Math.max(durationMs, cuesDuration(cues), 1000);
  const activeIndex = cues[findCueIndex(cues, timeMs)]?.index ?? null;
  const [serverCoverage, setServerCoverage] = useState<Record<string, number>>({});

  const seek = useCallback((ms: number) => seekRef.current(ms), [seekRef]);

  const loadSeq = useRef(0);
  const appliedSeq = useRef(0);
  const loadTracks = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const response = await fetch(`/api/subtitles/${project.id}`, { credentials: "include" });
      if (!response.ok) return;
      const data = (await response.json()) as {
        subtitles: { language: string; cues: Cue[]; covered_ms?: number }[];
      };
      if (seq < appliedSeq.current) return;
      appliedSeq.current = seq;
      setServerCoverage((current) =>
        mergeCoverage(
          current,
          Object.fromEntries((data.subtitles || []).map((track) => [track.language, Number(track.covered_ms ?? 0)])),
        ),
      );
      setCurrentTracks((current) => {
        const next: Record<string, Cue[]> = { ...current };
        for (const track of data.subtitles || []) {
          next[track.language] = mergeServerTrack(track.cues, current[track.language] ?? [], track.language);
        }
        return next;
      });
    } catch {
    }
  }, [project.id]);

  const loadProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/videos/${project.id}`, { credentials: "include" });
      if (!response.ok) return;
      const data = (await response.json()) as { video: VideoProject };
      if (data.video?.source_language) setSourceLanguage(data.video.source_language);
      if (data.video?.duration_ms) setDurationMs(data.video.duration_ms);
    } catch {
    }
  }, [project.id]);

  const onSettled = useCallback(() => {
    void loadTracks();
    void loadProject();
  }, [loadTracks, loadProject]);

  const { job: currentJob, cancel, retry, refresh, setJob } = useJobProgress(job, onSettled);

  const loadedCueMark = useRef(0);
  const cueMark = currentJob?.last_cue_ms ?? 0;
  useEffect(() => {
    if (cueMark <= 0 || cueMark === loadedCueMark.current) return;
    loadedCueMark.current = cueMark;
    void loadTracks();
  }, [cueMark, loadTracks]);

  const activeJobId = currentJob && isActive(currentJob.status) ? currentJob.id : null;
  const events = useJobEvents({
    jobId: activeJobId,
    onResync: () => {
      void loadTracks();
      void loadProject();
    },
    onFinished: (status) => {
      if (currentJob) setJob({ ...currentJob, status });
      void loadTracks();
      void loadProject();
    },
    onSubtitles: (event) => {
      if (event.source_language && event.source_language !== "und") {
        setSourceLanguage(event.source_language);
      }
      setCurrentTracks((current) => {
        const next = { ...current };
        const source = event.source_language || project.source_language || "es";
        const batches = event.cues_by_language ?? { [source]: event.cues ?? [] };
        for (const language of Object.keys(batches)) {
          const incoming = cuesFromEvent(event, language, (next[language]?.length ?? 0) + 1);
          if (incoming.length > 0) {
            next[language] = appendCues(next[language] ?? [], incoming, language);
          }
          console.debug(`[SUBTITLE] language=${language} +${incoming.length} (total ${next[language]?.length ?? 0})`);
        }
        return next;
      });
    },
  });

  const produce = useCallback(
    async (mode: "progressive" | "full") => {
      setProducing(true);
      setProduceError("");
      try {
        const created = await postJson<{ id: string; reused: boolean; mode: string }>(
          `/api/videos/${project.id}/produce`,
          { mode },
        );
        setJob({
          id: created.id,
          project_id: project.id,
          status: "QUEUED",
          progress: 0,
          stage: "QUEUED",
          error: "",
          updated_at: new Date().toISOString(),
          stage_history: [],
          mode: created.mode as Job["mode"],
          last_cue_ms: 0,
        });
      } catch {
        setProduceError(t("process.error"));
      } finally {
        setProducing(false);
      }
    },
    [project.id, setJob, t],
  );

  const processing =
    currentJob !== null && isActive(currentJob.status) && currentJob.status !== "PENDING";
  const readyToProduce = currentJob === null || currentJob.status === "PENDING";
  const editorLanguages = languages.length ? languages : [project.source_language || "es"];

  const coveredMs = useMemo(() => {
    if (!processing) return timelineDuration;
    const fromJob = currentJob?.last_cue_ms ?? 0;
    return Math.max(events.coveredMs, fromJob);
  }, [processing, events.coveredMs, currentJob?.last_cue_ms, timelineDuration]);

  const languageCoveredMs = Math.max(
    events.coverage[language] ?? 0,
    serverCoverage[language] ?? 0,
    language === sourceLanguage ? (currentJob?.last_cue_ms ?? 0) : 0,
    processing ? 0 : cuesDuration(cues),
  );

  const onLiveCues = useCallback((lang: string, batch: LiveCueBatch) => {
    const incoming = batch.map((cue) => ({
      index: 0,
      start_ms: Number(cue.start_ms),
      end_ms: Number(cue.end_ms),
      text: String(cue.text),
      speaker: "",
      language: lang,
      state: "final" as const,
    }));
    setCurrentTracks((current) => ({ ...current, [lang]: appendCues(current[lang] ?? [], incoming, lang) }));
  }, []);
  const live = useLiveTrack({
    projectId: project.id,
    video: videoElement,
    language,
    enabled: liveEnabled,
    onCues: onLiveCues,
    onSourceLanguage: setSourceLanguage,
  });
  const liveActive = live.status === "live" || live.status === "connecting";

  const languageFailed =
    events.failedLanguages.includes(language) || live.failed.includes(language);
  const liveRanges = live.coverage[language];
  const coveredAt = useCallback(
    (ms: number) => ms < languageCoveredMs || inRanges(liveRanges, ms),
    [languageCoveredMs, liveRanges],
  );

  const liveSourceCovered =
    (live.coverage[sourceLanguage] ?? []).find(([start]) => start <= 0)?.[1] ?? 0;
  const exportLanguages = Array.from(
    new Set([...project.target_languages, sourceLanguage].filter((code) => code && code !== "und")),
  );
  const processCovered = Math.max(coveredMs < timelineDuration ? coveredMs : 0, liveSourceCovered);

  const transcriptCount = useMemo(() => transcriptCues(cues).length, [cues]);
  const sourceTrack = language !== sourceLanguage ? currentTracks[sourceLanguage] : undefined;

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[90rem] grid-cols-1 gap-5">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-[1_1_24rem]">
          <Link
            href="/projects"
            className="group mb-2 inline-flex items-center gap-1.5 rounded-md text-sm text-muted hover:text-ink"
          >
            <Icon name="arrowLeft" className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
            {t("projects.title")}
          </Link>
          <h1
            title={project.title}
            className="line-clamp-2 break-words text-2xl font-semibold leading-tight tracking-[-0.025em] text-ink sm:text-[1.75rem]"
          >
            {displayTitle(project.title)}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {durationMs > 0 && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 font-mono tabular-nums text-ink-2">
                <Icon name="clock" className="h-3.5 w-3.5 text-subtle" />
                {formatClock(durationMs)}
              </span>
            )}
            <span className="inline-flex h-7 items-center rounded-full bg-surface-2 px-2.5 text-ink-2">
              <LangCode code={sourceLanguage} />
            </span>
            <Icon name="arrowRight" className="h-3.5 w-3.5 text-subtle" />
            <SegmentedControl
              size="sm"
              label={t("player.subtitles")}
              value={language}
              onChange={setLanguage}
              options={project.target_languages.map((code) => ({
                value: code,
                ariaLabel: languageLabel(locale, code),
                label: <LangCode code={code} />,
              }))}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {readyToProduce ? (
            <Button type="button" disabled={producing} onClick={() => void produce("progressive")}>
              <Icon name="spark" className="h-4 w-4" />
              {producing ? t("process.starting") : t("process.produce")}
            </Button>
          ) : processing ? (
            <button
              type="button"
              onClick={() => setPanel("production")}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent-soft px-3.5 text-sm font-medium text-accent-ink"
            >
              <ProgressRing value={currentJob?.progress ?? 0} size={16} stroke={2.5} />
              <span className="font-mono tabular-nums">{currentJob?.progress ?? 0}%</span>
              {t("process.processing")}
            </button>
          ) : null}
          <ExportMenu
            projectId={project.id}
            language={language}
            languages={exportLanguages}
            sourceLanguage={sourceLanguage}
            processing={processing}
          />
        </div>
      </header>

      {produceError && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {produceError}
        </p>
      )}

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_25rem] xl:grid-cols-[minmax(0,1fr)_27rem]">
        <div className="grid min-w-0 gap-4">
          <Player
            projectId={project.id}
            cues={cues}
            tracks={currentTracks}
            lang={language}
            onLangChange={setLanguage}
            durationMs={timelineDuration}
            timeMs={timeMs}
            onTimeChange={setTimeMs}
            onDurationChange={setDurationMs}
            sourceLanguage={sourceLanguage}
            targetLanguages={project.target_languages}
            seekRef={seekRef}
            onVideoElement={setVideoElement}
            liveEnabled={liveEnabled}
            onLiveToggle={setLiveEnabled}
            liveStatus={live.status}
            generating={processing || liveActive}
            coveredAt={coveredAt}
            holdForSubtitles={live.status === "live"}
            processing={processing}
            coveredMs={languageCoveredMs}
            trackFailed={languageFailed}
            poster={project.thumbnail_url}
            filmstripSrc={`/api/videos/${project.id}/storyboard`}
          />

          <Timeline
            cues={cues}
            durationMs={timelineDuration}
            timeMs={timeMs}
            activeIndex={activeIndex}
            selectedIndex={selectedIndex}
            coveredMs={processing ? languageCoveredMs : timelineDuration}
            labels={{
              title: t("studio.timeline"),
              zoomIn: t("timeline.zoomIn"),
              zoomOut: t("timeline.zoomOut"),
              empty: t("timeline.empty"),
              pending: processing ? t("timeline.pending") : undefined,
            }}
            onSeek={seek}
            onSelect={(cue) => setSelectedIndex(cue.index)}
            filmstripSrc={`/api/videos/${project.id}/storyboard`}
          />
        </div>

        <aside className="grid min-w-0 gap-3 lg:sticky lg:top-[4.5rem]">
          <div role="tablist" aria-label={t("studio.tabs")} className="grid grid-cols-3 gap-0.5 rounded-[10px] bg-nav p-[3px]">
            {(
              [
                { key: "subtitles", label: t("studio.transcript"), badge: String(transcriptCount) },
                { key: "editor", label: t("editor.title"), badge: "" },
                { key: "production", label: t("process.title"), badge: "" },
              ] as const
            ).map((tab) => {
              const selected = panel === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`tab-${tab.key}`}
                  aria-selected={selected}
                  aria-controls={`panel-${tab.key}`}
                  data-no-press
                  onClick={() => setPanel(tab.key)}
                  className={`relative inline-flex h-8 items-center justify-center gap-1.5 rounded-[7px] px-2 text-sm font-medium transition-colors duration-150 ${
                    selected ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {selected && (
                    <motion.span
                      layoutId="studio-tab"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", duration: 0.32, bounce: 0 }}
                      className="absolute inset-0 rounded-[7px] bg-nav-active shadow-[var(--shadow-card)]"
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                  {tab.badge && (
                    <span className="relative font-mono text-[0.6875rem] tabular-nums text-subtle">{tab.badge}</span>
                  )}
                  {tab.key === "production" && processing && (
                    <span className="relative">
                      <StatusDot tone="accent" pulse />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {panel === "subtitles" && (
            <div role="tabpanel" id="panel-subtitles" aria-labelledby="tab-subtitles" className="enter-fade">
              {transcriptCount > 0 ? (
                <CueList
                  cues={cues}
                  activeIndex={activeIndex}
                  selectedIndex={selectedIndex}
                  onSelect={(cue) => setSelectedIndex(cue.index)}
                  onSeek={seek}
                  sourceCues={sourceTrack}
                  heightClass="max-h-[28rem] lg:max-h-[calc(100dvh-12rem)]"
                />
              ) : (
                <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
                  {processing || liveActive ? (
                    <div className="grid w-full max-w-[16rem] gap-2.5" aria-hidden="true">
                      {[0, 1, 2].map((row) => (
                        <div key={row} className="flex gap-3">
                          <div className="skeleton h-3 w-9 rounded" />
                          <div className="skeleton h-3 flex-1 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Icon name="captions" className="h-6 w-6 text-subtle" />
                  )}
                  <p className="max-w-[28ch] text-sm leading-6 text-muted">
                    {processing || liveActive ? t("timeline.pending") : t("timeline.empty")}
                  </p>
                </div>
              )}
            </div>
          )}

          {panel === "editor" && (
            <div role="tabpanel" id="panel-editor" aria-labelledby="tab-editor" className="enter-fade">
              <Editor
                projectId={project.id}
                cues={cues}
                language={language}
                onLanguageChange={setLanguage}
                languages={editorLanguages}
                selectedIndex={selectedIndex}
                processing={processing}
                onCuesChange={(next) =>
                  setCurrentTracks((current) => ({ ...current, [language]: normalizeCues(next, language) }))
                }
                onSelect={(cue) => setSelectedIndex(cue.index)}
                onSeek={seek}
              />
            </div>
          )}

          {panel === "production" && (
            <div role="tabpanel" id="panel-production" aria-labelledby="tab-production" className="enter-fade">
              <ProcessPanel
                job={currentJob}
                eventsStatus={events.status}
                coveredMs={processCovered}
                durationMs={events.durationMs || timelineDuration}
                onCancel={cancel}
                onRetry={() => retry(project.id, "progressive")}
                onRefresh={() => currentJob && void refresh(currentJob.id)}
                onProduce={() => void produce("progressive")}
                eventsError={events.error}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
