"use client";

import { useCallback, useEffect, useState } from "react";
import { isActive } from "@/lib/status";
import type { Job } from "@/types/domain";

const POLL_MS = 1500;

/**
 * Fuente ÚNICA de estado de un job.
 *
 * Un solo sondeo por job en toda la aplicación: los componentes que necesitan
 * el progreso lo reciben por props en lugar de consultar por su cuenta.
 * Se detiene en cuanto el job alcanza un estado terminal.
 *
 * `onSettled` se invoca UNA vez cuando el job termina (con éxito, parcial,
 * fallo o cancelación), para recargar subtítulos o el idioma detectado.
 */
export function useJobProgress(initial: Job | null, onSettled?: (job: Job) => void) {
  const [job, setJob] = useState<Job | null>(initial);
  const [error, setError] = useState("");
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  // Identidad del último job adoptado: si el servidor entrega otro objeto, se
  // adopta. Se guarda en estado (no en un ref) para no mutar nada en render.
  const [adopted, setAdopted] = useState<Job | null>(initial);
  const [, setDoneKey] = useState("");

  if (adopted !== initial) {
    setAdopted(initial);
    setJob(initial);
    setFinishedAt(null);
    setError("");
    setDoneKey("");
  }

  const refresh = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/jobs/${id}/progress`, { credentials: "include" });
        if (!response.ok) {
          setError(response.status === 401 ? "unauthorized" : "network");
          return;
        }
        const next = (await response.json()) as Job;
        setError("");
        setJob(next);
        const key = `${next.id}:${next.status}`;
        if (!isActive(next.status)) {
          // El guardia por clave evita notificar dos veces el mismo final.
          setDoneKey((current) => {
            if (current === key) return current;
            setFinishedAt(Date.now());
            onSettled?.(next);
            return key;
          });
        }
      } catch {
        // Un fallo de red no debe romper el sondeo ni la página.
        setError("network");
      }
    },
    [onSettled],
  );

  useEffect(() => {
    if (!job || !isActive(job.status)) return;
    let cancelled = false;
    let timer = 0;
    const tick = async () => {
      if (cancelled) return;
      await refresh(job.id);
      if (!cancelled) timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [job, refresh]);

  const cancel = useCallback(async () => {
    if (!job) return false;
    try {
      const response = await fetch(`/api/jobs/${job.id}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        setError("cancel");
        return false;
      }
      await refresh(job.id);
      return true;
    } catch {
      setError("cancel");
      return false;
    }
  }, [job, refresh]);

  const retry = useCallback(
    async (projectId: string, mode: "progressive" | "full" = "progressive") => {
      try {
        const response = await fetch("/api/jobs", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, mode }),
        });
        if (!response.ok) {
          setError("retry");
          return false;
        }
        const created = (await response.json()) as { id: string };
        setDoneKey("");
        setFinishedAt(null);
        const next: Job = {
          id: created.id,
          project_id: projectId,
          status: "QUEUED",
          progress: 0,
          stage: "QUEUED",
          error: "",
          updated_at: new Date().toISOString(),
          stage_history: [],
          mode,
          last_cue_ms: 0,
        };
        setAdopted(next);
        setJob(next);
        return true;
      } catch {
        setError("retry");
        return false;
      }
    },
    [],
  );

  return { job, error, finishedAt, cancel, retry, refresh, setJob };
}