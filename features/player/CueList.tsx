"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Switch } from "@/components/kit";
import { displayCueText, formatClock, overlappingCue, transcriptCues } from "@/lib/cues";
import type { Cue } from "@/types/domain";

/**
 * Transcripción sincronizada. Oculta los segmentos vacíos, une visualmente las
 * frases cortadas y sigue al reproductor con un desplazamiento suave que se
 * detiene en cuanto la persona desplaza la lista a mano.
 */
export function CueList({
  cues,
  activeIndex,
  selectedIndex,
  onSelect,
  onSeek,
  heightClass = "max-h-80",
  sourceCues,
}: {
  cues: Cue[];
  activeIndex: number | null;
  selectedIndex: number | null;
  onSelect: (cue: Cue) => void;
  onSeek: (ms: number) => void;
  heightClass?: string;
  sourceCues?: Cue[];
}) {
  const { t } = useI18n();
  const listRef = useRef<HTMLOListElement>(null);
  const [follow, setFollow] = useState(true);
  const [bilingual, setBilingual] = useState(false);
  const programmatic = useRef(false);
  const rows = useMemo(() => transcriptCues(cues), [cues]);
  const canBilingual = Boolean(sourceCues && sourceCues.length > 0);

  const scrollToActive = useCallback((behavior: ScrollBehavior) => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>("[aria-current=true]");
    if (!list || !item) return;
    programmatic.current = true;
    const top = item.offsetTop - list.clientHeight / 3;
    list.scrollTo({ top: Math.max(0, top), behavior });
    window.setTimeout(() => {
      programmatic.current = false;
    }, behavior === "smooth" ? 450 : 50);
  }, []);

  useEffect(() => {
    if (!follow || activeIndex === null) return;
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>("[aria-current=true]");
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop + 8 || bottom > list.scrollTop + list.clientHeight - 8) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollToActive(reduce ? "auto" : "smooth");
    }
  }, [activeIndex, follow, scrollToActive]);

  // Desplazamiento manual (rueda, toque o barra) => deja de seguir.
  const stopFollowing = useCallback(() => {
    if (!programmatic.current) setFollow(false);
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface">
      {canBilingual && (
        <div className="border-b border-line px-4 py-2.5">
          <Switch checked={bilingual} onChange={setBilingual} label={t("transcript.bilingual")} />
        </div>
      )}
      <ol
        ref={listRef}
        onWheel={stopFollowing}
        onTouchMove={stopFollowing}
        onKeyDown={(event) => {
          if (["PageUp", "PageDown", "Home", "End"].includes(event.key)) stopFollowing();
        }}
        className={`relative overflow-y-auto overscroll-contain p-1.5 ${heightClass}`}
        aria-label={t("player.cueList")}
      >
        {rows.map((item) => {
          const isActive = activeIndex === item.index;
          const isSelected = selectedIndex === item.index;
          const original = bilingual && sourceCues ? overlappingCue(item, sourceCues) : null;
          return (
            <li key={`${item.index}-${item.start_ms}`} className={item.continues ? "-mt-1" : ""}>
              <button
                type="button"
                aria-current={isActive ? "true" : undefined}
                title={item.continues ? `${formatClock(item.start_ms)} · ${t("transcript.continues")}` : undefined}
                className={`relative grid w-full grid-cols-[3rem_minmax(0,1fr)] gap-x-3 rounded-xl px-3 text-left text-sm transition-colors duration-150 ${
                  item.continues ? "pb-2.5 pt-1" : "py-2.5"
                } ${
                  isActive
                    ? "bg-accent-soft text-ink"
                    : isSelected
                      ? "bg-surface-2 text-ink"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
                onClick={() => {
                  onSelect(item);
                  onSeek(item.start_ms);
                }}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent transition-opacity duration-200 ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
                <span
                  className={`pt-px font-mono text-xs tabular-nums ${
                    isActive ? "font-medium text-accent-ink" : "text-subtle"
                  }`}
                >
                  {item.continues ? (
                    <span aria-label={t("transcript.continues")} className="pl-1 text-line-strong">
                      ↳
                    </span>
                  ) : (
                    formatClock(item.start_ms)
                  )}
                </span>
                <span className="min-w-0">
                  {original && (
                    <span className="mb-0.5 block whitespace-pre-line text-caption leading-5 text-subtle">
                      {displayCueText(original.text)}
                    </span>
                  )}
                  <span className="block whitespace-pre-line leading-relaxed">{item.display}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <AnimatePresence>
        {!follow && activeIndex !== null && (
          <motion.button
            type="button"
            data-no-press
            initial={{ opacity: 0, transform: "translate(-50%, 8px)" }}
            animate={{ opacity: 1, transform: "translate(-50%, 0px)" }}
            exit={{ opacity: 0, transform: "translate(-50%, 8px)", transition: { duration: 0.12 } }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            onClick={() => {
              setFollow(true);
              scrollToActive("smooth");
            }}
            className="absolute bottom-3 left-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-on-primary shadow-[var(--shadow-float)]"
          >
            <Icon name="arrowRight" className="h-3.5 w-3.5 rotate-90" />
            {t("transcript.backToCurrent")}
          </motion.button>
        )}
      </AnimatePresence>
    </section>
  );
}
