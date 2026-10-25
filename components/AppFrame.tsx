"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { LanguageMenu } from "@/components/LanguageMenu";
import { glassClass } from "@/components/classes";
import { Icon } from "@/components/icons";
import type { User } from "@/types/domain";

export function AppFrame({ user, children }: { user: User | null; children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  const links = [
    { href: "/projects", label: t("nav.projects"), active: pathname.startsWith("/projects") },
    { href: "/account", label: t("nav.account"), active: pathname.startsWith("/account") },
  ];

  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      {/* Atajo de teclado: primera parada del tabulador. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-[var(--shadow-float)]"
      >
        {t("a11y.skipToContent")}
      </a>

      <header className={`sticky top-0 z-30 ${glassClass}`}>
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/projects"
            className="flex items-center gap-2.5 rounded-lg text-sm font-semibold tracking-tight text-ink"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-paper">
              <Icon name="captions" className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">{t("app.name")}</span>
          </Link>

          <nav
            className="ml-1 flex min-w-0 items-center gap-0.5 rounded-lg bg-nav p-0.5 sm:ml-2"
            aria-label={t("a11y.sidebar")}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                  link.active ? "bg-nav-active text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <LanguageMenu />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main
        id="contenido"
        className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8"
        aria-label={t("a11y.main")}
      >
        {children}
      </main>
    </div>
  );
}

function UserMenu({ user }: { user: User | null }) {
  const { t } = useI18n();
  const initial = (user?.name || "?").slice(0, 1).toUpperCase();
  return (
    <Link
      href="/account"
      className="flex h-9 items-center gap-2 rounded-lg px-1.5 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      aria-label={t("nav.account")}
    >
      <span className="grid h-7 w-7 place-items-center rounded-md border border-line bg-surface text-xs font-semibold text-ink">
        {initial}
      </span>
      <span className="hidden max-w-32 truncate sm:inline">{user?.name}</span>
    </Link>
  );
}
