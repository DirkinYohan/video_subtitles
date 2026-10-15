"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Badge, Button, Modal, TextInput, Toast, buttonClass } from "@/components/ui";
import { formatClock } from "@/lib/cues";
import { flag } from "@/lib/languages";
import { languageLabel } from "@/lib/i18n";
import { putJson } from "@/services/client";
import { statusKey, statusTone } from "@/lib/status";
import type { VideoProject } from "@/types/domain";

type SortKey = "recent" | "title" | "duration";
type FilterKey = "all" | "processing" | "done" | "failed";

const DONE = new Set(["COMPLETED", "SUCCESS", "PARTIAL"]);
const FAILED = new Set(["FAILED", "CANCELLED"]);

export function ProjectBoard({ videos }: { videos: VideoProject[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterKey>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = videos.filter((video) => {
      if (needle && !video.title.toLowerCase().includes(needle)) return false;
      if (filter === "processing") return !DONE.has(video.status) && !FAILED.has(video.status);
      if (filter === "done") return DONE.has(video.status);
      if (filter === "failed") return FAILED.has(video.status);
      return true;
    });
    const sorted = [...filtered];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "duration") sorted.sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0));
    else sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return sorted;
  }, [videos, query, sort, filter]);

  if (videos.length === 0) {
    return (
      <section className="mx-auto max-w-6xl">
        <div>
          <p className="text-sm font-semibold text-accent">{t("app.tagline")}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t("projects.title")}</h1>
        </div>
        <div className="mt-7 flex min-h-[58vh] flex-col items-center justify-center rounded-3xl border border-line bg-white px-5 py-16 text-center sm:min-h-[62vh]">
          <div className="relative mb-7">
            <span className="absolute inset-0 scale-150 rounded-full bg-accent-soft/70 blur-2xl" />
            <span className="relative grid h-20 w-20 place-items-center rounded-3xl bg-accent-soft text-accent ring-1 ring-accent/10">
              <Icon name="folder" className="h-9 w-9" />
            </span>
          </div>
          <h2 className="text-lg font-bold">{t("projects.emptyTitle")}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{t("projects.emptyBody")}</p>
          <Link href="/projects/new" className={`${buttonClass()} mt-7`}>
            <span className="text-lg leading-none">+</span>
            {t("projects.create")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent">{t("app.tagline")}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t("projects.title")}</h1>
        </div>
        <Link href="/projects/new" className={buttonClass()}><span className="text-lg leading-none">+</span>{t("projects.new")}</Link>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_auto_auto]">
        <TextInput
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("projects.search")}
          aria-label={t("projects.search")}
        />
        <label className="grid gap-1 text-xs text-muted">
          <span className="sr-only">{t("projects.filter")}</span>
          <select
            value={filter}
            aria-label={t("projects.filter")}
            className="min-h-11 rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            onChange={(event) => setFilter(event.target.value as FilterKey)}
          >
            <option value="all">{t("projects.filterAll")}</option>
            <option value="processing">{t("projects.filterProcessing")}</option>
            <option value="done">{t("projects.filterDone")}</option>
            <option value="failed">{t("projects.filterFailed")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">
          <span className="sr-only">{t("projects.sort")}</span>
          <select
            value={sort}
            aria-label={t("projects.sort")}
            className="min-h-11 rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-accent"
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            <option value="recent">{t("projects.sortRecent")}</option>
            <option value="title">{t("projects.sortTitle")}</option>
            <option value="duration">{t("projects.sortDuration")}</option>
          </select>
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-line bg-white px-5 py-14 text-center text-sm text-muted">{t("projects.noMatches")}</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((video) => <ProjectCard key={video.id} video={video} />)}
        </ul>
      )}
    </section>
  );
}

function ProjectCard({ video }: { video: VideoProject }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(video.created_at));
  // La duración viene de la API (ffprobe al subir): sin <video> oculto.
  const duration = video.duration_ms > 0 ? formatClock(video.duration_ms) : "";

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function saveName() {
    if (!title.trim() || title.trim().length > 180) {
      setError(t("projects.renameInvalid"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await putJson(`/api/videos/${video.id}`, { title: title.trim() });
      setRename(false);
      setNotice(t("projects.renamed"));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("auth.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/videos/${video.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) {
        setError(t("projects.deleteError"));
        setConfirm(false);
        return;
      }
      setConfirm(false);
      router.refresh();
    } catch {
      setError(t("job.connectionError"));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="group overflow-hidden rounded-3xl border border-line bg-white transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_18px_45px_rgb(35_48_88/0.09)]">
      <div className="relative aspect-video overflow-hidden bg-paper">
        <Link href={`/projects/${video.id}`} className="block h-full" aria-label={`${t("projects.open")}: ${video.title}`}>
          {video.thumbnail_url && !thumbFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <span className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,var(--color-paper),var(--color-accent-soft))] text-accent">
              <Icon name="play" className="h-8 w-8" />
            </span>
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-ink/10" />
        </Link>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 text-white">
          <span className="rounded-lg bg-ink/55 px-2.5 py-1 text-xs font-medium backdrop-blur">{date}</span>
        </div>
        {duration && <span className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-ink/65 px-2 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur">{duration}</span>}
        <div className="absolute right-2 top-2" ref={ref}>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl bg-white/90 text-lg font-bold text-ink shadow-sm backdrop-blur hover:bg-white"
            aria-label={t("projects.menu")}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((value) => !value)}
          >
            ⋮
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 z-10 mt-1 w-44 rounded-2xl border border-line bg-white p-1.5 text-sm shadow-[0_16px_40px_rgb(24_32_52/0.14)]">
              <Link role="menuitem" href={`/projects/${video.id}`} className="block rounded-xl px-3 py-2.5 hover:bg-paper" onClick={() => setMenu(false)}>{t("projects.open")}</Link>
              <button type="button" role="menuitem" className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-paper" onClick={() => { setMenu(false); setRename(true); }}>{t("projects.rename")}</button>
              <a role="menuitem" className="block rounded-xl px-3 py-2.5 hover:bg-paper" href={`/api/export/${video.id}/zip`}>{t("project.export")}</a>
              <button type="button" role="menuitem" className="block w-full rounded-xl px-3 py-2.5 text-left text-danger hover:bg-danger-soft" onClick={() => { setMenu(false); setConfirm(true); }}>{t("projects.delete")}</button>
            </div>
          )}
        </div>
      </div>
      <div className="grid gap-2 p-4">
        <Link href={`/projects/${video.id}`} className="truncate font-bold tracking-tight hover:text-accent">{video.title}</Link>
        <p className="truncate text-xs text-muted">
          {flag(video.source_language)} {languageLabel(locale, video.source_language)}
          {video.source_language === "und" && ` (${t("studio.auto")})`}
          {" → "}
          {video.target_languages.map((code) => languageLabel(locale, code)).join(", ")}
        </p>
        <div><Badge tone={statusTone(video.status)}>{t(statusKey(video.status))}</Badge></div>
        {notice && <Toast>{notice}</Toast>}
        {error && <Toast tone="danger">{error}</Toast>}
      </div>
      {confirm && (
        <Modal label={t("projects.delete")} onClose={() => setConfirm(false)}>
          <p className="text-sm">{t("projects.confirmDelete")}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirm(false)}>{t("projects.cancel")}</Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>{t("projects.delete")}</Button>
          </div>
        </Modal>
      )}
      {rename && (
        <Modal label={t("projects.rename")} onClose={() => setRename(false)}>
          <h2 className="text-base font-semibold">{t("projects.rename")}</h2>
          <label className="mt-4 grid gap-1.5 text-sm">
            {t("projects.renameTitle")}
            <TextInput value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRename(false)}>{t("projects.cancel")}</Button>
            <Button type="button" disabled={busy} onClick={() => void saveName()}>{t("editor.save")}</Button>
          </div>
        </Modal>
      )}
    </li>
  );
}
