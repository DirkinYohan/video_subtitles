"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Flag } from "@/components/Flag";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Popover, useDismiss } from "@/components/kit";
import { languageLabel } from "@/lib/i18n";
import { NATIVE_NAMES, readRecentLanguages, rememberLanguage } from "@/lib/languages";

type Common = {
  options: readonly string[];
  label: string;
  /** Muestra "Detectar automáticamente" como primera opción (código "und"). */
  allowAuto?: boolean;
  disabled?: boolean;
  placement?: "bottom-start" | "bottom-end";
  size?: "sm" | "md";
  className?: string;
};
type Single = Common & { multiple?: false; value: string; onChange: (value: string) => void };
type Multi = Common & { multiple: true; value: string[]; onChange: (value: string[]) => void };

/**
 * Combobox de idioma: buscador, banderas, nombre nativo + traducido,
 * "Recientes", navegación completa con teclado y check en lo elegido.
 */
export function LanguagePicker(props: Single | Multi) {
  const { options, label, allowAuto = false, disabled = false, placement = "bottom-start", size = "md", className = "" } = props;
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  useDismiss(open, close, [wrap], trigger);

  const selected = props.multiple ? props.value : [props.value];
  const isSelected = (code: string) => selected.includes(code);

  const all = useMemo(() => (allowAuto ? ["und", ...options] : [...options]), [allowAuto, options]);
  const name = useCallback(
    (code: string) => (code === "und" ? t("studio.auto") : languageLabel(locale, code)),
    [locale, t],
  );

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (code: string) =>
      !needle ||
      name(code).toLowerCase().includes(needle) ||
      (NATIVE_NAMES[code] ?? "").toLowerCase().includes(needle) ||
      code.includes(needle);
    const recents = needle ? [] : recent.filter((code) => options.includes(code));
    const rest = all.filter((code) => matches(code) && !recents.includes(code));
    return [
      ...recents.map((code) => ({ code, group: "recent" as const })),
      ...rest.map((code) => ({ code, group: "all" as const })),
    ];
  }, [all, name, options, query, recent]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  function openMenu() {
    if (disabled) return;
    setRecent(readRecentLanguages());
    const first = Math.max(0, items.findIndex((item) => isSelected(item.code)));
    setActive(first);
    setOpen(true);
  }

  function pick(code: string) {
    rememberLanguage(code);
    if (props.multiple) {
      const next = isSelected(code) ? props.value.filter((item) => item !== code) : [...props.value, code];
      props.onChange(next);
    } else {
      props.onChange(code);
      close();
      trigger.current?.focus();
    }
  }

  const current = Math.min(active, Math.max(0, items.length - 1));
  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>(`[data-option="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current, open]);

  const summary = props.multiple ? (
    props.value.length === 0 ? (
      <span className="text-subtle">{t("picker.none")}</span>
    ) : (
      <span className="flex min-w-0 items-center gap-1.5">
        {props.value.slice(0, 4).map((code) => (
          <Flag key={code} code={code} />
        ))}
        <span className="truncate">
          {props.value.length === 1 ? name(props.value[0] as string) : t("picker.count", { count: props.value.length })}
        </span>
      </span>
    )
  ) : (
    <span className="flex min-w-0 items-center gap-2">
      <Flag code={props.value} />
      <span className="truncate">{name(props.value)}</span>
    </span>
  );

  return (
    <div className={`relative ${className}`} ref={wrap}>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") && !open) {
            event.preventDefault();
            openMenu();
          }
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface text-left text-sm text-ink hover:border-subtle focus-visible:border-accent focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted ${
          size === "sm" ? "min-h-9 px-2.5" : "min-h-11 px-3.5"
        }`}
      >
        {summary}
        <Icon name="chevron" className={`h-4 w-4 shrink-0 text-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <Popover open={open} placement={placement} className="w-[min(18rem,calc(100vw-2rem))] !p-0">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Icon name="search" className="h-4 w-4 shrink-0 text-subtle" />
          <input
            ref={inputRef}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[current] ? `${listId}-${items[current].code}` : undefined}
            aria-label={label}
            placeholder={t("picker.search")}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((value) => Math.min(items.length - 1, value + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((value) => Math.max(0, value - 1));
              } else if (event.key === "Home") {
                event.preventDefault();
                setActive(0);
              } else if (event.key === "End") {
                event.preventDefault();
                setActive(items.length - 1);
              } else if (event.key === "Enter") {
                event.preventDefault();
                const item = items[current];
                if (item) pick(item.code);
              } else if (event.key === "Tab") {
                close();
              }
            }}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-subtle focus:outline-none"
          />
        </div>
        <ul id={listId} role="listbox" aria-multiselectable={props.multiple || undefined} className="max-h-72 overflow-y-auto p-1">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t("palette.empty")}</li>}
          {items.map((item, index) => {
            const showHeader = index === 0 || items[index - 1]?.group !== item.group;
            const chosen = isSelected(item.code);
            return (
              <li key={`${item.group}-${item.code}`} role="presentation">
                {showHeader && (recent.length > 0 || item.group === "recent") && !query && (
                  <p className="px-2.5 pb-1 pt-2 text-xs font-medium text-subtle">
                    {item.group === "recent" ? t("picker.recent") : t("picker.all")}
                  </p>
                )}
                <div
                  id={`${listId}-${item.code}`}
                  role="option"
                  aria-selected={chosen}
                  data-option={index}
                  onPointerMove={() => setActive(index)}
                  onClick={() => pick(item.code)}
                  className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm ${
                    index === current ? "bg-surface-2" : ""
                  }`}
                >
                  <Flag code={item.code} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-ink">{item.code === "und" ? name("und") : (NATIVE_NAMES[item.code] ?? name(item.code))}</span>
                    {item.code !== "und" && NATIVE_NAMES[item.code] !== name(item.code) && (
                      <span className="text-subtle"> · {name(item.code)}</span>
                    )}
                  </span>
                  <span className="grid w-4 place-items-center text-accent">
                    {chosen && <Icon name="check" weight="bold" className="h-4 w-4" />}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}
