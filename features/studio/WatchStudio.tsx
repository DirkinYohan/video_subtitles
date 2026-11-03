"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Button, PageHeader, StatusDot } from "@/components/ui";
import { Editor } from "@/features/editor/Editor";
import { ProcessPanel } from "@/features/jobs/ProcessPanel";
import { ExportMenu } from "@/features/studio/ExportMenu";
import { CueList } from "@/features/player/CueList";
import { Player } from "@/features/player/Player";
import { Timeline } from "@/features/player/Timeline";
import { appendCues, cuesDuration, formatClock, mergeServerTrack, normalizeCues } from "@/lib/cues";
import { displayTitle } from "@/lib/format";
import { languageLabel } from "@/lib/i18n";
import { flag } from "@/lib/languages";
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

  // --- Única fuente de verdad de los subtítulos ---------------------------
  const [currentTracks, setCurrentTracks] = useState(tracks);
  const languages = useMemo(() => Object.keys(currentTracks), [currentTracks]);

  const [sourceLanguage, setSourceLanguage] = useState(project.source_language || "und");
  // Idioma elegido EXPLÍCITAMENTE por el usuario.
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(null);
  // El idioma inicial NO depende de las pistas que ya hayan llegado: antes se
  // recalculaba en cada lote y en cuanto entraba el original (en) saltaba de
  // «es» a «en» a mitad de reproducción, cambiando el idioma de los subtítulos
  // sin que el usuario lo pidiera.
  const initialLanguage = useMemo(() => {
    const target = project.target_languages.find((code) => code && code !== sourceLanguage);
    return target || sourceLanguage || project.target_languages[0] || "es";
  }, [project.target_languages, sourceLanguage]);
  const language = chosenLanguage ?? initialLanguage;
  const setLanguage = setChosenLanguage;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [panel, setPanel] = useState<"subtitles" | "production">("subtitles");
  const [producing, setProducing] = useState(false);
  const [produceError, setProduceError] = useState("");

  // --- Tiempo de reproducción (compartido por timeline y editor) ----------
  const [timeMs, setTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(project.duration_ms || 0);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const seekRef = useRef<(ms: number) => void>(() => undefined);

  // --- Modo en vivo: activo por defecto ----------------------------------
  // El servidor genera los subtítulos desde que termina la subida; el
  // reproductor se engancha a ese proceso y le dice qué se está viendo para
  // que lo prepare primero. Se puede apagar.
  const [liveEnabled, setLiveEnabled] = useState(true);

  const cues = currentTracks[language] || [];
  const timelineDuration = Math.max(durationMs, cuesDuration(cues), 1000);
  const activeIndex = cues[findCueIndex(cues, timeMs)]?.index ?? null;
  // Cobertura por idioma según el servidor (sobrevive a recargas de la página).
  const [serverCoverage, setServerCoverage] = useState<Record<string, number>>({});

  const seek = useCallback((ms: number) => seekRef.current(ms), [seekRef]);

  // Las recargas se solapan (evento, sondeo, reconexión). Una respuesta más
  // antigua que la última aplicada se descarta en lugar de sobrescribirla.
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

  // Hasta dónde hay subtítulos. Mientras el trabajo avanza, el reproductor no
  // debe adelantar a esta marca; con el trabajo terminado (o inexistente) no se
  // bloquea nada.
  const coveredMs = useMemo(() => {
    if (!processing) return timelineDuration;
    const fromJob = currentJob?.last_cue_ms ?? 0;
    return Math.max(events.coveredMs, fromJob);
  }, [processing, events.coveredMs, currentJob?.last_cue_ms, timelineDuration]);

  // Cobertura del idioma ELEGIDO. Las traducciones van por detrás del
  // original: usar la cobertura global hacía creer que un tramo ya tenía texto
  // en el idioma elegido cuando sólo lo tenía en el original.
  const languageCoveredMs = Math.max(
    events.coverage[language] ?? 0,
    serverCoverage[language] ?? 0,
    language === sourceLanguage ? (currentJob?.last_cue_ms ?? 0) : 0,
    processing ? 0 : cuesDuration(cues),
  );

  // --- Subtítulos en vivo (cuando «Producir» no está en marcha) -----------
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
    // También mientras el job está en curso: el job y el reproductor comparten
    // el MISMO proceso del servidor, que prioriza lo que se está viendo.
    enabled: liveEnabled,
    onCues: onLiveCues,
    onSourceLanguage: setSourceLanguage,
  });
  const liveActive = live.status === "live" || live.status === "connecting";

  const languageFailed =
    events.failedLanguages.includes(language) || live.failed.includes(language);
  // ¿Está procesado un instante en el idioma elegido? Por «Producir» (de
  // forma continua desde 0) o por el modo en vivo (tramos sueltos).
  const liveRanges = live.coverage[language];
  const coveredAt = useCallback(
    (ms: number) => ms < languageCoveredMs || inRanges(liveRanges, ms),
    [languageCoveredMs, liveRanges],
  );

  // El panel de producción mide lo preparado del ORIGINAL, venga del trabajo
  // o del modo en vivo (que empieza por la posición del reproductor).
  const liveSourceCovered =
    (live.coverage[sourceLanguage] ?? []).find(([start]) => start <= 0)?.[1] ?? 0;
  const processCovered = Math.max(coveredMs < timelineDuration ? coveredMs : 0, liveSourceCovered);

  return (
    <div className="mx-auto grid min-w-0 max-w-7xl gap-6">
      <PageHeader
        crumbs={[{ href: "/projects", label: t("projects.title") }]}
        title={<span title={project.title}>{displayTitle(project.title)}</span>}
        meta={
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {durationMs > 0 && (
              <span className="tabular inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 font-medium text-ink-2">
                <Icon name="clock" className="h-3.5 w-3.5 text-subtle" />
                {formatClock(durationMs)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 font-medium text-ink-2">
              {flag(sourceLanguage)} {sourceLanguage === "und" ? t("studio.auto") : languageLabel(locale, sourceLanguage)}
            </span>
            <Icon name="arrowRight" className="h-3.5 w-3.5 text-subtle" />
            {project.target_languages.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                aria-pressed={code === language}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-medium ${
                  code === language
                    ? "border-accent/40 bg-accent-soft text-accent-ink"
                    : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
                }`}
              >
                {flag(code)} {languageLabel(locale, code)}
              </button>
            ))}
          </div>
        }
        actions={
          <>
            {readyToProduce ? (
              <Button type="button" disabled={producing} onClick={() => void produce("progressive")}>
                <Icon name="spark" className="h-4 w-4" />
                {producing ? t("process.starting") : t("process.produce")}
              </Button>
            ) : processing ? (
              <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent-soft px-3.5 text-sm font-medium text-accent-ink">
                <StatusDot tone="accent" pulse />
                {t("process.processing")}
              </span>
            ) : null}
            <ExportMenu key={language} projectId={project.id} language={language} processing={processing} />
          </>
        }
      />

      {produceError && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {produceError}
        </p>
      )}

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]">
          <Player
            bare
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
          />

          {/* La pista vive en la misma superficie que el vídeo: vídeo,
              transporte y subtítulos se leen como una sola pieza. */}
          <Timeline
            bare
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

        {/* Panel lateral: los subtítulos siguen a la vista mientras se mira el
            vídeo; la producción, a un clic. */}
        <aside className="grid min-w-0 gap-3 lg:sticky lg:top-24">
          <div role="tablist" aria-label={t("studio.tabs")} className="grid grid-cols-2 gap-1 rounded-xl bg-nav p-1">
            {(
              [
                { key: "subtitles", label: t("player.cueList"), badge: String(cues.length) },
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
                  onClick={() => setPanel(tab.key)}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    selected ? "bg-nav-active text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                  {tab.badge && (
                    <span className="tabular rounded-md bg-surface-2 px-1.5 py-px text-[0.6875rem] text-muted">
                      {tab.badge}
                    </span>
                  )}
                  {tab.key === "production" && processing && <StatusDot tone="accent" pulse />}
                </button>
              );
            })}
          </div>

          {panel === "subtitles" ? (
            <div role="tabpanel" id="panel-subtitles" aria-labelledby="tab-subtitles" className="enter-fade">
              {cues.length > 0 ? (
                <CueList
                  cues={cues}
                  activeIndex={activeIndex}
                  selectedIndex={selectedIndex}
                  onSelect={(cue) => setSelectedIndex(cue.index)}
                  onSeek={seek}
                  showHeader={false}
                  heightClass="max-h-[28rem] lg:max-h-[calc(100dvh-13rem)]"
                />
              ) : (
                <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent-ink">
                    <Icon name="captions" className="h-5 w-5" />
                  </span>
                  <p className="max-w-[26ch] text-sm leading-6 text-muted">
                    {processing || liveActive ? t("timeline.pending") : t("timeline.empty")}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div role="tabpanel" id="panel-production" aria-labelledby="tab-production" className="enter-fade grid gap-3">
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
