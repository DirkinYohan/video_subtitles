"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
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
    setTargets((current) => (current.includes(lang) ? current.filter((item) => item !== lang) : [...current, lang]));
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
      const data = await uploadVideo(file, source, chosen, (done, all) => {
        setLoaded(done);
        setTotal(all);
        const seconds = (Date.now() - started.current) / 1000;
        setSpeed(seconds > 0 ? done / seconds : 0);
      }, abortRef.current);
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

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <div className="flex items-center gap-3">
        <Link href="/projects" className="grid h-10 w-10 place-items-center rounded-xl bg-white text-lg text-muted ring-1 ring-line hover:text-ink" aria-label={t("studio.back")}>←</Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("studio.back")}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{t("upload.title")}</h1>
        </div>
      </div>
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="grid min-w-0 gap-5 rounded-3xl border border-line bg-white p-4 sm:p-5 lg:sticky lg:top-28">
          <label
            className={`grid cursor-pointer place-items-center gap-2 rounded-2xl border border-dashed px-4 py-9 text-center transition ${over ? "scale-[1.01] border-accent bg-accent-soft" : "border-[#ccd5e5] bg-paper hover:border-accent hover:bg-accent-soft/50"}`}
            onDragOver={(event) => { event.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              chooseFile(event.dataTransfer.files[0] ?? null);
            }}
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-accent shadow-sm ring-1 ring-line">
              <Icon name="upload" className="h-6 w-6" />
            </span>
            <span className="mt-1 max-w-full truncate text-sm font-bold">{file ? file.name : t("studio.drop")}</span>
            <span className="text-xs text-muted">{file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : t("studio.or")}</span>
            <span className="text-xs text-muted">{t("studio.formats")}</span>
            <input type="file" accept=".mp4,.mkv,.mov,.wav,.mp3,.m4a,video/*,audio/*" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-semibold">{t("studio.source")}</span>
            <select value={source} className="min-h-11 rounded-xl border border-line bg-white px-3 py-2 outline-none hover:border-[#ced6e5] focus:border-accent focus:ring-4 focus:ring-accent/10" onChange={(event) => setSource(event.target.value)}>
              <option value="und">{t("studio.auto")}</option>
              {LANGS.map((lang) => <option key={lang} value={lang}>{flag(lang)} {languageLabel(locale, lang)}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">{t("studio.targets")}</legend>
            <div className="mb-3 rounded-2xl bg-paper p-3 text-sm text-muted">
              <p className="font-medium text-ink">{flag(source)} {source === "und" ? t("studio.auto") : languageLabel(locale, source)}</p>
              <p className="my-1.5 pl-2 text-xs text-accent">↓</p>
              <p className="leading-6">{targets.filter((lang) => lang !== source).map((lang) => `${flag(lang)} ${languageLabel(locale, lang)}`).join("  ·  ") || "—"}</p>
            </div>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 lg:grid-cols-1">
              {options.map((lang) => (
                <label key={lang} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${targets.includes(lang) ? "border-accent/25 bg-accent-soft text-accent" : "border-transparent bg-paper hover:border-line"}`}>
                  <input type="checkbox" className="accent-accent" checked={targets.includes(lang)} onChange={() => toggle(lang)} />
                  {flag(lang)} {languageLabel(locale, lang)}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="grid gap-2">
            <Button type="button" className="w-full" disabled={!file || phase !== "idle" || targets.filter((lang) => lang !== source).length === 0} onClick={() => void start()}>
              {phase === "idle" ? t("studio.start") : t("studio.uploading")}
            </Button>
            {phase === "uploading" && <Button type="button" variant="secondary" onClick={() => abortRef.current.abort()}>{t("studio.cancel")}</Button>}
          </div>
        </aside>
        <section className="min-w-0 overflow-hidden rounded-3xl border border-line bg-white shadow-[0_16px_45px_rgb(35_48_88/0.06)]">
          <div className="relative bg-[#e9edf5]">
            {preview ? (
              <video ref={videoRef} src={preview} className="aspect-video w-full bg-ink object-contain" controls />
            ) : (
              <div className="grid aspect-video place-items-center p-6 text-center">
                <div>
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-accent shadow-sm"><Icon name="play" className="h-7 w-7" /></span>
                  <p className="mt-4 text-sm font-medium text-muted">{t("studio.emptyPlayer")}</p>
                </div>
              </div>
            )}
          </div>
          {phase !== "idle" && (
            <div className="grid gap-3 border-t border-line px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between text-sm">
                <span>{phase === "preparing" ? t("studio.preparing") : t("studio.uploading")}</span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-muted">
                {file?.name} · {(loaded / (1024 * 1024)).toFixed(1)} / {(total / (1024 * 1024)).toFixed(1)} MB
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
