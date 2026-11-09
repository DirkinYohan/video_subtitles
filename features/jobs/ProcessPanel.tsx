"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { ProgressRing } from "@/components/kit";
import { Button, StatusDot } from "@/components/ui";
import { formatClock } from "@/lib/cues";
import type { MessageKey } from "@/lib/i18n";
import { isActive } from "@/lib/status";
import type { Job } from "@/types/domain";

type PhaseState = "pending" | "running" | "done" | "error";

/* Etapas reales del backend agrupadas en fases legibles. */
type Tr = (key: MessageKey) => string;
const PHASES: { key: string; label: (t: Tr) => string; stages: string[] }[] = [
  { key: "phase.analysis", label: (t: Tr) => t("phase.analysis"), stages: ["QUEUED", "PREPARING", "MEDIA_PREP", "EXTRACTING_AUDIO", "ANALYZING_AUDIO", "VAD", "LID"] },
  { key: "phase.transcription", label: (t: Tr) => t("phase.transcription"), stages: ["ASR", "TIMESTAMPS", "PROCESSING_WINDOW", "DIARIZATION", "ALIGNMENT"] },
  { key: "phase.quality", label: (t: Tr) => t("phase.quality"), stages: ["QUALITY", "VALIDATION", "METRICS", "OUTPUT"] },
  { key: "phase.translation", label: (t: Tr) => t("phase.translation"), stages: ["TRANSLATING"] },
  { key: "phase.subtitles", label: (t: Tr) => t("phase.subtitles"), stages: ["CUES_READY", "GENERATING_SUBTITLES", "FINALIZING", "COMPLETED"] },
];

const STAGE_LABEL: Record<string, MessageKey> = {
  QUEUED: "status.QUEUED",
  PREPARING: "job.preparing",
  MEDIA_PREP: "job.audio",
  EXTRACTING_AUDIO: "job.audio",
  ANALYZING_AUDIO: "job.audio",
  VAD: "job.vad",
  LID: "job.language",
  ASR: "job.transcribing",
  TIMESTAMPS: "job.transcribing",
  PROCESSING_WINDOW: "job.transcribing",
  DIARIZATION: "job.diarizing",
  ALIGNMENT: "job.aligning",
  QUALITY: "job.quality",
  VALIDATION: "job.validating",
  METRICS: "job.validating",
  OUTPUT: "job.validating",
  TRANSLATING: "job.translating",
  CUES_READY: "job.subtitles",
  GENERATING_SUBTITLES: "job.subtitles",
  FINALIZING: "job.subtitles",
  COMPLETED: "job.done",
};

function normalizeStage(stage: string): string {
  const key = String(stage || "").toUpperCase();
  if (key.startsWith("T15")) return "TRANSLATING";
  const map: Record<string, string> = {
    T01_MEDIA_VALIDATION: "MEDIA_PREP",
    T02_AUDIO_EXTRACTION: "MEDIA_PREP",
    T03_AUDIO_PREPROCESSING: "MEDIA_PREP",
    T04_VAD: "VAD",
    T05_LID: "LID",
    T06_ASR: "ASR",
    T07_TIMESTAMPS: "TIMESTAMPS",
    T08_DIARIZATION: "DIARIZATION",
    T09_ALIGNMENT: "ALIGNMENT",
    T10_QUALITY: "QUALITY",
    T11_VALIDATION: "VALIDATION",
    T12_METRICS: "METRICS",
    T13_OUTPUT: "OUTPUT",
    T14_CLEANUP: "COMPLETED",
    PENDING: "QUEUED",
  };
  return map[key] ?? key;
}

function phaseIndex(stage: string): number {
  const key = normalizeStage(stage);
  return PHASES.findIndex((phase) => phase.stages.includes(key));
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes === 0 ? `${seconds} s` : `${minutes} min ${seconds} s`;
}

export function ProcessPanel({
  job,
  eventsStatus,
  coveredMs,
  durationMs,
  eventsError,
  onCancel,
  onRetry,
  onRefresh,
  onProduce,
}: {
  job: Job | null;
  eventsStatus: "idle" | "connecting" | "live" | "closed";
  coveredMs: number;
  durationMs: number;
  eventsError?: string;
  onCancel: () => Promise<boolean>;
  onRetry: () => Promise<boolean>;
  onRefresh: () => void;
  onProduce: () => void;
}) {
  const { t } = useI18n();
  const status = job?.status ?? "";
  const active = job !== null && isActive(status) && status !== "PENDING";
  const ready = job === null || status === "PENDING";
  const finished = status === "COMPLETED" || status === "SUCCESS" || status === "PARTIAL";
  const failed = status === "FAILED" || status === "CANCELLED";
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const history = useMemo(() => job?.stage_history ?? [], [job?.stage_history]);
  const startedAt = history.length > 0 ? new Date(history[0]?.at ?? "").getTime() : NaN;
  const lastAt = history.length > 0 ? new Date(history[history.length - 1]?.at ?? "").getTime() : NaN;
  const elapsed = Number.isFinite(startedAt) ? Math.max(0, (active ? now || lastAt : lastAt) - startedAt) : 0;
  const percent = Math.max(0, Math.min(100, job?.progress ?? 0));
  const remaining = active && percent >= 5 && elapsed > 0 ? (elapsed * (100 - percent)) / percent : 0;

  const reached = useMemo(() => {
    let max = job ? phaseIndex(job.stage) : -1;
    for (const entry of history) max = Math.max(max, phaseIndex(entry.stage));
    return max;
  }, [history, job]);
  const currentPhase = job ? Math.max(0, phaseIndex(job.stage)) : 0;

  const phaseState = (index: number): PhaseState => {
    if (finished) return "done";
    if (failed) return index < currentPhase ? "done" : index === currentPhase ? "error" : "pending";
    if (index < currentPhase || index < reached) return "done";
    if (index === currentPhase && active) return "running";
    return "pending";
  };

  const stagesOf = (index: number) => {
    const phase = PHASES[index];
    if (!phase) return [];
    const seen = new Map<string, MessageKey>();
    for (const entry of history) {
      const key = normalizeStage(entry.stage);
      if (phase.stages.includes(key) && STAGE_LABEL[key]) seen.set(STAGE_LABEL[key] as string, STAGE_LABEL[key] as MessageKey);
    }
    return Array.from(seen.values());
  };

  const covered = Math.max(coveredMs, job?.last_cue_ms ?? 0);
  const currentLabel = job ? STAGE_LABEL[normalizeStage(job.stage)] : undefined;

  async function run(action: () => Promise<boolean>) {
    setBusy(true);
    await action();
    setBusy(false);
  }

  const phaseList = (
    <ol className="grid gap-0.5">
      {PHASES.map((phase, index) => {
        const state = phaseState(index);
        const open = expanded === index;
        const stages = stagesOf(index);
        return (
          <li key={phase.key}>
            <button
              type="button"
              aria-expanded={open}
              disabled={stages.length === 0}
              onClick={() => setExpanded(open ? null : index)}
              className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <PhaseIcon state={state} />
              <span
                className={`flex-1 ${
                  state === "running" ? "font-medium text-ink" : state === "pending" ? "text-subtle" : state === "error" ? "text-danger" : "text-ink-2"
                }`}
              >
                {phase.label(t)}
              </span>
              {stages.length > 0 && (
                <Icon
                  name="chevron"
                  className={`h-3.5 w-3.5 text-subtle transition-transform duration-200 ease-[var(--ease-standard)] ${open ? "rotate-180" : ""}`}
                />
              )}
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.ul
                  initial={{ opacity: 0, transform: "translateY(-4px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ type: "spring", duration: 0.24, bounce: 0 }}
                  className="pl-9"
                >
                  {stages.map((key) => (
                    <li key={key} className="flex items-center gap-2 py-1 text-xs text-muted">
                      <Icon name="check" className="h-3 w-3 text-ok" weight="bold" />
                      {t(key)}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ol>
  );

  return (
    <section className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label={t("process.title")}>
      {ready && (
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
              <Icon name="spark" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{t("process.readyTitle")}</p>
              <p className="mt-1 text-caption leading-5 text-muted">{t("process.readyHint")}</p>
            </div>
          </div>
          <Button type="button" className="min-h-10" onClick={onProduce}>
            <Icon name="spark" className="h-4 w-4" />
            {t("process.produce")}
          </Button>
        </div>
      )}

      {active && (
        <>
          <div className="flex items-center gap-4">
            <div className="relative grid place-items-center">
              <ProgressRing value={percent} size={64} stroke={5} label={t("process.title")} />
              <span className="absolute font-mono text-sm font-semibold tabular-nums text-ink">{percent}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ProgressRing indeterminate size={14} stroke={2} />
                <span className="truncate">{currentLabel ? t(currentLabel) : t("process.processing")}</span>
              </p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 text-xs">
                <div>
                  <dt className="text-subtle">{t("process.elapsed")}</dt>
                  <dd className="font-mono tabular-nums text-ink-2">{formatClock(elapsed)}</dd>
                </div>
                <div>
                  <dt className="text-subtle">{t("process.remaining")}</dt>
                  <dd className="font-mono tabular-nums text-ink-2">{remaining > 0 ? `~${formatClock(remaining)}` : "--:--"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            <StatusDot tone={eventsStatus === "live" ? "ok" : "warn"} pulse={eventsStatus !== "live"} />
            {eventsStatus === "live" ? t("process.live") : t("process.connecting")}
            <span className="text-subtle">·</span>
            {covered > 0 ? (
              <span>
                {t("process.available")} {t("process.upTo")}{" "}
                <span className="font-mono tabular-nums text-ink-2">{formatClock(covered)}</span>
                {durationMs > 0 && <span className="font-mono tabular-nums"> / {formatClock(durationMs)}</span>}
              </span>
            ) : (
              <span>{t("process.noneYet")}</span>
            )}
          </p>

          {phaseList}

          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-xs leading-5 text-subtle">{t("process.background")}</p>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void run(onCancel)}>
              {t("job.cancel")}
            </Button>
          </div>
        </>
      )}

      {finished && (
        <div>
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((value) => !value)}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span role="status" className="block text-sm font-semibold text-ink">
                {t("process.completed")}
              </span>
              <span className="block text-xs text-muted">
                {history.length} {t("process.stages")}
                {elapsed > 0 && ` · ${formatDuration(elapsed)}`}
              </span>
            </span>
            <Icon
              name="chevron"
              className={`h-4 w-4 text-subtle transition-transform duration-200 ease-[var(--ease-standard)] ${detailsOpen ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {detailsOpen && (
              <motion.div
                initial={{ opacity: 0, transform: "translateY(-4px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ type: "spring", duration: 0.26, bounce: 0 }}
              >
                <div className="pt-3">{phaseList}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {failed && (
        <>
          <div role="alert" className="flex items-start gap-3 rounded-xl bg-danger-soft px-3.5 py-3">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-danger" weight="bold" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-danger">
                {status === "CANCELLED" ? t("job.cancelled") : t("process.failed")}
              </p>
              {job?.error && <p className="mt-1 break-words text-xs leading-5 text-danger/90">{job.error}</p>}
            </div>
          </div>
          {phaseList}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void run(onRetry)}>
              <Icon name="retry" className="h-4 w-4" />
              {t("job.retry")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onRefresh}>
              {t("job.refresh")}
            </Button>
          </div>
        </>
      )}

      {eventsError && (
        <p role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-xs leading-5 text-warn">
          {eventsError}
        </p>
      )}
    </section>
  );
}

function PhaseIcon({ state }: { state: PhaseState }) {
  if (state === "done") {
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok text-surface">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  if (state === "running") return <ProgressRing indeterminate size={20} stroke={2.5} />;
  if (state === "error") {
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-danger text-surface">
        <Icon name="close" className="h-3 w-3" weight="bold" />
      </span>
    );
  }
  return <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-line-strong" />;
}
