"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { SPRING } from "@/components/kit";

type Tone = "ok" | "danger" | "info";
type Item = { id: number; tone: Tone; message: string };
type ToastApi = { success: (message: string) => void; error: (message: string) => void; info: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Avisos transitorios abajo al centro. Entran y salen por el mismo borde
 * (consistencia espacial); el temporizador se detiene con el cursor encima.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, number>());
  const reduce = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const schedule = useCallback(
    (id: number, ms = 4200) => {
      window.clearTimeout(timers.current.get(id));
      timers.current.set(id, window.setTimeout(() => dismiss(id), ms));
    },
    [dismiss],
  );

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = ++seq.current;
      setItems((current) => [...current.slice(-2), { id, tone, message }]);
      schedule(id, tone === "danger" ? 6500 : 4200);
    },
    [schedule],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("ok", message),
      error: (message) => push("danger", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ol
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout={!reduce}
              role={item.tone === "danger" ? "alert" : "status"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(16px) scale(0.98)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px) scale(1)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(16px) scale(0.98)", transition: { duration: 0.16 } }}
              transition={SPRING}
              onPointerEnter={() => window.clearTimeout(timers.current.get(item.id))}
              onPointerLeave={() => schedule(item.id, 2000)}
              className="material-raised pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl py-2.5 pl-3.5 pr-2 text-sm text-ink shadow-[var(--shadow-float)]"
            >
              <Icon
                name={item.tone === "ok" ? "checkCircle" : item.tone === "danger" ? "alert" : "spark"}
                weight="fill"
                className={`h-[18px] w-[18px] shrink-0 ${item.tone === "ok" ? "text-ok" : item.tone === "danger" ? "text-danger" : "text-accent"}`}
              />
              <span className="min-w-0 flex-1">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="×"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-ink"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast fuera de ToastProvider");
  return api;
}
