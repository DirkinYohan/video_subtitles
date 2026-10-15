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
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-paper"
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
        <Icon name="globe" className="h-4 w-4 text-muted" />
        <span>{locale.toUpperCase()}</span>
        <Icon name="chevron" className="h-4 w-4 text-muted" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("lang.menu")}
          className={`absolute z-40 mt-1.5 w-52 rounded-2xl border border-line bg-white p-1.5 shadow-[0_16px_45px_rgb(24_32_52/0.14)] ${align === "right" ? "right-0" : "left-0"}`}
        >
          <p className="px-2.5 py-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">{t("lang.menu")}</p>
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
              className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm ${item === locale ? "bg-accent-soft font-semibold text-accent" : "hover:bg-paper"}`}
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
              <span aria-hidden className="w-4 text-accent">{item === locale ? "✓" : ""}</span>
              <span aria-hidden>{FLAGS[item]}</span>
              <span>{languageLabel(locale, item)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
