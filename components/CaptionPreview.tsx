import { Icon } from "@/components/icons";

/**
 * Vista previa del reproductor para la portada y las pantallas de acceso.
 * Reproduce el mismo tratamiento del subtítulo que usa el reproductor real
 * (franja oscura, texto blanco equilibrado) y alterna tres pistas de idioma.
 * Sin JavaScript: la secuencia es CSS y se detiene con reduced-motion.
 */
const SPECIMEN = [
  { code: "ES", text: "Bienvenido al podcast de cinco minutos." },
  { code: "EN", text: "Welcome to the five-minute podcast." },
  { code: "FR", text: "Bienvenue dans le podcast de cinq minutes." },
];

const CUES = [
  { left: 2, width: 17 },
  { left: 21, width: 24 },
  { left: 47, width: 13 },
  { left: 62, width: 21 },
  { left: 85, width: 12 },
];

export function CaptionPreview({ live, className = "" }: { live: string; className?: string }) {
  return (
    <figure
      aria-hidden="true"
      className={`overflow-hidden rounded-2xl bg-stage text-white shadow-[var(--shadow-dialog)] ring-1 ring-white/[0.08] ${className}`}
    >
      <div className="preview-scene relative aspect-video">
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[0.6875rem] font-medium text-white/90 backdrop-blur-md">
          <span className="preview-live h-1.5 w-1.5 rounded-full" />
          {live}
        </span>

        <span className="absolute right-4 top-4 flex gap-1 rounded-full bg-black/45 p-1 backdrop-blur-md">
          {SPECIMEN.map((line, index) => (
            <span
              key={line.code}
              className="cue-chip rounded-full px-2 py-0.5 font-mono text-[0.625rem] font-medium tracking-[0.04em]"
              style={{ ["--cue-delay" as string]: `${index * 3}s` }}
            >
              {line.code}
            </span>
          ))}
        </span>

        <div className="absolute inset-x-0 bottom-[9%] grid place-items-center px-6">
          {SPECIMEN.map((line, index) => (
            <p
              key={line.code}
              className="cue-line col-start-1 row-start-1 max-w-[85%] rounded-md bg-black/70 px-3.5 py-1.5 text-center text-[0.8125rem] leading-snug text-white [text-wrap:balance] sm:text-[0.9375rem]"
              style={{ ["--cue-delay" as string]: `${index * 3}s` }}
            >
              {line.text}
            </p>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-3">
        <Icon name="pause" className="h-4 w-4 shrink-0 text-white/80" />
        <div className="relative h-5 flex-1 overflow-hidden rounded-[5px] bg-white/[0.06]">
          {CUES.map((cue) => (
            <span
              key={cue.left}
              className="absolute inset-y-1 rounded-[3px] bg-white/[0.14]"
              style={{ left: `${cue.left}%`, width: `${cue.width}%` }}
            />
          ))}
          <span className="preview-sweep absolute inset-0" />
        </div>
        <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-white/55">00:12 / 00:32</span>
      </div>
    </figure>
  );
}
