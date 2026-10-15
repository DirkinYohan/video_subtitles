import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageMenu } from "@/components/LanguageMenu";
import { translate, type Locale, type MessageKey } from "@/lib/i18n";

export function PublicHeader({ locale }: { locale: Locale }) {
  const t = (key: MessageKey) => translate(locale, key);
  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
      <Link href="/" className="flex items-center gap-2.5 text-sm font-bold">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-xs text-white shadow-[0_6px_16px_rgb(79_107_237/0.2)]">IA</span>
        {t("app.name")}
      </Link>
      <nav className="flex items-center gap-1 text-sm text-muted">
        <Link href="/login" className="rounded-xl px-3 py-2 font-medium hover:bg-white hover:text-ink">{t("home.login")}</Link>
        <LanguageMenu />
      </nav>
    </header>
  );
}

export function AuthScreen({ locale, title, body, children, footer }: { locale: Locale; title: string; body?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-paper px-4 py-10">
      <div className="pointer-events-none absolute -left-28 -top-28 h-80 w-80 rounded-full bg-accent-soft/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-soft/70 blur-3xl" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2.5 text-sm font-bold tracking-tight text-ink">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-xs text-white shadow-[0_8px_20px_rgb(79_107_237/0.2)]">IA</span>
          {translate(locale, "app.name")}
        </Link>
        <h1 className="mt-7 text-center text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {body && <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-muted">{body}</p>}
        <div className="mt-7">{children}</div>
        {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
        <div className="mt-5 flex justify-center">
          <LanguageMenu />
        </div>
      </div>
    </main>
  );
}
