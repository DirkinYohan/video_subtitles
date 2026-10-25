"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Button, StatusDot, buttonClass } from "@/components/ui";
import { Editor } from "@/features/editor/Editor";
import { ProcessPanel } from "@/features/jobs/ProcessPanel";
import { Player } from "@/features/player/Player";
import { Timeline } from "@/features/player/Timeline";
import { appendCues, cuesDuration, mergeServerTrack, normalizeCues } from "@/lib/cues";
import { languageLabel } from "@/lib/i18n";
import { flag } from "@/lib/languages";
import { isActive } from "@/lib/status";
import { cuesFromEvent, useJobEvents } from "@/lib/useJobEvents";
import { useJobProgress } from "@/lib/useJobProgress";
import { useLiveSubtitles } from "@/lib/useLiveSubtitles";
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

  // --- Única fuente de verdad de los subtítulos ---------------------------
  const [currentTracks, setCurrentTracks] = useState(tracks);
  const languages = useMemo(() => Object.keys(currentTracks), [currentTracks]);

  const [sourceLanguage, setSourceLanguage] = useState(project.source_language || "und");
  // Idioma elegido EXPLÍCITAMENTE por el usuario. Mientras no elija, se deriva.
  //
  // Antes el idioma inicial salía de las pistas cargadas al montar. En un
  // proyecto recién subido no hay ninguna, así que quedaba en el idioma de
  // origen declarado ("und" con detección automática): los cues que llegaban
  // por WebSocket ("en", "es", "fr"…) nunca coincidían y el reproductor no
  // mostraba nada hasta recargar la página con el trabajo terminado.
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(null);
  const defaultLanguage = useMemo(() => {
    const candidates = [
      ...project.target_languages.filter((code) => code !== sourceLanguage),
      sourceLanguage,
      ...languages,
    ].filter((code) => code && code !== "und");
    return (
      candidates.find((code) => (currentTracks[code]?.length ?? 0) > 0) ??
      candidates[0] ??
      languages[0] ??
      "es"
    );
  }, [project.target_languages, sourceLanguage, languages, currentTracks]);
  const language = chosenLanguage ?? defaultLanguage;
  const setLanguage = setChosenLanguage;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [producing, setProducing] = useState(false);
  const [produceError, setProduceError] = useState("");

  // --- Tiempo de reproducción (compartido por timeline y editor) ----------
  const [timeMs, setTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(project.duration_ms || 0);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const seekRef = useRef<(ms: number) => void>(() => undefined);

  // --- Modo en vivo (independiente del procesamiento en segundo plano) ----
  const [liveEnabled, setLiveEnabled] = useState(false);
  const live = useLiveSubtitles({
    video: videoElement,
    sourceLanguage,
    targets: project.target_languages,
    enabled: liveEnabled,
  });

  const cues = currentTracks[language] || [];
  const timelineDuration = Math.max(durationMs, cuesDuration(cues), 1000);
  const activeIndex = cues.find((cue) => cue.start_ms <= timeMs && timeMs < cue.end_ms)?.index ?? null;

  const seek = useCallback((ms: number) => seekRef.current(ms), [seekRef]);

  const loadTracks = useCallback(async () => {
    try {
      const response = await fetch(`/api/subtitles/${project.id}`, { credentials: "include" });
      if (!response.ok) return;
      const data = (await response.json()) as { subtitles: { language: string; cues: Cue[] }[] };
      // Se FUSIONA con lo local: una respuesta pedida antes de un evento
      // WebSocket no puede borrar los cues que ese evento ya añadió.
      setCurrentTracks((current) => {
        const next: Record<string, Cue[]> = { ...current };
        for (const track of data.subtitles || []) {
          next[track.language] = mergeServerTrack(track.cues, current[track.language] ?? [], track.language);
        }
        return next;
      });
    } catch {
      /* se reintenta al siguiente evento */
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
      /* sin cambios */
    }
  }, [project.id]);

  const onSettled = useCallback(() => {
    void loadTracks();
    void loadProject();
  }, [loadTracks, loadProject]);

  const { job: currentJob, cancel, retry, refresh, setJob } = useJobProgress(job, onSettled);

  // --- Respaldo sin WebSocket --------------------------------------------
  // El progreso llega por sondeo y trae `last_cue_ms`. Cuando el servidor
  // informa de subtítulos nuevos se recargan las pistas: así aparecen aunque
  // el WebSocket no llegue a establecerse.
  const loadedCueMark = useRef(0);
  const cueMark = currentJob?.last_cue_ms ?? 0;
  useEffect(() => {
    if (cueMark <= 0 || cueMark === loadedCueMark.current) return;
    loadedCueMark.current = cueMark;
    void loadTracks();
  }, [cueMark, loadTracks]);

  // --- Subtítulos en vivo por WebSocket -----------------------------------
  // Se conecta mientras hay un job en curso: los cues llegan por evento y se
  // añaden al reproductor sin recargar la página.
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
      // El idioma detectado llega con el primer lote: se refleja al momento.
      if (event.source_language && event.source_language !== "und") {
        setSourceLanguage(event.source_language);
      }
      setCurrentTracks((current) => {
        // El evento trae TODAS las pistas del lote: se añaden todas, no sólo la
        // seleccionada. Así cambiar de idioma es inmediato y no hay que
        // recargar ni volver a procesar.
        const next = { ...current };
        const source = event.source_language || project.source_language || "es";
        const batches = event.cues_by_language ?? { [source]: event.cues ?? [] };
        for (const language of Object.keys(batches)) {
          const incoming = cuesFromEvent(event, language, (next[language]?.length ?? 0) + 1);
          if (incoming.length > 0) {
            // Sin duplicar: el mismo lote puede llegar también por la recarga.
            next[language] = appendCues(next[language] ?? [], incoming, language);
          }
          console.debug(`[SUBTITLE] language=${language} +${incoming.length} (total ${next[language]?.length ?? 0})`);
        }
        return next;
      });
    },
  });

  // --- Botón «Producir» ----------------------------------------------------
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

  return (
    <div className="mx-auto grid min-w-0 max-w-7xl gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/projects"
            aria-label={t("studio.back")}
            className={`${buttonClass("secondary")} !h-9 !w-9 !px-0`}
          >
            <Icon name="arrowLeft" className="h-4 w-4" />
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink sm:text-xl">
            {project.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {readyToProduce ? (
            <Button type="button" disabled={producing} onClick={() => void produce("progressive")}>
              <Icon name="spark" className="h-4 w-4" />
              {producing ? t("process.starting") : t("process.produce")}
            </Button>
          ) : processing ? (
            <span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent-soft px-3 text-sm font-medium text-accent-ink">
              <StatusDot tone="accent" pulse />
              {t("process.processing")}
            </span>
          ) : null}
          <a className={buttonClass("secondary")} href={`/api/export/${project.id}/zip`}>
            <Icon name="download" className="h-4 w-4" />
            {t("project.export")}
          </a>
        </div>
      </div>

      {produceError && (
        <p role="alert" className="text-sm text-danger">
          {produceError}
        </p>
      )}

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="order-2 grid min-w-0 gap-4 overflow-hidden rounded-xl border border-line bg-surface p-3.5 lg:order-1 lg:sticky lg:top-20">
          {project.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.thumbnail_url}
              alt=""
              className="aspect-video w-full rounded-lg bg-surface-2 object-cover"
            />
          ) : (
            <div className="grid aspect-video w-full place-items-center rounded-lg bg-surface-2 text-xs text-muted">
              {t("project.noThumbnail")}
            </div>
          )}

          <div className="grid min-w-0 gap-2">
            <p className="truncate text-sm font-semibold text-ink">{project.title}</p>

            <dl className="grid min-w-0 gap-1.5 rounded-lg bg-surface-2 p-2.5 text-xs">
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <dt className="shrink-0 text-muted">{t("studio.source")}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-ink">
                  {flag(sourceLanguage)} {languageLabel(locale, sourceLanguage)}
                  {sourceLanguage === "und" && (
                    <span className="ml-1 font-normal text-subtle">({t("studio.auto")})</span>
                  )}
                </dd>
              </div>
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <dt className="shrink-0 text-muted">{t("studio.targets")}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-ink">
                  {project.target_languages
                    .map((code) => `${flag(code)} ${languageLabel(locale, code)}`)
                    .join(" · ")}
                </dd>
              </div>
            </dl>
          </div>

          <ProcessPanel
            job={currentJob}
            eventsStatus={events.status}
            coveredMs={events.coveredMs}
            durationMs={events.durationMs || timelineDuration}
            onCancel={cancel}
            onRetry={() => retry(project.id, "progressive")}
            onRefresh={() => currentJob && void refresh(currentJob.id)}
            onProduce={() => void produce("progressive")}
            eventsError={events.error}
          />
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
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
            selectedIndex={selectedIndex}
            onSelectCue={(cue) => setSelectedIndex(cue.index)}
            seekRef={seekRef}
            onVideoElement={setVideoElement}
            liveEnabled={liveEnabled}
            onLiveToggle={setLiveEnabled}
            liveStatus={live.status}
            liveEvent={live.event}
            processing={processing}
            coveredMs={events.coveredMs}
          />
        </div>
      </div>

      <Timeline
        cues={cues}
        durationMs={timelineDuration}
        timeMs={timeMs}
        activeIndex={activeIndex}
        selectedIndex={selectedIndex}
        coveredMs={events.coveredMs}
        labels={{
          title: t("studio.timeline"),
          zoomIn: t("timeline.zoomIn"),
          zoomOut: t("timeline.zoomOut"),
          empty: t("timeline.empty"),
          pending: processing ? t("timeline.pending") : undefined,
        }}
        onSeek={seek}
        onSelect={(cue) => setSelectedIndex(cue.index)}
      />

      <Editor
        projectId={project.id}
        cues={cues}
        language={language}
        onLanguageChange={setLanguage}
        languages={editorLanguages}
        selectedIndex={selectedIndex}
        onCuesChange={(next) =>
          setCurrentTracks((current) => ({ ...current, [language]: normalizeCues(next, language) }))
        }
        onSelect={(cue) => setSelectedIndex(cue.index)}
        onSeek={seek}
      />
    </div>
  );
}
