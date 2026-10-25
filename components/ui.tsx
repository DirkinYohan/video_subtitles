"use client";

import { useEffect, useRef } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

import {
  buttonClass,
  cardClass,
  fieldClass,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/classes";

// Re-export para que los Client Components sigan usando una sola ruta.
export { buttonClass, cardClass, fieldClass };
export type { ButtonSize, ButtonVariant };

type Variant = ButtonVariant;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: ButtonSize }) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

/** Botón cuadrado para controles del reproductor y de la barra superior. */
export function IconButton({
  label,
  variant = "ghost",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: Variant }) {
  const tones: Record<Variant, string> = {
    primary: "bg-accent text-on-accent hover:bg-accent-strong",
    secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
    ghost: "text-muted hover:bg-surface-2 hover:text-ink",
    danger: "bg-danger-soft text-danger hover:bg-danger-softer",
    soft: "bg-accent-soft text-accent-ink hover:bg-accent-softer",
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50 ${tones[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  htmlFor?: string;
}) {
  return (
    <label className="grid gap-2 text-sm" htmlFor={htmlFor}>
      {/* La etiqueta va SIEMPRE encima del campo; nunca dentro como placeholder. */}
      <span className="font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-xs font-medium text-danger">
          {error}
        </span>
      ) : (
        hint && <span className="text-xs leading-5 text-muted">{hint}</span>
      )}
    </label>
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${className}`} />;
}

export function SelectInput({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${className}`} />;
}

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
}) {
  return <Tag className={`${cardClass} p-5 sm:p-6 ${className}`}>{children}</Tag>;
}

/** Encabezado de sección: título y, si hace falta, una frase de apoyo. */
export function SectionHeader({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {description && (
          <p className="mt-1 max-w-[65ch] text-sm leading-6 text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent-ink",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Punto de estado: el mismo lenguaje visual en toda la aplicación. */
export function StatusDot({ tone = "neutral", pulse = false }: { tone?: Tone; pulse?: boolean }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-subtle",
    accent: "bg-accent",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
  };
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" aria-hidden="true">
      {pulse && (
        <span
          className={`absolute inset-0 animate-ping rounded-full opacity-60 ${tones[tone]}`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${tones[tone]}`} />
    </span>
  );
}

export function Progress({
  value,
  label,
  tone = "accent",
}: {
  value: number;
  label?: string;
  tone?: "accent" | "ok" | "warn" | "danger";
}) {
  const width = Math.max(0, Math.min(100, Math.round(value)));
  const tones = { accent: "bg-accent", ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" };
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${tones[tone]}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function Empty({
  children,
  icon,
  action,
}: {
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="text-subtle">{icon}</div>}
      <p className="max-w-sm text-sm leading-6 text-muted">{children}</p>
      {action}
    </div>
  );
}

/** Caja de aviso en línea: informa sin interrumpir. */
export function Callout({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warn" | "danger";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <p role={tone === "danger" ? "alert" : undefined} className={`rounded-md px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
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
 *
 * Entra con un cambio de escala mínimo desde el centro: un modal no está
 * anclado a ningún disparador, así que su origen correcto es el centro.
 */
export function Modal({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
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
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-scrim backdrop-blur-[2px]"
        aria-label={label}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-elevated="true"
        className="relative z-10 w-full max-w-md rounded-2xl bg-surface p-6 shadow-[var(--shadow-dialog)] outline-none"
      >
        {children}
      </div>
    </div>
  );
}

export function Toast({ tone = "ok", children }: { tone?: "ok" | "danger"; children: ReactNode }) {
  const tones = { ok: "bg-ok-soft text-ok", danger: "bg-danger-soft text-danger" };
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      data-elevated="true"
      className={`rounded-md px-3 py-2.5 text-sm ${tones[tone]}`}
    >
      {children}
    </p>
  );
}
