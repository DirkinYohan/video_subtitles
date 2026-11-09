"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/classes";
import { languageLabel } from "@/lib/i18n";
import { flag } from "@/lib/languages";
import { downloadDirect, publicApiBase } from "@/lib/direct";
import { getJson, postJson } from "@/services/client";

type RenderState = "idle" | "queued" | "running" | "done" | "stale" | "failed" | "unavailable";
type RenderStatus = { state: Exclude<RenderState, "unavailable">; progress: number; error: string };

const itemClass =
  "flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

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
  const [open, setOpen] = useState(false);
  const options = languages.length > 0 ? languages : [initialLanguage];
  const [language, setLanguage] = useState(options.includes(initialLanguage) ? initialLanguage : options[0]);
  const [render, setRender] = useState<{ state: RenderState; progress: number }>({ state: "idle", progress: 0 });
  const [notice, setNotice] = useState("");
  const wantsDownload = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const query = `lang=${encodeURIComponent(language)}`;
  const fileUrl = `/api/videos/${projectId}/render/file?${query}`;
  const busy = render.state === "queued" || render.state === "running";

  const refresh = useCallback(
    async (code: string = language) => {
      try {
        const status = await getJson<RenderStatus>(
          `/api/videos/${projectId}/render?lang=${encodeURIComponent(code)}`,
        );
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
    const shown = window.setTimeout(() => setNotice(t("export.videoStarted")), 0);
    const hidden = window.setTimeout(() => setNotice(""), 6000);
    return () => {
      window.clearTimeout(shown);
      window.clearTimeout(hidden);
    };
  }, [render.state, fileUrl, t]);

  function choose(code: string) {
    if (code === language || busy) return;
    wantsDownload.current = false;
    setLanguage(code);
    setRender({ state: "idle", progress: 0 });
    void refresh(code);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openFile(event: React.MouseEvent<HTMLAnchorElement>) {
    setOpen(false);
    if (!publicApiBase()) return;
    event.preventDefault();
    void downloadDirect(fileUrl);
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

  const label = languageLabel(locale, language);
  const subtitleFormats = [
    { kind: "srt", hint: t("export.srtHint"), youtube: true },
    { kind: "vtt", hint: t("export.vttHint"), youtube: true },
    { kind: "ass", hint: t("export.assHint"), youtube: false },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={buttonClass("secondary")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            const next = !busy && options.includes(initialLanguage) ? initialLanguage : language;
            setLanguage(next);
            void refresh(next);
          }
          setOpen(!open);
        }}
      >
        <Icon name="download" className="h-4 w-4" />
        {t("project.export")}
        {busy && <span className="tabular text-xs font-medium text-accent-ink">{render.progress}%</span>}
        <Icon name="chevron" className="h-3.5 w-3.5 text-subtle" />
      </button>

      {!open && (busy || notice) && (
        <div
          data-elevated="true"
          className="absolute right-0 z-30 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-float)]"
        >
          {busy ? (
            <RenderProgress state={render.state} progress={render.progress} label={label} />
          ) : (
            <p role="status" className="flex items-center gap-2 text-xs font-medium text-ok">
              <Icon name="check" className="h-4 w-4" />
              {notice}
            </p>
          )}
        </div>
      )}

      {open && (
        <div
          role="menu"
          aria-label={t("project.export")}
          data-elevated="true"
          className="absolute right-0 z-40 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]"
        >
          {options.length > 1 && (
            <div className="px-2.5 pb-2 pt-1.5">
              <p className="pb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">{t("export.language")}</p>
              <div role="radiogroup" aria-label={t("export.language")} className="flex flex-wrap gap-1.5">
                {options.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={code === language}
                    disabled={busy && code !== language}
                    onClick={() => choose(code)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      code === language
                        ? "border-accent/40 bg-accent-soft text-accent-ink"
                        : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    {flag(code)} {languageLabel(locale, code)}
                    {code === sourceLanguage && <span className="text-subtle">· {t("export.original")}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="px-2.5 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
            {t("export.subtitles", { lang: label })}
          </p>
          {subtitleFormats.map((format) => (
            <a
              key={format.kind}
              role="menuitem"
              className={itemClass}
              href={`/api/export/${projectId}/${format.kind}?${query}`}
              onClick={() => setOpen(false)}
            >
              <span className="mt-0.5 grid h-7 w-11 shrink-0 place-items-center rounded-md bg-surface-2 text-[11px] font-bold tracking-wide text-ink-2">
                {format.kind.toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  {format.hint}
                </span>
                <span className={`mt-0.5 flex items-center gap-1 text-xs ${format.youtube ? "text-ok" : "text-subtle"}`}>
                  {format.youtube && <Icon name="check" className="h-3.5 w-3.5" />}
                  {format.youtube ? t("export.youtubeOk") : t("export.youtubeNo")}
                </span>
              </span>
            </a>
          ))}
          <a role="menuitem" className={itemClass} href={`/api/export/${projectId}/zip`} onClick={() => setOpen(false)}>
            <span className="mt-0.5 grid h-7 w-11 shrink-0 place-items-center rounded-md bg-surface-2 text-[11px] font-bold tracking-wide text-ink-2">
              ZIP
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{t("export.zip")}</span>
              <span className="mt-0.5 block text-xs text-muted">{t("export.zipHint")}</span>
            </span>
          </a>

          <div className="my-1.5 border-t border-line" />

          <p className="px-2.5 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-subtle">
            {t("export.video")}
          </p>
          <div className="grid gap-2.5 px-2.5 pb-2 pt-0.5">
            <p className="text-xs text-muted">{t("export.videoHint", { lang: label })}</p>
            {processing && !busy && render.state !== "unavailable" && (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-ink-2">{t("export.videoPartial")}</p>
            )}

            {busy ? (
              <RenderProgress state={render.state} progress={render.progress} label={label} />
            ) : render.state === "done" ? (
              <a role="menuitem" className={buttonClass("primary", "sm")} href={fileUrl} onClick={(event) => openFile(event)}>
                <Icon name="download" className="h-4 w-4" />
                {t("export.videoDownload")}
              </a>
            ) : render.state === "stale" ? (
              <>
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{t("export.videoStale")}</p>
                <div className="flex flex-wrap gap-2">
                  <button role="menuitem" type="button" className={buttonClass("primary", "sm")} onClick={() => void prepare()}>
                    <Icon name="spark" className="h-4 w-4" />
                    {t("export.videoUpdate")}
                  </button>
                  <a role="menuitem" className={buttonClass("secondary", "sm")} href={fileUrl} onClick={(event) => openFile(event)}>
                    <Icon name="download" className="h-4 w-4" />
                    {t("export.videoPrevious")}
                  </a>
                </div>
              </>
            ) : render.state === "unavailable" ? (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">{t("export.videoUnavailable")}</p>
            ) : (
              <>
                {render.state === "failed" && (
                  <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                    {t("export.videoFailed")}
                  </p>
                )}
                <button role="menuitem" type="button" className={buttonClass("primary", "sm")} onClick={() => void prepare()}>
                  <Icon name="spark" className="h-4 w-4" />
                  {render.state === "failed" ? t("export.videoRetry") : t("export.videoPrepare")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
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
        <span className="tabular text-sm font-semibold text-ink">{value}%</span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={t("export.videoPreparing")}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${Math.max(3, value)}%` }}
        />
      </div>
      <p className="text-[11px] text-subtle">{t("export.videoAuto")}</p>
    </div>
  );
}
