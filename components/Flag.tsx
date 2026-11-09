import ES from "country-flag-icons/react/3x2/ES";
import FR from "country-flag-icons/react/3x2/FR";
import IT from "country-flag-icons/react/3x2/IT";
import PT from "country-flag-icons/react/3x2/PT";
import US from "country-flag-icons/react/3x2/US";
import { Icon } from "@/components/icons";

const FLAGS: Record<string, typeof ES> = {
  es: ES,
  en: US,
  fr: FR,
  pt: PT,
  it: IT,
};

/** Bandera SVG redondeada para un código de idioma. "und" (automático) usa un globo. */
export function Flag({ code, className = "h-3 w-[1.125rem]" }: { code: string; className?: string }) {
  const Svg = FLAGS[code];
  if (!Svg) {
    return (
      <span aria-hidden="true" className={`inline-grid shrink-0 place-items-center text-subtle ${className}`}>
        <Icon name="globe" className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)] ${className}`}
    >
      <Svg className="block h-full w-full" />
    </span>
  );
}

/** Bandera + código ISO (EN, ES). */
export function LangCode({ code, className = "" }: { code: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Flag code={code} />
      <span className="font-mono text-[0.6875rem] font-medium tracking-[0.02em]">
        {code === "und" ? "AUTO" : code.toUpperCase()}
      </span>
    </span>
  );
}
