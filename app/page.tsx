import Link from "next/link";
import { CaptionPreview } from "@/components/CaptionPreview";
import { PublicHeader } from "@/components/chrome";
import { buttonClass } from "@/components/classes";
import { Icon } from "@/components/icons";
import { BrandMark } from "@/components/Wordmark";
import { translate, type MessageKey } from "@/lib/i18n";
import { readLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

const CUE_ROWS = [
  { time: "00:03", text: "Bienvenido al podcast de cinco minutos.", active: false },
  { time: "00:07", text: "Hoy hablamos de cómo aprender sin prisa.", active: true },
  { time: "00:11", text: "Empecemos por lo que ya sabes.", active: false },
];

const TRACKS = ["ES", "EN", "FR", "PT", "IT"];

const TIMING = [
  { left: 0, width: 14 },
  { left: 16, width: 22 },
  { left: 40, width: 9 },
  { left: 51, width: 18 },
  { left: 71, width: 11 },
  { left: 84, width: 16 },
];

export default async function HomePage() {
  const locale = await readLocale();
  const t = (key: MessageKey) => translate(locale, key);

  const steps = [
    { icon: "upload" as const, title: t("home.step1Title"), body: t("home.step1Body") },
    { icon: "spark" as const, title: t("home.step2Title"), body: t("home.step2Body") },
    { icon: "play" as const, title: t("home.step3Title"), body: t("home.step3Body") },
  ];

  return (
    <div className="min-h-[100dvh] bg-paper">
      <PublicHeader locale={locale} />

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:pb-28 lg:pt-16">
          <div className="enter">
            <p className="text-sm font-medium text-accent-ink">{t("home.eyebrow")}</p>
            <h1 className="mt-4 max-w-[19ch] text-[2.375rem] font-semibold leading-[1.06] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[3.25rem]">
              {t("home.title")}
            </h1>
            <p className="mt-6 max-w-[46ch] text-base leading-7 text-ink-2 sm:text-[1.0625rem]">
              {t("home.body")}
            </p>
            <div className="mt-9 flex flex-col gap-2.5 sm:flex-row">
              <Link href="/register" className={`${buttonClass()} group min-h-11 px-5`}>
                {t("home.register")}
                <Icon
                  name="arrowRight"
                  className="h-4 w-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
                />
              </Link>
              <Link href="/login" className={`${buttonClass("secondary")} min-h-11 px-5`}>
                {t("home.login")}
              </Link>
            </div>
          </div>

          <div className="enter" style={{ ["--enter-delay" as string]: "100ms" }}>
            <CaptionPreview live={t("home.live")} />
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <Icon name="check" className="h-4 w-4 text-ok" />
              {t("home.ahead")}
            </p>
          </div>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
            <h2 className="max-w-[22ch] text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">
              {t("home.featuresTitle")}
            </h2>
            <p className="mt-4 max-w-[58ch] text-base leading-7 text-ink-2">{t("home.featuresBody")}</p>

            <div className="mt-12 grid gap-4 lg:grid-cols-5">
              <article className="overflow-hidden rounded-2xl border border-line bg-paper lg:col-span-3">
                <div className="p-6 sm:p-8">
                  <Icon name="captions" className="h-5 w-5 text-accent-ink" />
                  <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-ink">{t("home.f1Title")}</h3>
                  <p className="mt-2 max-w-[48ch] text-sm leading-6 text-muted">{t("home.f1Body")}</p>
                </div>
                <ul aria-hidden="true" className="mx-6 mb-6 grid gap-1 rounded-xl border border-line bg-surface p-2 sm:mx-8 sm:mb-8">
                  {CUE_ROWS.map((row) => (
                    <li
                      key={row.time}
                      className={`grid grid-cols-[3.25rem_1fr] items-baseline gap-3 rounded-lg px-3 py-2.5 text-sm ${
                        row.active ? "bg-accent-soft text-ink shadow-[inset_2px_0_0_var(--accent-base)]" : "text-ink-2"
                      }`}
                    >
                      <span className={`font-mono text-xs tabular-nums ${row.active ? "text-accent-ink" : "text-subtle"}`}>
                        {row.time}
                      </span>
                      <span className="truncate">{row.text}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="flex flex-col justify-between gap-10 rounded-2xl bg-accent-soft p-6 sm:p-8 lg:col-span-2">
                <div>
                  <Icon name="globe" className="h-5 w-5 text-accent-ink" />
                  <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-ink">{t("home.f2Title")}</h3>
                  <p className="mt-2 max-w-[40ch] text-sm leading-6 text-ink-2">{t("home.f2Body")}</p>
                </div>
                <ul aria-hidden="true" className="flex flex-wrap gap-2">
                  {TRACKS.map((code, index) => (
                    <li
                      key={code}
                      className={`rounded-full px-3 py-1.5 font-mono text-xs font-medium ${
                        index === 1
                          ? "bg-primary text-on-primary"
                          : "bg-surface text-ink-2 ring-1 ring-inset ring-accent-softer"
                      }`}
                    >
                      {code}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="grid gap-8 overflow-hidden rounded-2xl bg-stage p-6 text-white ring-1 ring-inset ring-white/[0.06] sm:p-8 lg:col-span-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-12">
                <div>
                  <Icon name="clock" className="h-5 w-5 text-white/70" />
                  <h3 className="mt-4 text-lg font-semibold tracking-[-0.02em]">{t("home.f3Title")}</h3>
                  <p className="mt-2 max-w-[44ch] text-sm leading-6 text-white/65">{t("home.f3Body")}</p>
                </div>
                <div aria-hidden="true" className="grid gap-2">
                  <div className="flex justify-between font-mono text-[0.6875rem] tabular-nums text-white/40">
                    <span>00:00</span>
                    <span>00:15</span>
                    <span>00:30</span>
                  </div>
                  <div className="relative h-12 overflow-hidden rounded-lg bg-white/[0.05] ring-1 ring-inset ring-white/[0.06]">
                    {TIMING.map((cue, index) => (
                      <span
                        key={cue.left}
                        className={`absolute inset-y-2 rounded-[5px] ${index === 3 ? "bg-white/85" : "bg-white/[0.16]"}`}
                        style={{ left: `calc(${cue.left}% + 2px)`, width: `calc(${cue.width}% - 4px)` }}
                      />
                    ))}
                    <span className="absolute inset-y-0 left-[58%] w-px bg-white" />
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <h2 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">
            {t("home.stepsTitle")}
          </h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step) => (
              <li key={step.title} className="border-t border-line-strong pt-6">
                <Icon name={step.icon} className="h-5 w-5 text-ink" />
                <h3 className="mt-5 text-base font-semibold tracking-[-0.015em] text-ink">{step.title}</h3>
                <p className="mt-2 max-w-[38ch] text-sm leading-6 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:pb-28">
          <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-line bg-surface px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:py-12">
            <div>
              <h2 className="max-w-[26ch] text-2xl font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[1.875rem]">
                {t("home.ctaTitle")}
              </h2>
              <p className="mt-3 text-base text-muted">{t("home.ctaBody")}</p>
            </div>
            <Link href="/register" className={`${buttonClass()} group min-h-11 px-5`}>
              {t("home.register")}
              <Icon
                name="arrowRight"
                className="h-4 w-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:px-6">
          <span className="flex items-center gap-2.5 font-semibold tracking-[-0.02em] text-ink">
            <BrandMark size="sm" />
            {t("app.name")}
          </span>
          <span>{t("home.footer")}</span>
        </div>
      </footer>
    </div>
  );
}
