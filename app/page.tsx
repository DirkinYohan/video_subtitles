import Link from "next/link";
import { PublicHeader } from "@/components/chrome";
import { buttonClass } from "@/components/classes";
import { translate } from "@/lib/i18n";
import { readLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

/** Muestra de subtítulos: el producto hablando de sí mismo, sin fingir una app. */
const SPECIMEN = [
  { code: "ES", text: "Bienvenido al podcast de cinco minutos." },
  { code: "EN", text: "Welcome to the five-minute podcast." },
  { code: "FR", text: "Bienvenue dans le podcast de cinq minutes." },
];

export default async function HomePage() {
  const locale = await readLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <div className="min-h-[100dvh] bg-paper">
      <PublicHeader locale={locale} />

      <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:py-16">
        <div>
          <h1 className="max-w-[17ch] text-[2.35rem] font-semibold leading-[1.06] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.35rem]">
            {t("home.title")}
          </h1>
          <p className="mt-6 max-w-[46ch] text-base leading-7 text-ink-2 sm:text-[1.0625rem]">
            {t("home.body")}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={buttonClass()}>
              {t("home.register")}
            </Link>
            <Link href="/login" className={buttonClass("secondary")}>
              {t("home.login")}
            </Link>
          </div>
        </div>

        {/* Muestra real del formato de subtítulos: tres idiomas del mismo cue. */}
        <figure className="overflow-hidden rounded-2xl bg-stage shadow-[var(--shadow-float)] ring-1 ring-white/10">
          <div className="border-b border-white/10 px-6 py-4">
            <p className="tabular text-xs text-white/45">00:12 → 00:15</p>
          </div>

          <div className="grid gap-5 px-6 py-6 sm:px-7 sm:py-7">
            {SPECIMEN.map((line, index) => (
              <div key={line.code} className="grid grid-cols-[2.25rem_1fr] items-baseline gap-3">
                <span
                  className={`tabular text-[0.6875rem] font-semibold tracking-[0.06em] ${
                    index === 0 ? "text-white/80" : "text-white/35"
                  }`}
                >
                  {line.code}
                </span>
                <p
                  className={`text-[0.9375rem] leading-snug ${
                    index === 0 ? "text-white" : "text-white/50"
                  }`}
                >
                  {line.text}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-white/10 px-6 py-3.5">
            <div className="h-0.5 flex-1 rounded-full bg-white/15">
              <div className="h-full w-[38%] rounded-full bg-white/70" />
            </div>
            <span className="tabular text-[0.6875rem] text-white/40">00:12 / 00:32</span>
          </div>
        </figure>
      </main>
    </div>
  );
}
