"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Flag } from "@/components/Flag";
import { useI18n } from "@/components/I18nProvider";
import { Icon, type IconName } from "@/components/icons";
import { Sheet, SPRING } from "@/components/kit";
import { useToast } from "@/components/toast";
import { buttonClass } from "@/components/classes";
import { languageLabel } from "@/lib/i18n";
import { downloadDirect, publicApiBase } from "@/lib/direct";
import { getJson, postJson } from "@/services/client";

type RenderState = "idle" | "queued" | "running" | "done" | "stale" | "failed" | "unavailable";
type RenderStatus = { state: Exclude<RenderState, "unavailable">; progress: number; error: string };
type Format = "srt" | "vtt" | "ass" | "zip" | "mp4";

export function ExportMenu({
  projectId,
  language: initialLanguage,
  languages = [],
  sourceLanguage = "",
  processing = false,
}: {
  projectId: string;
  language: string;
  languages?: string[];
  sourceLanguage?: string;
  processing?: boolean;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const options = languages.length > 0 ? languages : [initialLanguage];
  const [language, setLanguage] = useState(options.includes(initialLanguage) ? initialLanguage : options[0]);
  const [format, setFormat] = useState<Format>("srt");
  const [render, setRender] = useState<{ state: RenderState; progress: number }>({ state: "idle", progress: 0 });
  const wantsDownload = useRef(false);

  const query = `lang=${encodeURIComponent(language ?? "")}`;
  const fileUrl = `/api/videos/${projectId}/render/file?${query}`;
  const busy = render.state === "queued" || render.state === "running";
  const label = languageLabel(locale, language ?? "");

  const refresh = useCallback(
    async (code: string = language ?? "") => {
      try {
        const status = await getJson<RenderStatus>(`/api/videos/${projectId}/render?lang=${encodeURIComponent(code)}`);
        setRender({ state: status.state, progress: status.progress });
      } catch {
        setRender({ state: "unavailable", progress: 0 });
      }
    },
    [projectId, language],
  );

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => window.clearInterval(timer);
  }, [busy, refresh]);

  useEffect(() => {
    if (render.state !== "done" || !wantsDownload.current) return;
    wantsDownload.current = false;
    void downloadDirect(fileUrl);
    toast.success(t("export.videoStarted"));
  }, [render.state, fileUrl, t, toast]);

  function choose(code: string) {
    if (code === language || busy) return;
    wantsDownload.current = false;
    setLanguage(code);
    setRender({ state: "idle", progress: 0 });
    void refresh(code);
  }

  function openSheet() {
    const next = !busy && options.includes(initialLanguage) ? initialLanguage : language;
    setLanguage(next);
    void refresh(next);
    setOpen(true);
  }

  async function prepare() {
    wantsDownload.current = true;
    setRender({ state: "queued", progress: 0 });
    try {
      const status = await postJson<RenderStatus>(`/api/videos/${projectId}/render`, { lang: language });
      setRender({ state: status.state, progress: status.progress });
    } catch {
      wantsDownload.current = false;
      setRender({ state: "failed", progress: 0 });
    }
  }

  function downloadVideo(event?: React.MouseEvent<HTMLAnchorElement>) {
    if (!publicApiBase()) return;
    event?.preventDefault();
    void downloadDirect(fileUrl);
  }

  const formats: { id: Format; icon: IconName; title: string; body: string; note?: string; ok?: boolean }[] = [
    { id: "srt", icon: "fileText", title: "SRT", body: t("export.srtHint"), note: t("export.youtubeOk"), ok: true },
    { id: "vtt", icon: "fileText", title: "VTT", body: t("export.vttHint"), note: t("export.youtubeOk"), ok: true },
    { id: "ass", icon: "fileText", title: "ASS", body: t("export.assHint"), note: t("export.youtubeNo") },
    { id: "zip", icon: "fileZip", title: "ZIP", body: t("export.zipHint") },
    { id: "mp4", icon: "fileVideo", title: "MP4", body: t("export.videoHint", { lang: label }) },
  ];

  const hrefFor = (kind: Exclude<Format, "mp4">) =>
    kind === "zip" ? `/api/export/${projectId}/zip` : `/api/export/${projectId}/${kind}?${query}`;
  const subtitleHref = format === "mp4" ? "" : hrefFor(format);

  // Elegir un formato descarga directamente: subtítulos al instante y el MP4
  // con su flujo (si ya está listo se descarga; si no, se prepara y se
  // descarga solo al terminar).
  function pickFormat(kind: Format) {
    setFormat(kind);
    if (kind !== "mp4") {
      const link = document.createElement("a");
      link.href = hrefFor(kind);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t("export.videoStarted"));
      return;
    }
    if (busy) return;
    if (render.state === "done") {
      void downloadDirect(fileUrl);
      toast.success(t("export.videoStarted"));
    } else if (render.state === "idle" || render.state === "failed") {
      void prepare();
    }
  }

  const footer =
    format !== "mp4" ? (
      <a
        href={subtitleHref}
        onClick={() => toast.success(t("export.videoStarted"))}
        className={`${buttonClass()} min-h-11 w-full`}
      >
        <Icon name="download" className="h-4 w-4" />
        {t("export.download", { format: format.toUpperCase() })}
      </a>
    ) : busy ? (
      <RenderProgress state={render.state} progress={render.progress} label={label} />
    ) : render.state === "done" ? (
      <a href={fileUrl} onClick={downloadVideo} className={`${buttonClass()} min-h-11 w-full`}>
        <Icon name="checkCircle" className="h-4 w-4" />
        {t("export.videoDownload")}
      </a>
    ) : render.state === "stale" ? (
      <div className="grid gap-2">
        <p className="text-xs text-muted">{t("export.videoStale")}</p>
        <div className="grid grid-cols-2 gap-2">
          <a href={fileUrl} onClick={downloadVideo} className={`${buttonClass("secondary")} min-h-11`}>
            {t("export.videoPrevious")}
          </a>
          <button type="button" onClick={() => void prepare()} className={`${buttonClass()} min-h-11`}>
            {t("export.videoUpdate")}
          </button>
        </div>
      </div>
    ) : render.state === "unavailable" ? (
      <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-muted">{t("export.videoUnavailable")}</p>
    ) : (
      <div className="grid gap-2">
        {render.state === "failed" && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
            {t("export.videoFailed")}
          </p>
        )}
        <button type="button" onClick={() => void prepare()} className={`${buttonClass()} min-h-11 w-full`}>
          <Icon name="spark" className="h-4 w-4" />
          {render.state === "failed" ? t("export.videoRetry") : t("export.videoPrepare")}
        </button>
      </div>
    );

  return (
    <div className="relative">
      <button type="button" className={buttonClass("secondary")} aria-haspopup="dialog" onClick={openSheet}>
        <Icon name="download" className="h-4 w-4" />
        {t("project.export")}
        {busy && <span className="font-mono text-xs tabular-nums text-accent-ink">{render.progress}%</span>}
      </button>

      <AnimatePresence>
        {!open && busy && (
          <motion.div
            initial={{ opacity: 0, transform: "translateY(-4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="material-raised absolute right-0 z-30 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-xl p-3 shadow-[var(--shadow-float)]"
          >
            <RenderProgress state={render.state} progress={render.progress} label={label} />
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("project.export")}
        description={t("export.sheetHint2")}
        closeLabel={t("palette.close")}
        footer={footer}
      >
        <div className="grid gap-6">
          {options.length > 1 && (
            <fieldset className="grid gap-2.5">
              <legend className="mb-2.5 text-sm font-medium text-ink">{t("export.language")}</legend>
              <div className="flex flex-wrap gap-2">
                {options.map((code) => {
                  const active = code === language;
                  return (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={busy && !active}
                      onClick={() => choose(code ?? "")}
                      className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? "border-transparent bg-primary text-on-primary"
                          : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <Flag code={code ?? ""} />
                      {languageLabel(locale, code ?? "")}
                      {code === sourceLanguage && <span className="text-xs opacity-70">· {t("export.original")}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <fieldset className="grid gap-2.5">
            <legend className="mb-2.5 text-sm font-medium text-ink">{t("export.format")}</legend>
            <div role="radiogroup" aria-label={t("export.format")} className="grid gap-2">
              {formats.map((item) => {
                const active = item.id === format;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${t("export.download", { format: item.title })}: ${item.body}`}
                    onClick={() => pickFormat(item.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-150 ${
                      active
                        ? "border-accent bg-accent-soft/50 shadow-[0_0_0_1px_var(--accent-base)]"
                        : "border-line hover:border-line-strong hover:bg-surface-2/50"
                    }`}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                        active ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-2"
                      }`}
                    >
                      <Icon name={item.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink">{item.title}</span>
                        {item.id === "zip" && <span className="text-xs text-subtle">{t("export.allLanguages")}</span>}
                      </span>
                      <span className="mt-0.5 block text-caption leading-5 text-muted">{item.body}</span>
                      {item.note && (
                        <span className={`mt-1 flex items-center gap-1 text-xs ${item.ok ? "text-ok" : "text-subtle"}`}>
                          {item.ok && <Icon name="check" weight="bold" className="h-3 w-3" />}
                          {item.note}
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                        active ? "border-accent" : "border-line-strong"
                      }`}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {format === "mp4" && processing && !busy && render.state !== "unavailable" && (
            <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-xs leading-5 text-warn">{t("export.videoPartial")}</p>
          )}
          {format === "mp4" && <p className="text-xs leading-5 text-subtle">{t("export.videoAuto")}</p>}
        </div>
      </Sheet>
    </div>
  );
}

function RenderProgress({ state, progress, label }: { state: RenderState; progress: number; label: string }) {
  const { t } = useI18n();
  const value = Math.max(0, Math.min(100, progress));
  return (
    <div className="grid gap-2" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-xs font-medium text-ink-2">
        <span>
          {state === "queued" ? t("export.videoQueued") : t("export.videoPreparing")}
          <span className="text-subtle"> · {label}</span>
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums text-ink">{value}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={t("export.videoPreparing")}
      >
        <div
          className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-500 ease-[var(--ease-standard)]"
          style={{ transform: `scaleX(${Math.max(3, value) / 100})` }}
        />
      </div>
      <p className="text-[11px] text-subtle">{t("export.videoAuto")}</p>
    </div>
  );
}
