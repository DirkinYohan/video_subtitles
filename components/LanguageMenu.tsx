"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, languageLabel, type Locale } from "@/lib/i18n";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";

const FLAGS: Record<Locale, string> = { es: "🇪🇸", en: "🇺🇸" };

/**
 * Selector de idioma como `menu` de radio: navegación con flechas, Inicio/Fin,
 * Escape para cerrar y foco devuelto al botón que lo abrió.
 */
export function LanguageMenu({ align = "right" }: { align?: "left" | "right" }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[LOCALES.indexOf(locale)]?.focus();

    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, locale]);

  function moveFocus(from: number, delta: number) {
    const total = LOCALES.length;
    const next = (from + delta + total) % total;
    itemRefs.current[next]?.focus();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("lang.menu")}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon name="globe" className="hidden h-4 w-4 text-subtle sm:block" />
        <span>{locale.toUpperCase()}</span>
        <Icon name="chevron" className="h-3.5 w-3.5 text-subtle" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("lang.menu")}
          data-elevated="true"
          className={`absolute z-40 mt-1 w-52 rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-float)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {LOCALES.map((item, index) => (
            <button
              key={item}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={item === locale}
              tabIndex={item === locale ? 0 : -1}
              className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors ${
                item === locale
                  ? "bg-accent-soft font-medium text-accent-ink"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
              onClick={() => {
                setLocale(item);
                setOpen(false);
                triggerRef.current?.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); moveFocus(index, 1); }
                if (event.key === "ArrowUp") { event.preventDefault(); moveFocus(index, -1); }
                if (event.key === "Home") { event.preventDefault(); itemRefs.current[0]?.focus(); }
                if (event.key === "End") { event.preventDefault(); itemRefs.current[LOCALES.length - 1]?.focus(); }
              }}
            >
              <span aria-hidden className="grid w-4 shrink-0 place-items-center text-accent">
                {item === locale && <Icon name="check" className="h-3.5 w-3.5" />}
              </span>
              <span aria-hidden>{FLAGS[item]}</span>
              <span className="truncate">{languageLabel(locale, item)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
