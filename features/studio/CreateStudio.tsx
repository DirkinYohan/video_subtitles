"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Button, Progress, buttonClass } from "@/components/ui";
import { formatClock } from "@/lib/cues";
import { languageLabel } from "@/lib/i18n";
import { LANGS, flag } from "@/lib/languages";
import { errorMessageKey } from "@/services/client";
import { uploadVideo } from "@/features/studio/upload";

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

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <div className="flex items-center gap-2.5">
        <Link
          href="/projects"
          aria-label={t("studio.back")}
          className={`${buttonClass("secondary")} !h-9 !w-9 !px-0`}
        >
          <Icon name="skipBack" className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
          {t("upload.title")}
        </h1>
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="grid min-w-0 gap-4 rounded-xl border border-line bg-surface p-3.5 lg:sticky lg:top-20">
          <label
            className={`grid cursor-pointer place-items-center gap-1.5 rounded-lg border border-dashed px-4 py-7 text-center transition-colors ${
              over
                ? "border-accent bg-accent-soft"
                : "border-line-strong bg-surface-2 hover:border-accent hover:bg-accent-soft/60"
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
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-ink-2">
              <Icon name="upload" className="h-5 w-5" />
            </span>
            <span className="mt-1.5 max-w-full truncate text-sm font-medium text-ink">
              {file ? file.name : t("studio.drop")}
            </span>
            <span className="text-xs text-muted">
              {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : t("studio.or")}
            </span>
            <span className="text-[0.6875rem] text-subtle">{t("studio.formats")}</span>
            <input
              type="file"
              accept=".mp4,.mkv,.mov,.wav,.mp3,.m4a,video/*,audio/*"
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-ink">{t("studio.source")}</span>
            <span className="relative">
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="min-h-10 w-full cursor-pointer appearance-none rounded-md border border-line bg-surface pl-3 pr-9 text-sm text-ink transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus:shadow-[var(--focus-ring)]"
              >
                <option value="und">{t("studio.auto")}</option>
                {LANGS.map((lang) => (
                  <option key={lang} value={lang}>
                    {flag(lang)} {languageLabel(locale, lang)}
                  </option>
                ))}
              </select>
              <Icon
                name="chevron"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
              />
            </span>
          </label>

          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-medium text-ink">{t("studio.targets")}</legend>

            <div className="mb-2.5 flex items-center gap-1.5 overflow-hidden rounded-md bg-surface-2 px-2.5 py-2 text-xs">
              <span className="shrink-0 font-medium text-ink">
                {flag(source)} {source === "und" ? t("studio.auto") : languageLabel(locale, source)}
              </span>
              <Icon name="arrowRight" className="h-3 w-3 shrink-0 text-subtle" />
              <span className="truncate text-muted">
                {chosen.length > 0
                  ? chosen.map((lang) => languageLabel(locale, lang)).join(", ")
                  : "—"}
              </span>
            </div>

            <div className="grid max-h-52 grid-cols-2 gap-1 overflow-y-auto pr-1 lg:grid-cols-1">
              {options.map((lang) => {
                const checked = targets.includes(lang);
                return (
                  <label
                    key={lang}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      checked ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      onChange={() => toggle(lang)}
                    />
                    <span
                      aria-hidden="true"
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors peer-focus-visible:shadow-[var(--focus-ring)] ${
                        checked
                          ? "border-accent bg-accent text-on-accent"
                          : "border-line-strong bg-surface"
                      }`}
                    >
                      {checked && <Icon name="check" className="h-3 w-3" />}
                    </span>
                    <span className="truncate">
                      {flag(lang)} {languageLabel(locale, lang)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="grid gap-2">
            <Button type="button" className="w-full" disabled={!canStart} onClick={() => void start()}>
              <Icon name="spark" className="h-4 w-4" />
              {phase === "idle" ? t("studio.start") : t("studio.uploading")}
            </Button>
            {phase === "uploading" && (
              <Button type="button" variant="secondary" onClick={() => abortRef.current.abort()}>
                {t("studio.cancel")}
              </Button>
            )}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="relative">
            {preview ? (
              <video
                ref={videoRef}
                src={preview}
                className="aspect-video w-full bg-stage object-contain"
                controls
              />
            ) : (
              <div className="grid aspect-video place-items-center bg-surface-2 p-6 text-center">
                <div className="grid justify-items-center gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-subtle">
                    <Icon name="play" className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-muted">{t("studio.emptyPlayer")}</p>
                </div>
              </div>
            )}
          </div>

          {phase !== "idle" && (
            <div className="grid gap-2.5 border-t border-line px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink">
                  {phase === "preparing" ? t("studio.preparing") : t("studio.uploading")}
                </span>
                <span className="tabular text-xs text-muted">{percent}%</span>
              </div>
              <Progress value={percent} label={t("studio.uploading")} />
              <p className="tabular text-xs text-subtle">
                {file?.name} · {(loaded / (1024 * 1024)).toFixed(1)} /{" "}
                {(total / (1024 * 1024)).toFixed(1)} MB
                {speed > 0 && ` · ${(speed / (1024 * 1024)).toFixed(1)} MB/s`}
                {speed > 0 && total > loaded && ` · ${formatClock(((total - loaded) / speed) * 1000)}`}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
