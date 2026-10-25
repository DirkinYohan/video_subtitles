"use client";

import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Button, Progress, StatusDot } from "@/components/ui";
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
    <section className="grid gap-3 rounded-xl border border-line bg-surface p-3.5" aria-label={t("process.title")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{t("process.title")}</p>
        {active && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <StatusDot
              tone={eventsStatus === "live" ? "ok" : "warn"}
              pulse={eventsStatus !== "live"}
            />
            {eventsStatus === "live" ? t("process.live") : t("process.connecting")}
          </span>
        )}
      </div>

      {ready && (
        <>
          <p className="text-sm leading-6 text-muted">{t("process.readyHint")}</p>
          <Button type="button" onClick={onProduce}>
            <Icon name="spark" className="h-4 w-4" />
            {t("process.produce")}
          </Button>
        </>
      )}

      {active && (
        <>
          <Progress value={percent} label={t("process.title")} />

          <dl className="grid gap-1.5 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">{t("process.processed")}</dt>
              <dd className="tabular font-medium text-ink">
                {formatClock(covered)} / {total > 0 ? formatClock(total) : "--:--"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">{t("process.available")}</dt>
              <dd className="tabular font-medium text-ink">
                {covered > 0
                  ? `${t("process.upTo")} ${formatClock(covered)}`
                  : t("process.noneYet")}
              </dd>
            </div>
          </dl>

          <p className="text-xs leading-5 text-subtle">{t("process.background")}</p>

          <Button type="button" variant="secondary" size="sm" onClick={() => void onCancel()}>
            {t("job.cancel")}
          </Button>
        </>
      )}

      {finished && (
        <div className="grid gap-0.5">
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-ok">
            <Icon name="check" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{t("process.completed")}</span>
          </p>
          <p className="tabular pl-6 text-xs text-subtle">
            {job?.stage_history?.length ?? 0} {t("process.stages")}
          </p>
        </div>
      )}

      {failed && (
        <>
          <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-danger">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">
              {status === "CANCELLED" ? t("job.cancelled") : t("process.failed")}
              {job?.error ? `: ${job.error}` : ""}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void onRetry()}>
              {t("job.retry")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onRefresh}>
              {t("job.refresh")}
            </Button>
          </div>
        </>
      )}

      {eventsError && (
        <p role="alert" className="text-xs leading-5 text-warn">
          {eventsError}
        </p>
      )}
    </section>
  );
}
