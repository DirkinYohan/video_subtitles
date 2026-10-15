"use client";

import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { buttonClass, fieldClass, type ButtonVariant } from "@/components/classes";

// Re-export para que los Client Components sigan usando una sola ruta.
export { buttonClass, fieldClass };
export type { ButtonVariant };

type Variant = ButtonVariant;

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${buttonClass(variant)} ${className}`} {...props} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid gap-2 text-sm text-ink">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${className}`} />;
}

export function SelectInput({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${className}`} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-white p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "danger"; children: ReactNode }) {
  const tones = {
    neutral: "bg-paper text-muted",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const width = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-skeleton"
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${width}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-paper px-5 py-10 text-center text-sm text-muted">{children}</p>;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Diálogo modal accesible: cierra con Escape, atrapa el foco, bloquea el
 * scroll de fondo y devuelve el foco al elemento que lo abrió.
 */
export function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();

    document.body.dataset.scrollLocked = "true";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null || item === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      delete document.body.dataset.scrollLocked;
      previousFocus.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" tabIndex={-1} className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]" aria-label={label} onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-[0_24px_80px_rgb(24_32_52/0.16)] outline-none"
      >
        {children}
      </div>
    </div>
  );
}

export function Toast({ tone = "ok", children }: { tone?: "ok" | "danger"; children: ReactNode }) {
  const tones = { ok: "bg-ok-soft text-ok", danger: "bg-danger-soft text-danger" };
  return <p role={tone === "danger" ? "alert" : "status"} className={`rounded-xl px-3.5 py-2.5 text-sm ${tones[tone]}`}>{children}</p>;
}
