"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Button, Empty, IconButton, SelectInput, TextInput, Toast } from "@/components/ui";
import { formatMs, normalizeCues, parseTimecode, repairCues } from "@/lib/cues";
import { languageLabel } from "@/lib/i18n";
import { putJson } from "@/services/client";
import type { Cue } from "@/types/domain";

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

  const timeField =
    "tabular h-7 w-[5.75rem] rounded-md border border-transparent bg-transparent px-1.5 text-xs text-ink-2 " +
    "hover:border-line hover:bg-surface focus:border-accent focus:bg-surface focus:text-ink focus:outline-none focus:shadow-[var(--focus-ring)]";

  return (
    <section className="grid min-w-0 gap-5 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{t("editor.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("editor.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-subtle">{t("project.export")}</span>
          <div className="flex items-center rounded-lg border border-line bg-surface p-0.5 shadow-[var(--shadow-card)]">
            {["srt", "vtt", "ass"].map((kind) => (
              <a
                key={kind}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
                href={`/api/export/${projectId}/${kind}?lang=${language}`}
              >
                {kind.toUpperCase()}
              </a>
            ))}
            <a
              className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
              href={`/api/export/${projectId}/zip`}
            >
              ZIP
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[11rem_minmax(10rem,1fr)_auto_auto]">
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
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          />
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("editor.search")}
            aria-label={t("editor.search")}
            className="pl-10"
          />
        </div>

        <Button type="button" variant="secondary" className="min-h-11" onClick={add}>
          <Icon name="plus" className="h-4 w-4" />
          {t("editor.create")}
        </Button>
        <Button type="button" className="min-h-11" disabled={pending || cues.length === 0} onClick={() => void save()}>
          <Icon name="check" className="h-4 w-4" />
          {pending ? t("auth.loading") : t("editor.save")}
        </Button>
      </div>

      {message && <Toast>{message}</Toast>}
      {error && <Toast tone="danger">{error}</Toast>}
      {visible.length === 0 && <Empty>{t("editor.empty")}</Empty>}

      <ol className="grid divide-y divide-line overflow-hidden rounded-xl border border-line">
        {visible.map((cue, position) => {
          const selected = selectedIndex === cue.index;
          return (
            <li
              key={`${cue.index}-${cue.start_ms}`}
              className={`group relative grid min-w-0 gap-2 px-3.5 py-2.5 transition-colors duration-150 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-3 ${
                selected ? "bg-accent-soft/60" : "bg-surface hover:bg-surface-2/60"
              }`}
              onFocusCapture={() => onSelect(cue)}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-[3px] bg-accent transition-opacity ${selected ? "opacity-100" : "opacity-0"}`}
              />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="tabular inline-flex w-fit items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold text-subtle hover:bg-surface-2 hover:text-ink"
                  onClick={() => {
                    onSelect(cue);
                    onSeek?.(cue.start_ms);
                  }}
                  title={t("editor.playFrom")}
                >
                  #{position + 1}
                </button>
                <label className="flex items-center gap-1">
                  <span className="sr-only">{t("editor.start")}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={startDraft[cue.index] ?? formatMs(cue.start_ms)}
                    aria-label={t("editor.start")}
                    className={timeField}
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
                <label className="flex items-center gap-1">
                  <span aria-hidden="true" className="text-xs text-subtle">
                    →
                  </span>
                  <span className="sr-only">{t("editor.end")}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={endDraft[cue.index] ?? formatMs(cue.end_ms)}
                    aria-label={t("editor.end")}
                    className={timeField}
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

              <textarea
                value={cue.text}
                rows={1}
                aria-label={formatMs(cue.start_ms)}
                onChange={(event) => update(cue.index, { text: event.target.value })}
                className="min-h-9 w-full resize-none rounded-lg [field-sizing:content] border border-transparent bg-transparent px-2.5 py-1.5 text-sm leading-6 text-ink placeholder:text-subtle hover:border-line hover:bg-surface focus:border-accent focus:bg-surface focus:outline-none focus:shadow-[var(--focus-ring)]"
              />

              <div className="flex items-center gap-0.5 transition-opacity duration-150 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                <IconButton
                  label={t("editor.playFrom")}
                  className="!h-8 !w-8"
                  onClick={() => {
                    onSelect(cue);
                    onSeek?.(cue.start_ms);
                  }}
                >
                  <Icon name="play" className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label={t("editor.split")} className="!h-8 !w-8" onClick={() => split(cue)}>
                  <Icon name="scissors" className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label={t("editor.merge")} className="!h-8 !w-8" onClick={() => merge(cue)}>
                  <Icon name="merge" className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  label={t("editor.delete")}
                  className="!h-8 !w-8 hover:!bg-danger-soft hover:!text-danger"
                  onClick={() => remove(cue.index)}
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
