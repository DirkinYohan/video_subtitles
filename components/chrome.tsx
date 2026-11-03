import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass } from "@/components/classes";
import { Icon } from "@/components/icons";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { translate, type Locale, type MessageKey } from "@/lib/i18n";

export function PublicHeader({ locale }: { locale: Locale }) {
  const t = (key: MessageKey) => translate(locale, key);
  return (
    <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[4.5rem] sm:px-6">
      <Wordmark label={t("app.name")} />
      <nav className="flex items-center gap-1 text-sm">
        <ThemeToggle />
        <LanguageMenu />
        <Link
          href="/login"
          className="hidden rounded-lg px-3 py-2 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink sm:inline-flex"
        >
          {t("home.login")}
        </Link>
        <Link href="/register" className={`${buttonClass("primary", "sm")} ml-1`}>
          {t("home.register")}
        </Link>
      </nav>
    </header>
  );
}

export function AuthScreen({
  locale,
  title,
  body,
  children,
  footer,
}: {
  locale: Locale;
  title: string;
  body?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = (key: MessageKey) => translate(locale, key);
  const points = [t("home.f1Title"), t("home.f2Title"), t("home.f3Title")];

  return (
    <main className="grid min-h-[100dvh] bg-paper lg:grid-cols-[0.9fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-stage p-10 lg:flex lg:flex-col xl:p-14">
        <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0" />
        <div className="relative flex flex-1 flex-col">
          <Wordmark label={t("app.name")} tone="invert" />
          <div className="grid flex-1 place-items-center">
            <div className="enter max-w-md">
              <p className="text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
                {t("home.title")}
              </p>
              <ul className="mt-8 grid gap-3.5">
                {points.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-sm text-white/75">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-white/45">{t("app.tagline")}</p>
        </div>
      </aside>

      <div className="relative grid place-items-center px-5 py-10 sm:px-8">
        <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0 opacity-60 lg:hidden" />
        <div className="enter relative w-full max-w-[24rem]">
          <div className="lg:hidden">
            <Wordmark label={t("app.name")} />
          </div>

          <h1 className="mt-10 text-[1.75rem] font-semibold tracking-[-0.025em] text-ink lg:mt-0">
            {title}
          </h1>
          {body && <p className="mt-2 text-sm leading-6 text-muted">{body}</p>}

          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}

          <div className="mt-10 flex items-center justify-center gap-1 border-t border-line pt-5">
            <ThemeToggle />
            <LanguageMenu />
          </div>
        </div>
      </div>
    </main>
  );
}
