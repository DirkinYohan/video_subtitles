"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon, type IconName } from "@/components/icons";
import { Kbd, SPRING, useFocusTrap } from "@/components/kit";
import { displayTitle } from "@/lib/format";
import type { VideoProject } from "@/types/domain";

type Entry = { id: string; icon: IconName; label: string; hint?: string; run: () => void; group: string };

/**
 * Paleta de comandos (⌘K / Ctrl+K). Busca proyectos y atajos de navegación.
 * Sin animación de apertura larga: se usa decenas de veces al día.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<VideoProject[] | null>(null);
  const [active, setActive] = useState(0);
  useFocusTrap(open, ref, onClose);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/videos", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : { videos: [] }))
      .then((data: { videos?: VideoProject[] }) => {
        if (!cancelled) setProjects(data.videos ?? []);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const actions: Entry[] = [
      { id: "new", icon: "plus", label: t("projects.new"), group: t("palette.actions"), run: go("/projects/new") },
      { id: "projects", icon: "folder", label: t("nav.projects"), group: t("palette.actions"), run: go("/projects") },
      { id: "account", icon: "user", label: t("nav.account"), group: t("palette.actions"), run: go("/account") },
    ];
    const needle = query.trim().toLowerCase();
    const found = (projects ?? [])
      .filter((video) => !needle || displayTitle(video.title).toLowerCase().includes(needle))
      .slice(0, 8)
      .map<Entry>((video) => ({
        id: video.id,
        icon: "film",
        label: displayTitle(video.title),
        group: t("nav.projects"),
        run: go(`/projects/${video.id}`),
      }));
    const shownActions = actions.filter((entry) => !needle || entry.label.toLowerCase().includes(needle));
    return [...shownActions, ...found];
  }, [projects, query, router, onClose, t]);

  const current = Math.min(active, Math.max(0, entries.length - 1));

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  function reset() {
    setQuery("");
    setActive(0);
  }

  return (
    <AnimatePresence onExitComplete={reset}>
      {open && (
        <div className="fixed inset-0 z-[55] grid items-start justify-items-center px-4 pt-[12vh]">
          <motion.button
            type="button"
            tabIndex={-1}
            aria-label={t("palette.close")}
            data-no-press
            className="absolute inset-0 cursor-default bg-scrim backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={t("palette.title")}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ ...SPRING, duration: 0.2 }}
            className="material-raised relative w-full max-w-xl overflow-hidden rounded-2xl shadow-[var(--shadow-dialog)]"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Icon name="search" className="h-[18px] w-[18px] shrink-0 text-subtle" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActive((value) => Math.min(entries.length - 1, value + 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActive((value) => Math.max(0, value - 1));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    entries[current]?.run();
                  }
                }}
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={entries[current] ? `palette-${entries[current].id}` : undefined}
                placeholder={t("palette.placeholder")}
                className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-subtle focus:outline-none"
              />
              <Kbd>Esc</Kbd>
            </div>

            <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {entries.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted">
                  {projects === null ? t("palette.loading") : t("palette.empty")}
                </li>
              ) : (
                entries.map((entry, index) => {
                  const showGroup = index === 0 || entries[index - 1]?.group !== entry.group;
                  return (
                    <li key={entry.id} role="presentation">
                      {showGroup && (
                        <p className="px-3 pb-1 pt-2.5 text-xs font-medium text-subtle">{entry.group}</p>
                      )}
                      <div
                        id={`palette-${entry.id}`}
                        role="option"
                        aria-selected={index === current}
                        data-index={index}
                        onPointerMove={() => setActive(index)}
                        onClick={() => entry.run()}
                        className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm ${
                          index === current ? "bg-surface-2 text-ink" : "text-ink-2"
                        }`}
                      >
                        <Icon name={entry.icon} className="h-4 w-4 shrink-0 text-subtle" />
                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                        {index === current && <Icon name="arrowRight" className="h-3.5 w-3.5 text-subtle" />}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
