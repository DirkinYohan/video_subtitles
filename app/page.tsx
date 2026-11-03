import Link from "next/link";
import { PublicHeader } from "@/components/chrome";
import { buttonClass } from "@/components/classes";
import { Icon } from "@/components/icons";
import { BrandMark } from "@/components/Wordmark";
import { translate, type MessageKey } from "@/lib/i18n";
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
  const t = (key: MessageKey) => translate(locale, key);

  const features = [
    { icon: "captions" as const, title: t("home.f1Title"), body: t("home.f1Body") },
    { icon: "globe" as const, title: t("home.f2Title"), body: t("home.f2Body") },
    { icon: "clock" as const, title: t("home.f3Title"), body: t("home.f3Body") },
  ];
  const steps = [
    { icon: "upload" as const, title: t("home.step1Title"), body: t("home.step1Body") },
    { icon: "spark" as const, title: t("home.step2Title"), body: t("home.step2Body") },
    { icon: "play" as const, title: t("home.step3Title"), body: t("home.step3Body") },
  ];

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-paper">
      {/* Fondo: halo de la marca y una rejilla tenue que se desvanece. */}
      <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[44rem]" />
      <div aria-hidden="true" className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[38rem]" />

      <div className="relative">
        <PublicHeader locale={locale} />

        {/* --- Portada --- */}
        <main className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28 lg:pt-20">
          <div className="enter">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-ink-2 shadow-[var(--shadow-card)] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {t("home.eyebrow")}
            </p>
            <h1 className="mt-6 max-w-[17ch] text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[3.25rem] lg:text-[3.75rem]">
              {t("home.title")}
            </h1>
            <p className="mt-6 max-w-[50ch] text-base leading-7 text-ink-2 sm:text-[1.0625rem] sm:leading-8">
              {t("home.body")}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={`${buttonClass()} min-h-11 px-5`}>
                {t("home.register")}
                <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
              <Link href="/login" className={`${buttonClass("secondary")} min-h-11 px-5`}>
                {t("home.login")}
              </Link>
            </div>
          </div>

          {/* Muestra real del formato: tres idiomas del mismo cue, por turnos. */}
          <div className="enter relative" style={{ ["--enter-delay" as string]: "120ms" }}>
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-from/25 to-brand-to/20 blur-3xl"
            />
            <figure className="float-soft relative overflow-hidden rounded-2xl bg-stage shadow-[var(--shadow-dialog)] ring-1 ring-white/10">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <p className="tabular text-xs text-white/45">00:12 → 00:15</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.6875rem] font-semibold text-white/85">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  {t("home.live")}
                </span>
              </div>

              <div className="grid gap-5 px-6 py-7 sm:px-7">
                {SPECIMEN.map((line, index) => (
                  <div
                    key={line.code}
                    className="caption-turn grid grid-cols-[2.25rem_1fr] items-baseline gap-3"
                    style={{ ["--turn-delay" as string]: `${index * 3}s` }}
                  >
                    <span className="tabular text-[0.6875rem] font-semibold tracking-[0.06em] text-white/70">
                      {line.code}
                    </span>
                    <p className="text-[0.9375rem] leading-snug text-white sm:text-base">{line.text}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 border-t border-white/10 px-6 py-3.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/12">
                  <div className="playhead h-full w-full rounded-full bg-gradient-to-r from-brand-from to-brand-to" />
                </div>
                <span className="tabular text-[0.6875rem] text-white/45">00:12 / 00:32</span>
              </div>
            </figure>

            <p className="float-soft absolute -bottom-5 left-6 inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs font-medium text-ink shadow-[var(--shadow-float)] [animation-delay:-3s]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-ok-soft text-ok">
                <Icon name="check" className="h-3 w-3" />
              </span>
              {t("home.ahead")}
            </p>
          </div>
        </main>

        {/* --- Funciones --- */}
        <section className="border-t border-line bg-surface/60">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-3xl">
                {t("home.featuresTitle")}
              </h2>
              <p className="mt-3 text-base leading-7 text-ink-2">{t("home.featuresBody")}</p>
            </div>
            <ul className="enter-stagger mt-12 grid gap-5 md:grid-cols-3">
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="lift rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">
                    <Icon name={feature.icon} className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold tracking-tight text-ink">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* --- Cómo funciona --- */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
          <h2 className="text-2xl font-semibold tracking-[-0.025em] text-ink sm:text-3xl">
            {t("home.stepsTitle")}
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-12 right-0 top-5 hidden h-px bg-gradient-to-r from-line-strong to-transparent md:block"
                  />
                )}
                <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink shadow-[var(--shadow-card)]">
                  <Icon name={step.icon} className="h-4.5 w-4.5" />
                </span>
                <p className="tabular mt-5 text-xs font-semibold text-accent-ink">0{index + 1}</p>
                <h3 className="mt-1.5 text-base font-semibold tracking-tight text-ink">{step.title}</h3>
                <p className="mt-2 max-w-[38ch] text-sm leading-6 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* --- Llamada final --- */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-stage px-6 py-14 text-center shadow-[var(--shadow-dialog)] sm:px-12">
            <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 opacity-90" />
            <div className="relative">
              <h2 className="mx-auto max-w-[24ch] text-2xl font-semibold tracking-[-0.025em] text-white sm:text-3xl">
                {t("home.ctaTitle")}
              </h2>
              <p className="mt-3 text-base text-white/65">{t("home.ctaBody")}</p>
              <Link href="/register" className={`${buttonClass()} mt-8 min-h-11 px-6`}>
                {t("home.register")}
                <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
            <span className="flex items-center gap-2.5 font-medium text-ink">
              <BrandMark size="sm" />
              {t("app.name")}
            </span>
            <span>{t("home.footer")}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
