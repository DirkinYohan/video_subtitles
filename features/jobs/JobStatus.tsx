"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Badge, Button, Progress } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { isActive, statusKey, statusTone } from "@/lib/status";
import type { Job } from "@/types/domain";

const STEPS: MessageKey[] = [
  "job.preparing",
  "job.audio",
  "job.language",
  "job.vad",
  "job.transcribing",
  "job.diarizing",
  "job.aligning",
  "job.quality",
  "job.validating",
  "job.translating",
  "job.subtitles",
  "job.done",
];

/** Etapa que reporta el backend -> índice de la lista visible. */
const STAGE_STEP: Record<string, number> = {
  PENDING: 0,
  QUEUED: 0,
  PREPARING: 0,
  MEDIA_PREP: 1,
  T01_MEDIA_VALIDATION: 1,
  T02_AUDIO_EXTRACTION: 1,
  T03_AUDIO_PREPROCESSING: 1,
  LID: 2,
  T05_LID: 2,
  VAD: 3,
  T04_VAD: 3,
  ASR: 4,
  T06_ASR: 4,
  TIMESTAMPS: 4,
  T07_TIMESTAMPS: 4,
  DIARIZATION: 5,
  T08_DIARIZATION: 5,
  ALIGNMENT: 6,
  T09_ALIGNMENT: 6,
  QUALITY: 7,
  T10_QUALITY: 7,
  VALIDATION: 8,
  T11_VALIDATION: 8,
  METRICS: 8,
  T12_METRICS: 8,
  OUTPUT: 8,
  T13_OUTPUT: 8,
  TRANSLATING: 9,
  GENERATING_SUBTITLES: 10,
  COMPLETED: 11,
  PARTIAL: 11,
  // Etapas del flujo progresivo por ventanas.
  EXTRACTING_AUDIO: 1,
  ANALYZING_AUDIO: 2,
  PROCESSING_WINDOW: 4,
  CUES_READY: 10,
  FINALIZING: 10,
};

function stepIndex(job: Job): number {
  if (job.status === "COMPLETED") return STEPS.length - 1;
  const key = String(job.stage || "").toUpperCase();
  if (key in STAGE_STEP) return STAGE_STEP[key] ?? 0;
  if (key.startsWith("T15")) return 9;
  if (job.status === "TRANSCRIBING") return 4;
  if (job.status === "TRANSLATING") return 9;
  if (job.status === "GENERATING_SUBTITLES") return 10;
  return 0;
}

/**
 * Paso más avanzado alcanzado según el historial del SERVIDOR.
 *
 * El sondeo puede llegar tarde y saltarse etapas cortas (VAD, subtítulos);
 * el historial persistido es la fuente fiable de lo que ya ocurrió.
 */
function reachedStep(job: Job): number {
  let reached = stepIndex(job);
  for (const entry of job.stage_history || []) {
    const index = STAGE_STEP[String(entry.stage || "").toUpperCase()];
    if (typeof index === "number" && index > reached) reached = index;
  }
  if (job.status === "COMPLETED") reached = STEPS.length - 1;
  return reached;
}

/**
 * Panel de estado. NO sondea: recibe el job ya resuelto por `useJobProgress`,
 * de modo que existe una única fuente de progreso en toda la aplicación.
 */
export function JobStatus({
  job,
  error,
  onCancel,
  onRetry,
}: {
  job: Job | null;
  error?: string;
  onCancel: () => Promise<boolean>;
  onRetry: () => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  if (!job) return <p className="text-sm text-muted">{t("job.empty")}</p>;
  const current = job;
  const failed = current.status === "FAILED" || current.status === "CANCELLED";
  const index = failed ? -1 : reachedStep(current);

  async function run(action: () => Promise<boolean>) {
    setBusy(true);
    await action();
    setBusy(false);
  }

  return (
    <div className="grid min-w-0 gap-4 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={statusTone(current.status)}>{t(statusKey(current.status))}</Badge>
        <span className="text-sm font-semibold tabular-nums text-muted">{current.progress}%</span>
      </div>
      <Progress value={current.progress} />
      <ol className="grid gap-1.5">
        {STEPS.map((key, step) => (
          <li
            key={key}
            aria-current={step === index ? "step" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm ${step === index ? "font-semibold text-accent" : step < index ? "text-ok" : "text-muted"}`}
          >
            <span
              aria-hidden
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${step < index ? "bg-ok-soft text-ok" : step === index ? "bg-accent text-white" : "bg-paper text-muted"}`}
            >
              {step < index ? "✓" : step === index ? "●" : "○"}
            </span>
            {t(key)}
          </li>
        ))}
      </ol>
      {current.status === "FAILED" && (
        <p role="alert" className="break-words rounded-xl bg-danger-soft p-3 text-sm leading-5 text-danger">
          {t("job.failed")}
          {current.error ? `: ${current.error}` : ""}
        </p>
      )}
      {current.status === "CANCELLED" && <p role="status" className="text-sm text-muted">{t("job.cancelled")}</p>}
      {current.error && current.status !== "FAILED" && <p role="status" className="text-sm text-warn">{current.error}</p>}
      {error && <p role="alert" className="text-sm text-danger">{t("job.connectionError")}</p>}
      {isActive(current.status) && (
        <Button type="button" className="w-full" variant="secondary" disabled={busy} onClick={() => void run(onCancel)}>
          {t("job.cancel")}
        </Button>
      )}
      {current.status === "FAILED" && (
        <Button type="button" className="w-full" disabled={busy} onClick={() => void run(onRetry)}>
          {t("job.retry")}
        </Button>
      )}
    </div>
  );
}
