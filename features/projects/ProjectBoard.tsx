"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Badge, Button, Empty, Modal, TextInput, Toast, buttonClass } from "@/components/ui";
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

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        {t("projects.title")}
      </h1>
      {videos.length > 0 && (
        <Link href="/projects/new" className={buttonClass()}>
          <Icon name="plus" className="h-4 w-4" />
          {t("projects.new")}
        </Link>
      )}
    </div>
  );

  if (videos.length === 0) {
    return (
      <section className="mx-auto max-w-6xl">
        {header}
        <div className="mt-6 grid place-items-center rounded-xl border border-dashed border-line px-6 py-20 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-ink-2">
            <Icon name="folder" className="h-5 w-5" />
          </span>
          <h2 className="mt-5 text-base font-semibold text-ink">{t("projects.emptyTitle")}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{t("projects.emptyBody")}</p>
          <Link href="/projects/new" className={`${buttonClass()} mt-6`}>
            <Icon name="plus" className="h-4 w-4" />
            {t("projects.create")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl">
      {header}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          />
          <TextInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("projects.search")}
            aria-label={t("projects.search")}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:contents">
          <SelectField
            label={t("projects.filter")}
            value={filter}
            onChange={(value) => setFilter(value as FilterKey)}
            options={[
              { value: "all", label: t("projects.filterAll") },
              { value: "processing", label: t("projects.filterProcessing") },
              { value: "done", label: t("projects.filterDone") },
              { value: "failed", label: t("projects.filterFailed") },
            ]}
          />
          <SelectField
            label={t("projects.sort")}
            value={sort}
            onChange={(value) => setSort(value as SortKey)}
            options={[
              { value: "recent", label: t("projects.sortRecent") },
              { value: "title", label: t("projects.sortTitle") },
              { value: "duration", label: t("projects.sortDuration") },
            ]}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-6">
          <Empty>{t("projects.noMatches")}</Empty>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((video) => (
            <ProjectCard key={video.id} video={video} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 w-full appearance-none rounded-md border border-line bg-surface px-3 pr-9 text-sm text-ink transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus:shadow-[var(--focus-ring)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevron"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
      />
    </div>
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

  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(video.created_at));
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
      const response = await fetch(`/api/videos/${video.id}`, {
        method: "DELETE",
        credentials: "include",
      });
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
    <li className="group relative overflow-hidden rounded-xl border border-line bg-surface transition-colors duration-200 hover:border-line-strong">
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        <Link
          href={`/projects/${video.id}`}
          className="block h-full"
          aria-label={`${t("projects.open")}: ${video.title}`}
        >
          {video.thumbnail_url && !thumbFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <span className="grid h-full w-full place-items-center bg-surface-2 text-ink-2">
              <Icon name="play" className="h-6 w-6" />
            </span>
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-ink/30 via-transparent to-transparent" />
        </Link>

        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-md bg-scrim px-2 py-0.5 text-[0.6875rem] font-medium text-white backdrop-blur-sm">
          {date}
        </span>

        {duration && (
          <span className="tabular pointer-events-none absolute bottom-2.5 left-2.5 rounded-md bg-scrim px-1.5 py-0.5 text-[0.6875rem] font-medium text-white backdrop-blur-sm">
            {duration}
          </span>
        )}

        <div className="absolute right-2 top-2" ref={ref}>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md bg-surface/90 text-ink shadow-[var(--shadow-raise)] backdrop-blur-sm transition-colors hover:bg-surface"
            aria-label={t("projects.menu")}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((value) => !value)}
          >
            <Icon name="more" className="h-4 w-4" />
          </button>

          {menu && (
            <div
              role="menu"
              data-elevated="true"
              className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-line bg-surface p-1 text-sm shadow-[var(--shadow-float)]"
            >
              <Link
                role="menuitem"
                href={`/projects/${video.id}`}
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-ink hover:bg-surface-2"
                onClick={() => setMenu(false)}
              >
                <Icon name="panel" className="h-4 w-4 text-subtle" />
                {t("projects.open")}
              </Link>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-ink hover:bg-surface-2"
                onClick={() => {
                  setMenu(false);
                  setRename(true);
                }}
              >
                <Icon name="pencil" className="h-4 w-4 text-subtle" />
                {t("projects.rename")}
              </button>
              <a
                role="menuitem"
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-ink hover:bg-surface-2"
                href={`/api/export/${video.id}/zip`}
              >
                <Icon name="download" className="h-4 w-4 text-subtle" />
                {t("project.export")}
              </a>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-danger hover:bg-danger-soft"
                onClick={() => {
                  setMenu(false);
                  setConfirm(true);
                }}
              >
                <Icon name="trash" className="h-4 w-4" />
                {t("projects.delete")}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-1.5 p-3.5">
        <Link
          href={`/projects/${video.id}`}
          className="truncate text-sm font-semibold tracking-tight text-ink hover:underline hover:underline-offset-4"
        >
          {video.title}
        </Link>
        <p className="truncate text-xs text-muted">
          {flag(video.source_language)} {languageLabel(locale, video.source_language)}
          {video.source_language === "und" && ` (${t("studio.auto")})`}
          <span aria-hidden="true" className="px-1 text-subtle">
            →
          </span>
          {video.target_languages.map((code) => languageLabel(locale, code)).join(", ")}
        </p>
        <div className="mt-0.5">
          <Badge tone={statusTone(video.status)}>{t(statusKey(video.status))}</Badge>
        </div>
        {notice && <Toast>{notice}</Toast>}
        {error && <Toast tone="danger">{error}</Toast>}
      </div>

      {confirm && (
        <Modal label={t("projects.delete")} onClose={() => setConfirm(false)}>
          <h2 className="text-base font-semibold text-ink">{t("projects.delete")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("projects.confirmDelete")}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirm(false)}>
              {t("projects.cancel")}
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>
              {t("projects.delete")}
            </Button>
          </div>
        </Modal>
      )}

      {rename && (
        <Modal label={t("projects.rename")} onClose={() => setRename(false)}>
          <h2 className="text-base font-semibold text-ink">{t("projects.rename")}</h2>
          <label className="mt-4 grid gap-2 text-sm">
            <span className="font-medium text-ink">{t("projects.renameTitle")}</span>
            <TextInput
              value={title}
              maxLength={180}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRename(false)}>
              {t("projects.cancel")}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void saveName()}>
              {t("editor.save")}
            </Button>
          </div>
        </Modal>
      )}
    </li>
  );
}
