"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Kbd, Tooltip } from "@/components/kit";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useToast } from "@/components/toast";
import { Button, IconButton, TextInput } from "@/components/ui";
import { formatMs, normalizeCues, parseTimecode, repairCues } from "@/lib/cues";
import { putJson } from "@/services/client";
import type { Cue } from "@/types/domain";

const NUDGE_MS = 100;
const CPS_WARN = 17;
const CPS_LIMIT = 21;
const HISTORY_LIMIT = 100;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function Editor({
  projectId,
  cues,
  language,
  onLanguageChange,
  languages,
  selectedIndex,
  onCuesChange,
  onSelect,
  onSeek,
}: {
  projectId: string;
  cues: Cue[];
  language: string;
  onLanguageChange: (lang: string) => void;
  languages: string[];
  selectedIndex: number | null;
  onCuesChange: (cues: Cue[]) => void;
  onSelect: (cue: Cue) => void;
  onSeek?: (ms: number) => void;
  processing?: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [startDraft, setStartDraft] = useState<Record<number, string>>({});
  const [endDraft, setEndDraft] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<{ past: Cue[][]; future: Cue[][] }>({ past: [], future: [] });
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // El cambio de idioma reinicia el historial y el estado de guardado.
  const [historyLang, setHistoryLang] = useState(language);
  if (historyLang !== language) {
    setHistoryLang(language);
    setHistory({ past: [], future: [] });
    setSave("idle");
  }

  const commit = useCallback(
    (next: Cue[], coalesce?: string) => {
      const stamp = Date.now();
      const same = coalesce && lastKey.current?.key === coalesce && stamp - lastKey.current.at < 1200;
      if (!same) setHistory((current) => ({ past: [...current.past.slice(-HISTORY_LIMIT + 1), cues], future: [] }));
      lastKey.current = coalesce ? { key: coalesce, at: stamp } : null;
      onCuesChange(next);
      setSave("dirty");
    },
    [cues, onCuesChange],
  );

  const undo = useCallback(() => {
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    setHistory({ past: history.past.slice(0, -1), future: [cues, ...history.future] });
    lastKey.current = null;
    onCuesChange(previous);
    setSave("dirty");
  }, [cues, history, onCuesChange]);

  const redo = useCallback(() => {
    const [next, ...rest] = history.future;
    if (!next) return;
    setHistory({ past: [...history.past, cues], future: rest });
    lastKey.current = null;
    onCuesChange(next);
    setSave("dirty");
  }, [cues, history, onCuesChange]);

  const cleaned = useCallback(
    (list: Cue[]) =>
      repairCues(list.filter((cue) => cue.text.trim().length > 0)).map((cue, index) => ({
        ...cue,
        index: index + 1,
        language,
      })),
    [language],
  );

  const persist = useCallback(
    async (manual: boolean) => {
      const payload = cleaned(cues);
      if (payload.length === 0) {
        if (manual) toast.error(t("editor.emptySave"));
        return;
      }
      setSave("saving");
      try {
        await putJson(`/api/subtitles/${projectId}`, { language, cues: payload });
        if (manual) onCuesChange(payload);
        setSave("saved");
        setSavedAt(Date.now());
        if (manual) toast.success(t("editor.saved"));
      } catch {
        setSave("error");
        toast.error(t("editor.saveError"));
      }
    },
    [cleaned, cues, language, onCuesChange, projectId, t, toast],
  );

  useEffect(() => {
    if (save !== "saved") return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 5000);
    return () => window.clearInterval(timer);
  }, [save]);

  useEffect(() => {
    if (save !== "dirty") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? cues.filter((cue) => cue.text.toLowerCase().includes(needle)) : cues;
  }, [cues, query]);

  function update(index: number, patch: Partial<Cue>, coalesce?: string) {
    commit(
      cues.map((cue) => (cue.index === index ? { ...cue, ...patch } : cue)),
      coalesce,
    );
  }

  function add() {
    const last = cues[cues.length - 1];
    const start = last ? last.end_ms + 80 : 0;
    commit(
      normalizeCues(
        [
          ...cues,
          {
            index: cues.length + 1,
            start_ms: start,
            end_ms: start + 1200,
            text: "",
            speaker: last?.speaker || "SPEAKER_00",
            language,
            state: "final",
          },
        ],
        language,
      ),
    );
  }

  function remove(index: number) {
    commit(normalizeCues(cues.filter((cue) => cue.index !== index), language));
  }

  function split(cue: Cue) {
    const middle = cue.start_ms + Math.floor((cue.end_ms - cue.start_ms) / 2);
    const words = cue.text.split(/\s+/);
    const half = Math.ceil(words.length / 2);
    const [left, right] = cue.text.includes("\n")
      ? cue.text.split("\n", 2)
      : [words.slice(0, half).join(" "), words.slice(half).join(" ")];
    const rest = cues.filter((item) => item.index !== cue.index);
    commit(
      normalizeCues(
        [...rest, { ...cue, end_ms: middle, text: left || cue.text }, { ...cue, start_ms: middle, text: right || "" }],
        language,
      ),
    );
  }

  function merge(cue: Cue) {
    const next = cues.find((item) => item.start_ms >= cue.end_ms && item.index !== cue.index);
    if (!next) return;
    commit(
      normalizeCues(
        cues
          .filter((item) => item.index !== next.index)
          .map((item) =>
            item.index === cue.index
              ? { ...item, end_ms: next.end_ms, text: `${item.text} ${next.text}`.replace(/\s+/g, " ").trim() }
              : item,
          ),
        language,
      ),
    );
  }

  function replaceAll() {
    const needle = query.trim();
    if (!needle) return;
    const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let count = 0;
    const next = cues.map((cue) => {
      const text = cue.text.replace(pattern, () => {
        count += 1;
        return replace;
      });
      return text === cue.text ? cue : { ...cue, text };
    });
    if (count === 0) {
      toast.info(t("editor.noMatches"));
      return;
    }
    commit(next);
    toast.success(t("editor.replaced", { count }));
  }

  function timeInput(cue: Cue, field: "start_ms" | "end_ms") {
    const drafts = field === "start_ms" ? startDraft : endDraft;
    const setDrafts = field === "start_ms" ? setStartDraft : setEndDraft;
    const clearDraft = () =>
      setDrafts((current) => {
        const next = { ...current };
        delete next[cue.index];
        return next;
      });
    return (
      <input
        type="text"
        inputMode="decimal"
        spellCheck={false}
        value={drafts[cue.index] ?? formatMs(cue[field])}
        aria-label={field === "start_ms" ? t("editor.start") : t("editor.end")}
        title={t("editor.nudgeHint")}
        className="h-7 w-[5.5rem] rounded-md border border-transparent bg-transparent px-1.5 font-mono text-xs tabular-nums text-ink-2 hover:border-line hover:bg-surface focus:border-accent focus:bg-surface focus:text-ink focus:shadow-[var(--focus-ring)] focus:outline-none"
        onChange={(event) => setDrafts((current) => ({ ...current, [cue.index]: event.target.value }))}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const base = parseTimecode(drafts[cue.index] ?? formatMs(cue[field])) ?? cue[field];
            const step = (event.shiftKey ? 10 : 1) * NUDGE_MS * (event.key === "ArrowUp" ? 1 : -1);
            clearDraft();
            update(cue.index, { [field]: Math.max(0, base + step) }, `${cue.index}-${field}`);
          } else if (event.key === "Enter") {
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            clearDraft();
            event.currentTarget.blur();
          }
        }}
        onBlur={(event) => {
          const parsed = parseTimecode(event.target.value);
          clearDraft();
          if (parsed !== null && parsed !== cue[field]) update(cue.index, { [field]: parsed });
        }}
      />
    );
  }

  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  const status =
    save === "saving"
      ? { tone: "text-muted", text: t("editor.saving") }
      : save === "dirty"
        ? { tone: "text-warn", text: t("editor.unsaved") }
        : save === "error"
          ? { tone: "text-danger", text: t("editor.saveError") }
          : save === "saved"
            ? { tone: "text-ok", text: seconds < 5 ? t("editor.savedNow") : t("editor.savedAgo", { seconds }) }
            : null;

  return (
    <section
      ref={sectionRef}
      aria-label={t("editor.title")}
      onKeyDown={(event) => {
        const typing = (event.target as HTMLElement).closest("input, textarea");
        if (!(event.metaKey || event.ctrlKey) || typing) return;
        if (event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        } else if (event.key.toLowerCase() === "y") {
          event.preventDefault();
          redo();
        } else if (event.key.toLowerCase() === "s") {
          event.preventDefault();
          void persist(true);
        }
      }}
      className="grid min-w-0 overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="grid gap-2.5 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <LanguagePicker
            label={t("player.subtitles")}
            options={languages}
            value={language}
            onChange={onLanguageChange}
            size="sm"
            className="min-w-0 flex-1"
          />
          <div className="flex items-center">
            <Tooltip label={t("editor.undo")} shortcut="⌘Z">
              <IconButton label={t("editor.undo")} disabled={history.past.length === 0} onClick={undo}>
                <Icon name="undo" className="h-4 w-4" />
              </IconButton>
            </Tooltip>
            <Tooltip label={t("editor.redo")} shortcut="⇧⌘Z">
              <IconButton label={t("editor.redo")} disabled={history.future.length === 0} onClick={redo}>
                <Icon name="redo" className="h-4 w-4" />
              </IconButton>
            </Tooltip>
            <Tooltip label={t("editor.replace")}>
              <IconButton
                label={t("editor.replace")}
                aria-pressed={showReplace}
                className={showReplace ? "!bg-surface-2 !text-ink" : ""}
                onClick={() => setShowReplace((value) => !value)}
              >
                <Icon name="search" className="h-4 w-4" />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {showReplace && (
          <div className="enter-fade grid gap-2">
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("editor.search")}
              aria-label={t("editor.search")}
              className="!min-h-9"
            />
            <div className="flex gap-2">
              <TextInput
                value={replace}
                onChange={(event) => setReplace(event.target.value)}
                placeholder={t("editor.replaceWith")}
                aria-label={t("editor.replaceWith")}
                className="!min-h-9"
              />
              <Button type="button" variant="secondary" size="sm" disabled={!query.trim()} onClick={replaceAll}>
                {t("editor.replaceAll")}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className={`flex min-h-5 items-center gap-1.5 text-xs ${status?.tone ?? "text-subtle"}`} aria-live="polite">
            {status ? (
              <>
                {save === "saved" && <Icon name="check" weight="bold" className="h-3 w-3" />}
                {save === "dirty" && <span className="h-1.5 w-1.5 rounded-full bg-warn" />}
                {status.text}
              </>
            ) : (
              <span>{t("editor.count", { count: cues.length })}</span>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={add}>
              <Icon name="plus" className="h-4 w-4" />
              {t("editor.create")}
            </Button>
            <Tooltip label={t("editor.save")} shortcut="⌘S">
              <Button
                type="button"
                size="sm"
                disabled={save === "saving" || cues.length === 0}
                onClick={() => void persist(true)}
              >
                {t("editor.save")}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-muted">{query ? t("editor.noMatches") : t("editor.empty")}</p>
      ) : (
        <ol className="max-h-[32rem] overflow-y-auto overscroll-contain lg:max-h-[calc(100dvh-19rem)]">
          {visible.map((cue, position) => {
            const selected = selectedIndex === cue.index;
            const duration = Math.max(0, cue.end_ms - cue.start_ms);
            const chars = cue.text.replace(/\s+/g, " ").trim().length;
            const cps = duration > 0 ? chars / (duration / 1000) : 0;
            const cpsTone = cps > CPS_LIMIT ? "bg-danger-soft text-danger" : cps > CPS_WARN ? "bg-warn-soft text-warn" : "text-subtle";
            const invalid = cue.end_ms <= cue.start_ms;
            return (
              <li
                key={`${cue.index}-${cue.start_ms}`}
                className={`group relative grid gap-1 border-b border-line px-3 py-2.5 transition-colors duration-150 [contain-intrinsic-size:auto_96px] [content-visibility:auto] last:border-b-0 ${
                  selected ? "bg-accent-soft/50" : "hover:bg-surface-2/50"
                }`}
                onFocusCapture={() => onSelect(cue)}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-[3px] bg-accent transition-opacity duration-150 ${selected ? "opacity-100" : "opacity-0"}`}
                />
                <div className="flex items-center gap-1">
                  <span className="w-7 font-mono text-[0.6875rem] tabular-nums text-subtle">{position + 1}</span>
                  {timeInput(cue, "start_ms")}
                  <Icon name="arrowRight" className="h-3 w-3 shrink-0 text-subtle" />
                  {timeInput(cue, "end_ms")}
                  <span
                    className={`ml-1 font-mono text-[0.6875rem] tabular-nums ${invalid ? "text-danger" : "text-subtle"}`}
                    title={t("editor.duration")}
                  >
                    {(duration / 1000).toFixed(1)}s
                  </span>
                  <div className="ml-auto flex items-center gap-0.5 transition-opacity duration-150 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <IconButton
                      label={t("editor.playSegment")}
                      className="!h-7 !w-7"
                      onClick={() => {
                        onSelect(cue);
                        onSeek?.(cue.start_ms);
                      }}
                    >
                      <Icon name="play" className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label={t("editor.split")} className="!h-7 !w-7" onClick={() => split(cue)}>
                      <Icon name="scissors" className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label={t("editor.merge")} className="!h-7 !w-7" onClick={() => merge(cue)}>
                      <Icon name="merge" className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={t("editor.delete")}
                      className="!h-7 !w-7 hover:!bg-danger-soft hover:!text-danger"
                      onClick={() => remove(cue.index)}
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </div>

                <textarea
                  value={cue.text}
                  rows={1}
                  aria-label={`${t("editor.text")} ${position + 1}`}
                  placeholder={t("editor.textPlaceholder")}
                  onChange={(event) => update(cue.index, { text: event.target.value }, `${cue.index}-text`)}
                  className="min-h-9 w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm leading-6 text-ink [field-sizing:content] placeholder:text-subtle hover:border-line hover:bg-surface focus:border-accent focus:bg-surface focus:shadow-[var(--focus-ring)] focus:outline-none"
                />

                <div className="flex items-center gap-2 pl-8 text-[0.6875rem]">
                  <span className="font-mono tabular-nums text-subtle">{t("editor.chars", { count: chars })}</span>
                  <span
                    className={`rounded px-1 font-mono tabular-nums ${cpsTone}`}
                    title={t("editor.cpsHint", { warn: CPS_WARN, limit: CPS_LIMIT })}
                  >
                    {cps.toFixed(1)} CPS
                  </span>
                  {invalid && <span className="text-danger">{t("editor.invalidTime")}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="hidden items-center gap-2 border-t border-line px-3 py-2 text-[0.6875rem] text-subtle lg:flex">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        {t("editor.nudgeHint")}
      </p>
    </section>
  );
}
