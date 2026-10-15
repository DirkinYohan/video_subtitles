"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Button, Empty, SelectInput, TextInput, Toast, buttonClass } from "@/components/ui";
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
    <div className="grid min-w-0 gap-5 rounded-3xl border border-line bg-white p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{t("player.subtitles")}</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">{t("editor.title")}</h2>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[12rem_minmax(12rem,1fr)_auto_auto]">
        <SelectInput value={language} aria-label={t("player.subtitles")} onChange={(event) => onLanguageChange(event.target.value)}>
          {languages.map((item) => <option key={item} value={item}>{languageLabel(locale, item)}</option>)}
        </SelectInput>
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("editor.search")} aria-label={t("editor.search")} />
        <Button type="button" variant="secondary" onClick={add}>{t("editor.create")}</Button>
        <Button type="button" disabled={pending || cues.length === 0} onClick={() => void save()}>{pending ? t("auth.loading") : t("editor.save")}</Button>
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl bg-paper p-2">
        <span className="px-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("project.export")}</span>
        <a className={buttonClass("ghost")} href={`/api/export/${projectId}/srt?lang=${language}`}>SRT</a>
        <a className={buttonClass("ghost")} href={`/api/export/${projectId}/vtt?lang=${language}`}>VTT</a>
        <a className={buttonClass("ghost")} href={`/api/export/${projectId}/ass?lang=${language}`}>ASS</a>
        <a className={buttonClass("ghost")} href={`/api/export/${projectId}/zip`}>ZIP</a>
      </div>
      {message && <Toast>{message}</Toast>}
      {error && <Toast tone="danger">{error}</Toast>}
      {visible.length === 0 && <Empty>{t("editor.empty")}</Empty>}
      <ul className="grid gap-3">
        {visible.map((cue) => (
          <li
            key={`${cue.index}-${cue.start_ms}`}
            className={`grid min-w-0 gap-4 rounded-2xl border p-4 md:grid-cols-[13rem_minmax(0,1fr)] ${
              selectedIndex === cue.index ? "border-violet/40 bg-violet-soft/60" : "border-line bg-paper/60"
            }`}
            onFocusCapture={() => onSelect(cue)}
          >
            <div className="text-sm text-muted">
              <button
                type="button"
                className="font-medium tabular-nums underline-offset-2 hover:text-ink hover:underline"
                onClick={() => { onSelect(cue); onSeek?.(cue.start_ms); }}
              >
                {formatMs(cue.start_ms)} → {formatMs(cue.end_ms)}
              </button>
              <label className="mt-3 grid gap-1.5 text-xs font-medium">
                {t("editor.start")}
                <input
                  type="text"
                  inputMode="decimal"
                  value={startDraft[cue.index] ?? formatMs(cue.start_ms)}
                  aria-label={t("editor.start")}
                  className="min-h-9 w-full rounded-lg border border-line bg-white px-2 py-1 text-ink outline-none focus:border-accent"
                  onChange={(event) => setStartDraft((current) => ({ ...current, [cue.index]: event.target.value }))}
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
              <label className="mt-2 grid gap-1.5 text-xs font-medium">
                {t("editor.end")}
                <input
                  type="text"
                  inputMode="decimal"
                  value={endDraft[cue.index] ?? formatMs(cue.end_ms)}
                  aria-label={t("editor.end")}
                  className="min-h-9 w-full rounded-lg border border-line bg-white px-2 py-1 text-ink outline-none focus:border-accent"
                  onChange={(event) => setEndDraft((current) => ({ ...current, [cue.index]: event.target.value }))}
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
            <div className="min-w-0">
              <textarea
                value={cue.text}
                aria-label={formatMs(cue.start_ms)}
                onChange={(event) => update(cue.index, { text: event.target.value })}
                className="min-h-28 w-full resize-y rounded-xl border border-line bg-white p-3 text-sm leading-6 outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => { onSelect(cue); onSeek?.(cue.start_ms); }}>{t("editor.playFrom")}</Button>
                <Button type="button" variant="ghost" onClick={() => split(cue)}>{t("editor.split")}</Button>
                <Button type="button" variant="ghost" onClick={() => merge(cue)}>{t("editor.merge")}</Button>
                <Button type="button" variant="danger" onClick={() => remove(cue.index)}>{t("editor.delete")}</Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
