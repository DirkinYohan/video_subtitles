"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Button, PageHeader, Progress, StatusDot, buttonClass, fieldClass } from "@/components/ui";
import { formatClock } from "@/lib/cues";
import { displayTitle, formatBytes } from "@/lib/format";
import { languageLabel } from "@/lib/i18n";
import { LANGS } from "@/lib/languages";
import { Flag } from "@/components/Flag";
import { errorMessageKey } from "@/services/client";
import { uploadVideo } from "@/features/studio/upload";
import { takePendingUpload } from "@/lib/pendingUpload";

export function CreateStudio() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef({ abort: () => undefined });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [over, setOver] = useState(false);
  const [source, setSource] = useState("und");
  const [targets, setTargets] = useState<string[]>(["en"]);
  const [phase, setPhase] = useState<"idle" | "preparing" | "uploading">("idle");
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState("");
  const started = useRef(0);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Archivo soltado en Mis proyectos.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const pending = takePendingUpload();
      if (pending) chooseFile(pending);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;

  function chooseFile(next: File | null) {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : "");
    setError("");
  }

  function toggle(lang: string) {
    setTargets((current) =>
      current.includes(lang) ? current.filter((item) => item !== lang) : [...current, lang],
    );
  }

  async function start() {
    if (!file || phase !== "idle") return;
    const chosen = targets.filter((lang) => lang !== source);
    if (chosen.length === 0) return;
    setError("");
    setPhase("preparing");
    setLoaded(0);
    setTotal(file.size);
    setSpeed(0);
    started.current = Date.now();
    setPhase("uploading");
    try {
      const data = await uploadVideo(
        file,
        source,
        chosen,
        (done, all) => {
          setLoaded(done);
          setTotal(all);
          const seconds = (Date.now() - started.current) / 1000;
          setSpeed(seconds > 0 ? done / seconds : 0);
        },
        abortRef.current,
      );
      router.push(`/projects/${data.id}`);
    } catch (caught) {
      if (caught instanceof Error && caught.message === "abort") {
        setPhase("idle");
        return;
      }
      setError(t(errorMessageKey(caught)));
      setPhase("idle");
    }
  }

  const options = source === "und" ? LANGS : LANGS.filter((lang) => lang !== source);
  const chosen = targets.filter((lang) => lang !== source);
  const canStart = Boolean(file) && phase === "idle" && chosen.length > 0;

  const steps = [
    { label: t("upload.step1"), done: Boolean(file) },
    { label: t("upload.step2"), done: Boolean(file) && chosen.length > 0 },
    { label: t("upload.step3"), done: phase !== "idle" },
  ];
  const current = steps.findIndex((step) => !step.done);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-7">
      <PageHeader
        crumbs={[{ href: "/projects", label: t("projects.title") }]}
        title={t("upload.title")}
        description={t("upload.subtitle")}
      />

      <ol className="flex items-center gap-2 sm:gap-3" aria-label={t("upload.title")}>
        {steps.map((step, index) => {
          const isCurrent = index === current;
          return (
            <li key={step.label} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-300 ${
                  step.done
                    ? "bg-primary text-on-primary"
                    : isCurrent
                      ? "border border-ink bg-surface text-ink"
                      : "border border-line-strong bg-surface text-subtle"
                }`}
              >
                {step.done ? <Icon name="check" className="h-4 w-4" /> : index + 1}
              </span>
              <span className={`truncate text-sm font-medium ${step.done || isCurrent ? "text-ink" : "text-subtle"}`}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <span className="relative h-px min-w-4 flex-1 overflow-hidden rounded-full bg-line-strong">
                  <span
                    className={`absolute inset-0 origin-left bg-ink transition-transform duration-500 ease-[var(--ease-out-quart)] ${
                      step.done ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
          {preview ? (
            <>
              <video ref={videoRef} src={preview} className="aspect-video w-full bg-stage object-contain" controls />
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2 ring-1 ring-inset ring-line">
                  <Icon name="play" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" title={file?.name}>
                    {file ? displayTitle(file.name) : ""}
                  </p>
                  <p className="tabular text-xs text-muted">{file ? formatBytes(file.size, locale) : ""}</p>
                </div>
                {phase === "idle" && (
                  <label className={`${buttonClass("secondary", "sm")} cursor-pointer`}>
                    <Icon name="upload" className="h-4 w-4" />
                    {t("upload.change")}
                    <input
                      type="file"
                      accept=".mp4,.mkv,.mov,.wav,.mp3,.m4a,video/*,audio/*"
                      className="sr-only"
                      onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>
            </>
          ) : (
            <label
              className={`group relative grid aspect-video cursor-pointer place-items-center overflow-hidden p-6 text-center transition-colors duration-200 ${
                over ? "bg-accent-soft" : "bg-surface"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(false);
                chooseFile(event.dataTransfer.files[0] ?? null);
              }}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-3 rounded-xl border border-dashed transition-colors duration-200 ${
                  over ? "border-accent" : "border-line-strong group-hover:border-subtle"
                }`}
              />
                            <span className="relative grid justify-items-center gap-2">
                <span
                  className={`grid h-12 w-12 place-items-center rounded-xl bg-primary text-on-primary shadow-[var(--shadow-button)] transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:-translate-y-0.5 ${
                    over ? "scale-105" : ""
                  }`}
                >
                  <Icon name="upload" className="h-5 w-5" />
                </span>
                <span className="mt-4 text-base font-semibold tracking-[-0.015em] text-ink">{t("studio.drop")}</span>
                <span className="text-sm text-muted">{t("studio.or")}</span>
                <span className="mt-1 text-xs text-subtle">{t("studio.formats")}</span>
              </span>
              <input
                type="file"
                accept=".mp4,.mkv,.mov,.wav,.mp3,.m4a,video/*,audio/*"
                className="sr-only"
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              />
            </label>
          )}

          {phase !== "idle" && (
            <div className="grid gap-2.5 border-t border-line px-4 py-4">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2 font-medium text-ink">
                  <StatusDot tone="accent" pulse />
                  {phase === "preparing" ? t("studio.preparing") : t("studio.uploading")}
                </span>
                <span className="tabular text-sm font-semibold text-ink">{percent}%</span>
              </div>
              <Progress value={percent} label={t("studio.uploading")} />
              <p className="tabular text-xs text-subtle">
                {formatBytes(loaded, locale)} / {formatBytes(total, locale)}
                {speed > 0 && ` · ${formatBytes(speed, locale)}/s`}
                {speed > 0 && total > loaded && ` · ${formatClock(((total - loaded) / speed) * 1000)}`}
              </p>
            </div>
          )}
        </section>

        <aside className="grid min-w-0 grid-cols-1 gap-4 lg:sticky lg:top-24">
          <section className="grid min-w-0 grid-cols-1 gap-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-ink">{t("studio.source")}</span>
              <span className="relative">
                <select
                  value={source}
                  disabled={phase !== "idle"}
                  onChange={(event) => setSource(event.target.value)}
                  className={`${fieldClass} cursor-pointer appearance-none pr-9`}
                >
                  <option value="und">{t("studio.auto")}</option>
                  {LANGS.map((lang) => (
                    <option key={lang} value={lang}>
                      {languageLabel(locale, lang)}
                    </option>
                  ))}
                </select>
                <Icon
                  name="chevron"
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                />
              </span>
            </label>

            <fieldset className="min-w-0" disabled={phase !== "idle"}>
              <legend className="mb-2.5 text-sm font-medium text-ink">{t("upload.into")}</legend>
              <div className="flex flex-wrap gap-2">
                {options.map((lang) => {
                  const checked = targets.includes(lang);
                  return (
                    <label
                      key={lang}
                      className={`inline-flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-full border px-3 text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-200 has-[:focus-visible]:shadow-[var(--focus-ring)] ${
                        checked
                          ? "border-transparent bg-primary text-on-primary"
                          : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(lang)} />
                      <Flag code={lang} />
                      {languageLabel(locale, lang)}
                      <span
                        aria-hidden="true"
                        className={`grid h-4 w-4 place-items-center rounded-full transition-[transform,opacity] duration-200 ${
                          checked ? "scale-100 bg-on-primary text-primary opacity-100" : "scale-50 opacity-0"
                        }`}
                      >
                        <Icon name="check" className="h-2.5 w-2.5" />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <section className="grid min-w-0 grid-cols-1 gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-ink">{t("upload.summary")}</h2>
            <dl className="grid grid-cols-1 gap-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t("upload.step1")}</dt>
                <dd className="min-w-0 truncate font-medium text-ink">{file ? displayTitle(file.name) : "-"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t("studio.source")}</dt>
                <dd className="font-medium text-ink">
                  {source === "und" ? t("studio.auto") : languageLabel(locale, source)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{t("upload.into")}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-ink">
                  {chosen.length > 0 ? chosen.map((lang) => languageLabel(locale, lang)).join(", ") : "-"}
                </dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="button" className="min-h-11 w-full" disabled={!canStart} onClick={() => void start()}>
              <Icon name="spark" className="h-4 w-4" />
              {phase === "idle" ? t("studio.start") : t("studio.uploading")}
            </Button>
            {phase === "uploading" && (
              <Button type="button" variant="secondary" onClick={() => abortRef.current.abort()}>
                {t("studio.cancel")}
              </Button>
            )}
            <p className="text-center text-xs leading-5 text-subtle">{t("upload.startHint")}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
