"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LangCode } from "@/components/Flag";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { MenuItem, Popover, ProgressRing, SegmentedControl, menuKeys, useDismiss } from "@/components/kit";
import { useToast } from "@/components/toast";
import { Button, Modal, TextInput, buttonClass } from "@/components/ui";
import { formatClock } from "@/lib/cues";
import { displayTitle, formatRelative } from "@/lib/format";
import { isMediaFile, setPendingUpload } from "@/lib/pendingUpload";
import { statusKey } from "@/lib/status";
import { postJson, putJson } from "@/services/client";
import type { VideoProject } from "@/types/domain";

type SortKey = "recent" | "title" | "duration";
type FilterKey = "all" | "processing" | "done" | "failed";
type ViewKey = "grid" | "list";

const DONE = new Set(["COMPLETED", "SUCCESS", "PARTIAL"]);
const FAILED = new Set(["FAILED", "CANCELLED"]);
const WORKING = new Set(["QUEUED", "PROCESSING", "TRANSCRIBING", "TRANSLATING", "GENERATING_SUBTITLES"]);
const VIEW_KEY = "ia_projects_view";

function phaseOf(status: string): Exclude<FilterKey, "all"> {
  if (DONE.has(status)) return "done";
  if (FAILED.has(status)) return "failed";
  return "processing";
}

/* La vista elegida se recuerda por navegador (comodidad, no estado crítico). */
function readView(): ViewKey {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}
function subscribeView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(VIEW_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(VIEW_KEY, onChange);
  };
}
function writeView(view: ViewKey) {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
  }
  window.dispatchEvent(new Event(VIEW_KEY));
}

export function ProjectBoard({ videos }: { videos: VideoProject[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterKey>("all");
  const view = useSyncExternalStore(subscribeView, readView, () => "grid" as ViewKey);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const counts = useMemo(
    () => ({
      all: videos.length,
      processing: videos.filter((v) => phaseOf(v.status) === "processing").length,
      done: videos.filter((v) => phaseOf(v.status) === "done").length,
      failed: videos.filter((v) => phaseOf(v.status) === "failed").length,
    }),
    [videos],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = videos.filter((video) => {
      if (needle && !displayTitle(video.title).toLowerCase().includes(needle)) return false;
      return filter === "all" || phaseOf(video.status) === filter;
    });
    const sorted = [...filtered];
    if (sort === "title") sorted.sort((a, b) => displayTitle(a.title).localeCompare(displayTitle(b.title)));
    else if (sort === "duration") sorted.sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0));
    else sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return sorted;
  }, [videos, query, sort, filter]);

  // Soltar un vídeo en cualquier parte abre "Nuevo proyecto" con el archivo.
  const openWithFile = useCallback(
    (file: File | null | undefined) => {
      if (!isMediaFile(file)) return;
      setPendingUpload(file);
      router.push("/projects/new");
    },
    [router],
  );

  useEffect(() => {
    function hasFiles(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes("Files");
    }
    function onEnter(event: DragEvent) {
      if (!hasFiles(event)) return;
      depth.current += 1;
      setDragging(true);
    }
    function onLeave(event: DragEvent) {
      if (!hasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    }
    function onOver(event: DragEvent) {
      if (hasFiles(event)) event.preventDefault();
    }
    function onDrop(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      openWithFile(event.dataTransfer?.files[0]);
    }
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [openWithFile]);

  const dropOverlay = dragging && (
    <div
      aria-hidden="true"
      className="enter-fade pointer-events-none fixed inset-0 z-[45] grid place-items-center bg-paper/80 p-6 backdrop-blur-sm"
    >
      <div className="grid w-full max-w-lg place-items-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-accent-soft/60 px-8 py-16 text-center">
        <Icon name="upload" className="h-7 w-7 text-accent-ink" />
        <p className="text-xl font-semibold tracking-[-0.02em] text-ink">{t("projects.dropTitle")}</p>
        <p className="text-sm text-muted">{t("projects.dropBody")}</p>
      </div>
    </div>
  );

  const newButton = (
    <Link href="/projects/new" className={`${buttonClass()} min-h-10`}>
      <Icon name="plus" className="h-4 w-4" weight="bold" />
      {t("projects.new")}
    </Link>
  );

  if (videos.length === 0) {
    return (
      <section className="mx-auto grid w-full max-w-6xl gap-8">
        {dropOverlay}
        <header>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">{t("projects.title")}</h1>
          <p className="mt-2 text-sm text-muted">{t("projects.subtitle")}</p>
        </header>
        <label className="group grid cursor-pointer place-items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-20 text-center transition-colors duration-200 hover:border-accent/60 hover:bg-accent-soft/30">
          <EmptyArt />
          <h2 className="mt-8 text-xl font-semibold tracking-[-0.02em] text-ink">{t("projects.emptyTitle")}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{t("projects.emptyBody")}</p>
          <span className={`${buttonClass()} mt-7 min-h-10`}>
            <Icon name="upload" className="h-4 w-4" />
            {t("projects.create")}
          </span>
          <span className="mt-3 text-xs text-subtle">{t("projects.dropHint")}</span>
          <input
            type="file"
            accept=".mp4,.mkv,.mov,.wav,.mp3,.m4a,video/*,audio/*"
            className="sr-only"
            onChange={(event) => openWithFile(event.target.files?.[0])}
          />
        </label>
      </section>
    );
  }

  const filters: { value: FilterKey; label: string }[] = [
    { value: "all", label: t("projects.filterAll") },
    { value: "processing", label: t("projects.filterProcessing") },
    { value: "done", label: t("projects.filterDone") },
    { value: "failed", label: t("projects.filterFailed") },
  ];

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6">
      {dropOverlay}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-3 text-3xl font-semibold tracking-[-0.03em] text-ink">
            {t("projects.title")}
            <span className="tabular text-base font-medium tracking-normal text-subtle">{videos.length}</span>
          </h1>
          <p className="mt-2 text-sm text-muted">{t("projects.subtitle")}</p>
        </div>
        {newButton}
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
          <SegmentedControl
            label={t("projects.filter")}
            value={filter}
            onChange={setFilter}
            options={filters.map((item) => ({
              value: item.value,
              label: (
                <>
                  {item.label}
                  <span className="tabular text-xs text-subtle">{counts[item.value]}</span>
                </>
              ),
            }))}
          />
        </div>

        <div className="flex flex-1 items-center gap-2 lg:justify-end">
          <div className="relative min-w-0 flex-1 lg:max-w-xs">
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
              className="!min-h-9 pl-9"
            />
          </div>
          <SortMenu value={sort} onChange={setSort} />
          <SegmentedControl
            label={t("projects.view")}
            value={view}
            onChange={writeView}
            size="sm"
            className="hidden sm:inline-flex"
            options={[
              { value: "grid", ariaLabel: t("projects.viewGrid"), label: <Icon name="grid" className="h-4 w-4" /> },
              { value: "list", ariaLabel: t("projects.viewList"), label: <Icon name="list" className="h-4 w-4" /> },
            ]}
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
          <Icon name="search" className="h-6 w-6 text-subtle" />
          <p className="text-sm text-muted">{t("projects.noMatches")}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
          >
            {t("projects.clearFilters")}
          </Button>
        </div>
      ) : view === "list" ? (
        <ul className="stagger-in rounded-2xl border border-line bg-surface">
          {visible.map((video) => (
            <ProjectItem key={video.id} video={video} layout="list" />
          ))}
        </ul>
      ) : (
        <ul className="stagger-in grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map((video) => (
            <ProjectItem key={video.id} video={video} layout="grid" />
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyArt() {
  return (
    <span aria-hidden="true" className="relative grid h-24 w-40 place-items-center">
      <span className="absolute inset-x-6 top-1 h-16 rotate-[-6deg] rounded-xl bg-surface-2 ring-1 ring-line" />
      <span className="absolute inset-x-3 top-3 h-16 rotate-[4deg] rounded-xl bg-surface-2 ring-1 ring-line" />
      <span className="relative mt-4 grid h-[4.5rem] w-32 place-items-center rounded-xl bg-stage shadow-[var(--shadow-float)] ring-1 ring-white/10 transition-transform duration-300 ease-[var(--ease-standard)] group-hover:-translate-y-1">
        <Icon name="play" weight="fill" className="h-6 w-6 text-white/90" />
        <span className="absolute inset-x-4 bottom-2.5 h-1 rounded-full bg-white/15">
          <span className="block h-full w-2/5 rounded-full bg-accent" />
        </span>
      </span>
    </span>
  );
}

function SortMenu({ value, onChange }: { value: SortKey; onChange: (value: SortKey) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrap], trigger);
  const options: { value: SortKey; label: string }[] = [
    { value: "recent", label: t("projects.sortRecent") },
    { value: "title", label: t("projects.sortTitle") },
    { value: "duration", label: t("projects.sortDuration") },
  ];
  useEffect(() => {
    if (open) wrap.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);
  return (
    <div className="relative" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("projects.sort")}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <span className="hidden sm:inline">{options.find((o) => o.value === value)?.label}</span>
        <Icon name="chevron" className="h-3.5 w-3.5 text-subtle" />
      </button>
      <Popover open={open} role="menu" label={t("projects.sort")} className="w-48">
        <div onKeyDown={menuKeys}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                trigger.current?.focus();
              }}
              className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-ink outline-none hover:bg-surface-2 focus-visible:bg-surface-2"
            >
              <span className="grid w-4 place-items-center text-accent">
                {option.value === value && <Icon name="check" className="h-4 w-4" weight="bold" />}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}

function StatusBadge({ status, onRetry, busy }: { status: string; onRetry: () => void; busy: boolean }) {
  const { t } = useI18n();
  const phase = phaseOf(status);
  if (phase === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok">
        <Icon name="check" className="h-3 w-3" weight="bold" />
        {status === "PARTIAL" ? t("status.PARTIAL") : t("projects.ready")}
      </span>
    );
  }
  if (phase === "failed") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
          <Icon name="alert" className="h-3 w-3" weight="bold" />
          {t(statusKey(status))}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <Icon name="retry" className="h-3 w-3" />
          {t("job.retry")}
        </button>
      </span>
    );
  }
  const working = WORKING.has(status);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">
      {working ? <ProgressRing indeterminate size={12} stroke={2} /> : <Icon name="clock" className="h-3 w-3" />}
      {t(statusKey(status))}
    </span>
  );
}

/** Vista previa silenciosa al pasar el cursor (sólo con ratón, tras 350 ms). */
function useHoverPreview() {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const enter = useCallback(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setArmed(true), 350);
  }, []);
  const leave = useCallback(() => {
    window.clearTimeout(timer.current);
    setArmed(false);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { armed, enter, leave };
}

function ProjectItem({ video, layout }: { video: VideoProject; layout: ViewKey }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [confirm, setConfirm] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [busy, setBusy] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const menuWrap = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const preview = useHoverPreview();
  const closeMenu = useCallback(() => setMenu(false), []);
  useDismiss(menu, closeMenu, [menuWrap], menuTrigger);
  useEffect(() => {
    if (menu) menuWrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menu]);

  const name = displayTitle(video.title);
  const href = `/projects/${video.id}`;
  const duration = video.duration_ms > 0 ? formatClock(video.duration_ms) : "";
  const when = formatRelative(video.created_at, locale);
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(
    new Date(video.created_at),
  );

  async function saveName() {
    if (!title.trim() || title.trim().length > 180) {
      setRenameError(t("projects.renameInvalid"));
      return;
    }
    setBusy(true);
    setRenameError("");
    try {
      await putJson(`/api/videos/${video.id}`, { title: title.trim() });
      setRename(false);
      toast.success(t("projects.renamed"));
      router.refresh();
    } catch (caught) {
      setRenameError(caught instanceof Error ? caught.message : t("auth.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/videos/${video.id}`, { method: "DELETE", credentials: "include" });
      setConfirm(false);
      if (!response.ok) {
        toast.error(t("projects.deleteError"));
        return;
      }
      toast.success(t("projects.deleted"));
      router.refresh();
    } catch {
      setConfirm(false);
      toast.error(t("job.connectionError"));
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    setBusy(true);
    try {
      await postJson(`/api/videos/${video.id}/produce`, { mode: "progressive" });
      toast.success(t("projects.retrying"));
      router.refresh();
    } catch {
      toast.error(t("process.error"));
    } finally {
      setBusy(false);
    }
  }

  const thumb = (
    <Link
      href={href}
      tabIndex={-1}
      aria-hidden="true"
      onPointerEnter={preview.enter}
      onPointerLeave={() => {
        preview.leave();
        setPlaying(false);
      }}
      className={`relative block overflow-hidden bg-surface-2 ${
        layout === "grid" ? "aspect-video rounded-t-[19px]" : "aspect-video w-28 shrink-0 rounded-lg ring-1 ring-inset ring-line sm:w-36"
      }`}
    >
      {video.thumbnail_url && !thumbFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={video.thumbnail_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 ease-[var(--ease-standard)] group-hover:scale-[1.03]"
          ref={(node) => {
            if (node && node.complete && node.naturalWidth === 0) setThumbFailed(true);
          }}
          onError={() => setThumbFailed(true)}
        />
      ) : (
        <span className="grid h-full w-full place-items-center text-subtle">
          <Icon name="film" className="h-6 w-6" />
        </span>
      )}
      {layout === "grid" && preview.armed && (
        <video
          src={`/api/videos/${video.id}/media#t=5`}
          muted
          autoPlay
          playsInline
          loop
          preload="metadata"
          onPlaying={() => setPlaying(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${playing ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {duration && (
        <span className="absolute bottom-2 right-2 rounded-[5px] bg-scrim-strong px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium tabular-nums text-white">
          {duration}
        </span>
      )}
    </Link>
  );

  const menuButton = (
    <div className="relative" ref={menuWrap}>
      <button
        ref={menuTrigger}
        type="button"
        className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink aria-expanded:bg-surface-2 aria-expanded:text-ink"
        aria-label={`${t("projects.menu")}: ${name}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((value) => !value)}
      >
        <Icon name="more" className="h-5 w-5" weight="bold" />
      </button>
      <Popover open={menu} role="menu" label={t("projects.menu")} className="w-48">
        <div onKeyDown={menuKeys}>
          <MenuItem icon="panel" href={href} onSelect={closeMenu}>
            {t("projects.open")}
          </MenuItem>
          <MenuItem
            icon="pencil"
            onSelect={() => {
              closeMenu();
              setTitle(video.title);
              setRename(true);
            }}
          >
            {t("projects.rename")}
          </MenuItem>
          <MenuItem icon="download" href={`/api/export/${video.id}/zip`} onSelect={closeMenu}>
            {t("projects.download")}
          </MenuItem>
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon="trash"
            tone="danger"
            onSelect={() => {
              closeMenu();
              setConfirm(true);
            }}
          >
            {t("projects.delete")}
          </MenuItem>
        </div>
      </Popover>
    </div>
  );

  const languages = (
    <span className="flex min-w-0 items-center gap-1.5 text-ink-2">
      <LangCode code={video.source_language || "und"} />
      <Icon name="arrowRight" className="h-3 w-3 shrink-0 text-subtle" />
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {video.target_languages.map((code) => (
          <LangCode key={code} code={code} />
        ))}
      </span>
    </span>
  );

  const dialogs = (
    <>
      {confirm && (
        <Modal label={t("projects.delete")} onClose={() => setConfirm(false)}>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">{t("projects.deleteTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t("projects.confirmDeleteNamed", { name })}</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirm(false)}>
              {t("projects.cancel")}
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>
              <Icon name="trash" className="h-4 w-4" />
              {t("projects.delete")}
            </Button>
          </div>
        </Modal>
      )}
      {rename && (
        <Modal label={t("projects.rename")} onClose={() => setRename(false)}>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">{t("projects.rename")}</h2>
          <form
            className="mt-4 grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
          >
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-ink">{t("projects.renameTitle")}</span>
              <TextInput
                value={title}
                maxLength={180}
                aria-invalid={Boolean(renameError)}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setRenameError("");
                }}
              />
            </label>
            <p className={`text-xs ${renameError ? "text-danger" : "text-subtle"}`} role={renameError ? "alert" : undefined}>
              {renameError || `${title.trim().length} / 180`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setRename(false)}>
                {t("projects.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {t("editor.save")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );

  if (layout === "list") {
    return (
      <li className="group relative flex items-center gap-4 border-b border-line px-3 py-3 last:border-b-0 hover:bg-surface-2/50 has-[[aria-expanded=true]]:z-20 sm:px-4">
        {thumb}
        <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
          <Link href={href} title={video.title} className="line-clamp-2 text-sm font-medium text-ink hover:text-accent-ink">
            <span className="absolute inset-0" aria-hidden="true" />
            {name}
          </Link>
          <span className="text-xs">{languages}</span>
          <span className="relative z-10 flex items-center gap-3">
            <StatusBadge status={video.status} onRetry={() => void retry()} busy={busy} />
            <span className="hidden text-xs text-subtle md:inline" title={fullDate}>
              {when}
            </span>
          </span>
        </div>
        <div className="relative z-10">{menuButton}</div>
        {dialogs}
      </li>
    );
  }

  return (
    <li
      onPointerEnter={preview.enter}
      onPointerLeave={() => {
        preview.leave();
        setPlaying(false);
      }}
      className="group relative flex flex-col rounded-2xl border border-line bg-surface transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[var(--shadow-card-hover)] has-[[aria-expanded=true]]:z-20 motion-reduce:hover:translate-y-0"
    >
      {thumb}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <Link
            href={href}
            title={video.title}
            className="line-clamp-2 min-h-10 flex-1 text-[0.9375rem] font-medium leading-5 tracking-[-0.01em] text-ink outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:shadow-[var(--focus-ring)]"
          >
            {name}
          </Link>
          <div className="relative z-10 -mr-1.5 -mt-1">{menuButton}</div>
        </div>
        <span className="text-xs">{languages}</span>
        <div className="relative z-10 mt-auto flex items-center justify-between gap-2 pt-1">
          <StatusBadge status={video.status} onRetry={() => void retry()} busy={busy} />
          <span className="text-xs text-subtle" title={fullDate}>
            {when}
          </span>
        </div>
      </div>
      {dialogs}
    </li>
  );
}
