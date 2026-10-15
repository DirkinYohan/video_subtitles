"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button, Progress } from "@/components/ui";
import { formatClock } from "@/lib/cues";
import { isActive } from "@/lib/status";
import type { Job } from "@/types/domain";

/**
 * Panel de producción: separa claramente el procesamiento en segundo plano del
 * estado de la reproducción. Muestra hasta qué minuto hay subtítulos listos.
 */
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
  const finished = status === "COMPLETED";
  const failed = status === "FAILED" || status === "CANCELLED";

  const total = durationMs > 0 ? durationMs : 0;
  const covered = Math.max(coveredMs, job?.last_cue_ms ?? 0);
  const percent = job?.progress ?? 0;

  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-paper/60 p-3.5" aria-label={t("process.title")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{t("process.title")}</p>
        {active && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${eventsStatus === "live" ? "bg-ok" : "bg-warn"}`}
            />
            {eventsStatus === "live" ? t("process.live") : t("process.connecting")}
          </span>
        )}
      </div>

      {ready && (
        <>
          <p className="text-sm text-muted">{t("process.readyHint")}</p>
          <Button type="button" onClick={onProduce}>{t("process.produce")}</Button>
        </>
      )}

      {active && (
        <>
          <Progress value={percent} label={t("process.title")} />
          <dl className="grid gap-1 text-xs text-muted">
            <div className="flex justify-between gap-2">
              <dt>{t("process.processed")}</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatClock(covered)} / {total > 0 ? formatClock(total) : "--:--"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>{t("process.available")}</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {covered > 0 ? `${t("process.upTo")} ${formatClock(covered)}` : t("process.noneYet")}
              </dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-muted">{t("process.background")}</p>
          <Button type="button" variant="secondary" onClick={() => void onCancel()}>{t("job.cancel")}</Button>
        </>
      )}

      {finished && (
        <p role="status" className="text-sm font-medium text-ok">
          {t("process.completed")} · {job?.stage_history?.length ?? 0} {t("process.stages")}
        </p>
      )}

      {failed && (
        <>
          <p role="alert" className="text-sm text-danger">
            {status === "CANCELLED" ? t("job.cancelled") : t("process.failed")}
            {job?.error ? `: ${job.error}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void onRetry()}>{t("job.retry")}</Button>
            <Button type="button" variant="ghost" onClick={onRefresh}>{t("job.refresh")}</Button>
          </div>
        </>
      )}

      {eventsError && <p role="alert" className="text-xs text-warn">{eventsError}</p>}
    </section>
  );
}
