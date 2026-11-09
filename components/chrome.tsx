import Link from "next/link";
import type { ReactNode } from "react";
import { CaptionPreview } from "@/components/CaptionPreview";
import { buttonClass } from "@/components/classes";
import { Icon } from "@/components/icons";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { translate, type Locale, type MessageKey } from "@/lib/i18n";

export function PublicHeader({ locale }: { locale: Locale }) {
  const t = (key: MessageKey) => translate(locale, key);
  return (
    <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
      <Wordmark label={t("app.name")} />
      <nav className="flex items-center gap-1 text-sm">
        <ThemeToggle />
        <LanguageMenu />
        <Link
          href="/login"
          className="hidden min-h-9 items-center rounded-lg px-3 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink sm:inline-flex"
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
    <main className="grid min-h-[100dvh] bg-paper lg:grid-cols-[1fr_1fr]">
      <div className="relative flex flex-col px-5 py-8 sm:px-10 lg:py-10">
        <Wordmark label={t("app.name")} />

        <div className="grid flex-1 place-items-center py-12">
          <div className="enter w-full max-w-[24rem]">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-ink">{title}</h1>
            {body && <p className="mt-2.5 text-[0.9375rem] leading-6 text-muted">{body}</p>}

            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-sm text-muted">{footer}</div>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LanguageMenu />
          <span className="ml-auto text-xs text-subtle">{t("app.tagline")}</span>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line bg-surface-2 p-10 lg:flex lg:flex-col lg:justify-center xl:p-16">
        <div className="enter mx-auto w-full max-w-xl" style={{ ["--enter-delay" as string]: "80ms" }}>
          <p className="max-w-[20ch] text-[1.875rem] font-semibold leading-[1.15] tracking-[-0.035em] text-ink">
            {t("home.title")}
          </p>
          <CaptionPreview live={t("home.live")} className="mt-10" />
          <ul className="mt-8 grid gap-3">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-sm text-ink-2">
                <Icon name="check" className="h-4 w-4 text-accent-ink" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
