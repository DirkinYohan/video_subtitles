import Link from "next/link";
import { PublicHeader } from "@/components/chrome";
import { buttonClass } from "@/components/classes";
import { translate } from "@/lib/i18n";
import { readLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await readLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <div className="min-h-screen overflow-hidden bg-paper">
      <PublicHeader locale={locale} />
      <main className="relative mx-auto grid min-h-[calc(100vh-76px)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:grid-cols-[1fr_.85fr] lg:gap-16">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-5 inline-flex rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-accent">{t("home.kicker")}</p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-[-0.035em] text-ink sm:text-5xl lg:text-6xl">{t("home.title")}</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">{t("home.body")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={buttonClass()}>{t("home.register")}</Link>
            <Link href="/login" className={buttonClass("secondary")}>{t("home.login")}</Link>
          </div>
        </div>
        <div className="relative mt-14 lg:mt-0">
          <div className="absolute -inset-12 rounded-full bg-violet-soft/70 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white bg-white p-3 shadow-[0_30px_80px_rgb(45_58_105/0.14)]">
            <div className="aspect-video rounded-2xl bg-[linear-gradient(135deg,#e9eeff,#f5f2ff)] p-5">
              <div className="flex h-full flex-col justify-between rounded-xl border border-white/80 bg-white/55 p-4 backdrop-blur">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger/50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warn/50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-ok/50" />
                </div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-[0_10px_25px_rgb(79_107_237/0.3)]">▶</div>
                <div className="grid gap-2">
                  <div className="h-2 rounded-full bg-white"><div className="h-full w-2/3 rounded-full bg-accent" /></div>
                  <div className="mx-auto h-6 w-2/3 rounded-lg bg-ink/80" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
