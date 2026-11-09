"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";

/* Movimiento compartido. Springs críticamente amortiguados (sin rebote) para
   todo lo que aparece; la hoja lateral lleva un rebote mínimo. */
export const SPRING = { type: "spring", duration: 0.32, bounce: 0 } as const;
export const SPRING_SHEET = { type: "spring", duration: 0.42, bounce: 0.08 } as const;

/* ------------------------------------------------------------------ */
/* Cierre al pulsar fuera o Escape                                     */
/* ------------------------------------------------------------------ */

export function useDismiss(
  open: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement | null>[],
  returnFocus?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
      returnFocus?.current?.focus();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
    // refs es estable por llamada
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}

/* ------------------------------------------------------------------ */
/* Tooltip                                                             */
/* ------------------------------------------------------------------ */

/**
 * Tooltip de CSS: aparece tras 400 ms con el cursor o al instante con el foco
 * de teclado, y desaparece sin animación. Sólo decora: el control conserva su
 * propio aria-label.
 */
export function Tooltip({
  label,
  shortcut,
  side = "top",
  children,
  className = "",
}: {
  label: string;
  shortcut?: string;
  side?: "top" | "bottom";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="presentation"
        className={`pointer-events-none absolute left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-paper opacity-0 shadow-[var(--shadow-float)] transition-opacity duration-100 group-hover/tip:opacity-100 group-hover/tip:delay-[400ms] group-has-[:focus-visible]/tip:opacity-100 group-has-[:focus-visible]/tip:delay-0 ${
          side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
        }`}
      >
        {label}
        {shortcut && <Kbd tone="invert">{shortcut}</Kbd>}
      </span>
    </span>
  );
}

export function Kbd({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "invert" }) {
  return (
    <kbd
      className={`inline-grid min-w-[1.25rem] place-items-center rounded-[5px] px-1 font-mono text-[0.6875rem] font-medium leading-[1.125rem] ${
        tone === "invert" ? "bg-paper/15 text-paper" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line"
      }`}
    >
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ */
/* Popover anclado a su disparador                                     */
/* ------------------------------------------------------------------ */

const ORIGINS = {
  "bottom-end": "top right",
  "bottom-start": "top left",
  "top-end": "bottom right",
  "top-start": "bottom left",
} as const;

export function Popover({
  open,
  placement = "bottom-end",
  className = "",
  children,
  label,
  role = "dialog",
  id,
}: {
  open: boolean;
  placement?: keyof typeof ORIGINS;
  className?: string;
  children: ReactNode;
  label?: string;
  role?: "dialog" | "menu" | "listbox";
  id?: string;
}) {
  const reduce = useReducedMotion();
  const position =
    placement === "bottom-end"
      ? "right-0 top-[calc(100%+6px)]"
      : placement === "bottom-start"
        ? "left-0 top-[calc(100%+6px)]"
        : placement === "top-end"
          ? "right-0 bottom-[calc(100%+6px)]"
          : "left-0 bottom-[calc(100%+6px)]";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id={id}
          role={role}
          aria-label={label}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
          transition={SPRING}
          style={{ transformOrigin: ORIGINS[placement] }}
          className={`material-raised absolute z-50 rounded-xl p-1 shadow-[var(--shadow-float)] ${position} ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MenuItem({
  icon,
  children,
  onSelect,
  href,
  tone = "default",
  hint,
}: {
  icon?: Parameters<typeof Icon>[0]["name"];
  children: ReactNode;
  onSelect?: () => void;
  href?: string;
  tone?: "default" | "danger";
  hint?: ReactNode;
}) {
  const className = `flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm outline-none transition-colors duration-100 ${
    tone === "danger"
      ? "text-danger hover:bg-danger-soft focus-visible:bg-danger-soft"
      : "text-ink hover:bg-surface-2 focus-visible:bg-surface-2"
  }`;
  const content = (
    <>
      {icon && <Icon name={icon} className={`h-4 w-4 shrink-0 ${tone === "danger" ? "" : "text-subtle"}`} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint}
    </>
  );
  if (href) {
    return (
      <a role="menuitem" href={href} className={className} onClick={onSelect}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" role="menuitem" className={className} onClick={onSelect}>
      {content}
    </button>
  );
}

/** Flechas arriba/abajo entre los menuitem de un menú. */
export function menuKeys(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemradio"]'));
  if (items.length === 0) return;
  event.preventDefault();
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}

/* ------------------------------------------------------------------ */
/* Control segmentado con indicador que se desliza                     */
/* ------------------------------------------------------------------ */

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  value: T;
  options: { value: T; label: ReactNode; ariaLabel?: string }[];
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const group = useId();
  const reduce = useReducedMotion();
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-[10px] bg-nav p-[3px] ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            data-no-press
            onClick={() => onChange(option.value)}
            className={`relative inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] font-medium transition-colors duration-150 ${
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm"
            } ${active ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${group}`}
                transition={reduce ? { duration: 0 } : SPRING}
                className="absolute inset-0 rounded-[7px] bg-nav-active shadow-[var(--shadow-card)]"
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progreso                                                            */
/* ------------------------------------------------------------------ */

export function ProgressRing({
  value,
  size = 20,
  stroke = 2.5,
  indeterminate = false,
  label,
  className = "text-accent",
}: {
  value?: number;
  size?: number;
  stroke?: number;
  indeterminate?: boolean;
  label?: string;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${indeterminate ? "spin" : ""} ${className}`}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuenow={indeterminate || !label ? undefined : Math.round(pct)}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-hidden={label ? undefined : true}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={indeterminate ? circumference * 0.72 : circumference * (1 - pct / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 400ms var(--ease-standard)" }}
      />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

/* ------------------------------------------------------------------ */
/* Interruptor                                                         */
/* ------------------------------------------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-caption text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-no-press
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ease-[var(--ease-standard)] focus-visible:shadow-[var(--focus-ring)] disabled:opacity-50 ${
          checked ? "bg-accent" : "bg-line-strong"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform duration-200 ease-[var(--ease-standard)] ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hoja lateral (sheet)                                                */
/* ------------------------------------------------------------------ */

const noopSubscribe = () => () => undefined;

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(open: boolean, rootRef: RefObject<HTMLElement | null>, onClose: () => void) {
  const previous = useRef<HTMLElement | null>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useEffect(() => {
    if (!open) return;
    previous.current = document.activeElement as HTMLElement | null;
    const root = rootRef.current;
    const first = root?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? root)?.focus();
    document.body.dataset.scrollLocked = "true";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const node = rootRef.current;
      if (!node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null,
      );
      if (items.length === 0) return;
      const head = items[0] as HTMLElement;
      const tail = items[items.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      delete document.body.dataset.scrollLocked;
      previous.current?.focus?.();
    };
  }, [open, rootRef, close]);
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useFocusTrap(open, ref, onClose);
  const titleId = useId();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            tabIndex={-1}
            aria-label={closeLabel}
            data-no-press
            className="absolute inset-0 cursor-default bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { transform: "translateX(100%)" }}
            animate={reduce ? { opacity: 1 } : { transform: "translateX(0%)" }}
            exit={reduce ? { opacity: 0 } : { transform: "translateX(100%)", transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } }}
            transition={SPRING_SHEET}
            className="absolute inset-y-0 right-0 flex h-[100dvh] w-full max-w-[30rem] flex-col border-l border-line bg-surface shadow-[var(--shadow-dialog)] outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-xl font-semibold tracking-[-0.02em] text-ink">
                  {title}
                </h2>
                {description && <p className="mt-1 text-caption text-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {footer && <footer className="border-t border-line px-6 py-4">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
