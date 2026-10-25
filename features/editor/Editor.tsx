"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Button, Empty, SelectInput, TextInput, Toast } from "@/components/ui";
import { formatMs, normalizeCues, parseTimecode, repairCues } from "@/lib/cues";
import { languageLabel } from "@/lib/i18n";
import { putJson } from "@/services/client";
import type { Cue } from "@/types/domain";

/**
 * Editor de subtítulos CONTROLADO.
 *
 * No guarda estado propio de los cues: el dueño es `WatchStudio`, de modo que
 * editor, timeline y reproductor comparten una única fuente de verdad.
 */
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
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [startDraft, setStartDraft] = useState<Record<number, string>>({});
  const [endDraft, setEndDraft] = useState<Record<number, string>>({});

  const visible = useMemo(
    () => cues.filter((cue) => cue.text.toLowerCase().includes(query.toLowerCase())),
    [cues, query],
  );

  function update(index: number, patch: Partial<Cue>) {
    onCuesChange(cues.map((cue) => (cue.index === index ? { ...cue, ...patch } : cue)));
    setMessage("");
  }

  function add() {
    const last = cues[cues.length - 1];
    const start = last ? last.end_ms + 80 : 0;
    const next: Cue = {
      index: cues.length + 1,
      start_ms: start,
      end_ms: start + 1200,
      text: "",
      speaker: last?.speaker || "SPEAKER_00",
      language,
      state: "final",
    };
    onCuesChange(normalizeCues([...cues, next], language));
  }

  function remove(index: number) {
    onCuesChange(normalizeCues(cues.filter((cue) => cue.index !== index), language));
    setMessage("");
  }

  function split(cue: Cue) {
    const middle = cue.start_ms + Math.floor((cue.end_ms - cue.start_ms) / 2);
    const [left, right] = cue.text.split("\n");
    const rest = cues.filter((item) => item.index !== cue.index);
    onCuesChange(
      normalizeCues(
        [
          ...rest,
          { ...cue, end_ms: middle, text: left || cue.text },
          { ...cue, start_ms: middle, text: right || "" },
        ],
        language,
      ),
    );
    setMessage("");
  }

  function merge(cue: Cue) {
    const next = cues.find((item) => item.start_ms >= cue.end_ms);
    if (!next) return;
    onCuesChange(
      normalizeCues(
        cues
          .filter((item) => item.index !== next.index)
          .map((item) =>
            item.index === cue.index
              ? { ...item, end_ms: next.end_ms, text: `${item.text}\n${next.text}`.trim() }
              : item,
          ),
        language,
      ),
    );
    setMessage("");
  }

  async function save() {
    setPending(true);
    setError("");
    const cleaned = repairCues(cues.filter((cue) => cue.text.trim().length > 0)).map((cue, index) => ({
      ...cue,
      index: index + 1,
      language,
    }));
    if (cleaned.length === 0) {
      setPending(false);
      setError(t("editor.emptySave"));
      return;
    }
    try {
      await putJson(`/api/subtitles/${projectId}`, { language, cues: cleaned });
      onCuesChange(cleaned);
      setMessage(t("editor.saved"));
    } catch {
      setError(t("editor.saveError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{t("editor.title")}</h2>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-subtle">{t("project.export")}</span>
          {["srt", "vtt", "ass"].map((kind) => (
            <a
              key={kind}
              className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              href={`/api/export/${projectId}/${kind}?lang=${language}`}
            >
              {kind.toUpperCase()}
            </a>
          ))}
          <a
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            href={`/api/export/${projectId}/zip`}
          >
            ZIP
          </a>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[10rem_minmax(10rem,1fr)_auto_auto]">
        <SelectInput
          value={language}
          aria-label={t("player.subtitles")}
          onChange={(event) => onLanguageChange(event.target.value)}
        >
          {languages.map((item) => (
            <option key={item} value={item}>
              {languageLabel(locale, item)}
            </option>
          ))}
        </SelectInput>

        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          />
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("editor.search")}
            aria-label={t("editor.search")}
            className="pl-9"
          />
        </div>

        <Button type="button" variant="secondary" onClick={add}>
          <Icon name="plus" className="h-4 w-4" />
          {t("editor.create")}
        </Button>
        <Button type="button" disabled={pending || cues.length === 0} onClick={() => void save()}>
          {pending ? t("auth.loading") : t("editor.save")}
        </Button>
      </div>

      {message && <Toast>{message}</Toast>}
      {error && <Toast tone="danger">{error}</Toast>}
      {visible.length === 0 && <Empty>{t("editor.empty")}</Empty>}

      <ul className="grid gap-2">
        {visible.map((cue) => (
          <li
            key={`${cue.index}-${cue.start_ms}`}
            className={`grid min-w-0 gap-3 rounded-lg border p-3 md:grid-cols-[11rem_minmax(0,1fr)] ${
              selectedIndex === cue.index
                ? "border-accent bg-accent-soft/50"
                : "border-line bg-surface"
            }`}
            onFocusCapture={() => onSelect(cue)}
          >
            <div className="text-sm">
              <button
                type="button"
                className="tabular font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                onClick={() => {
                  onSelect(cue);
                  onSeek?.(cue.start_ms);
                }}
              >
                {formatMs(cue.start_ms)} → {formatMs(cue.end_ms)}
              </button>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <label className="grid gap-1 text-[0.6875rem] font-medium text-subtle">
                  {t("editor.start")}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={startDraft[cue.index] ?? formatMs(cue.start_ms)}
                    aria-label={t("editor.start")}
                    className="tabular min-h-8 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:shadow-[var(--focus-ring)]"
                    onChange={(event) =>
                      setStartDraft((current) => ({ ...current, [cue.index]: event.target.value }))
                    }
                    onBlur={(event) => {
                      const parsed = parseTimecode(event.target.value);
                      setStartDraft((current) => {
                        const next = { ...current };
                        delete next[cue.index];
                        return next;
                      });
                      if (parsed !== null) update(cue.index, { start_ms: parsed });
                    }}
                  />
                </label>
                <label className="grid gap-1 text-[0.6875rem] font-medium text-subtle">
                  {t("editor.end")}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={endDraft[cue.index] ?? formatMs(cue.end_ms)}
                    aria-label={t("editor.end")}
                    className="tabular min-h-8 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:shadow-[var(--focus-ring)]"
                    onChange={(event) =>
                      setEndDraft((current) => ({ ...current, [cue.index]: event.target.value }))
                    }
                    onBlur={(event) => {
                      const parsed = parseTimecode(event.target.value);
                      setEndDraft((current) => {
                        const next = { ...current };
                        delete next[cue.index];
                        return next;
                      });
                      if (parsed !== null) update(cue.index, { end_ms: parsed });
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="min-w-0">
              <textarea
                value={cue.text}
                aria-label={formatMs(cue.start_ms)}
                onChange={(event) => update(cue.index, { text: event.target.value })}
                className="min-h-24 w-full resize-y rounded-md border border-line bg-surface p-2.5 text-sm leading-6 text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:shadow-[var(--focus-ring)]"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSelect(cue);
                    onSeek?.(cue.start_ms);
                  }}
                >
                  <Icon name="play" className="h-3.5 w-3.5" />
                  {t("editor.playFrom")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => split(cue)}>
                  {t("editor.split")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => merge(cue)}>
                  {t("editor.merge")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-danger hover:bg-danger-soft hover:text-danger"
                  onClick={() => remove(cue.index)}
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                  {t("editor.delete")}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
