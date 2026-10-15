"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { LanguageMenu } from "@/components/LanguageMenu";
import type { User } from "@/types/domain";

export function AppFrame({ user, children }: { user: User | null; children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const projects = pathname.startsWith("/projects");
  const account = pathname.startsWith("/account");

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/projects" className="flex items-center gap-2.5 rounded-xl pr-2 text-sm font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-xs font-bold text-white shadow-[0_6px_16px_rgb(79_107_237/0.2)]">IA</span>
            <span>{t("app.name")}</span>
          </Link>
          <nav className="order-3 flex w-full items-center rounded-xl bg-paper p-1 text-sm sm:order-none sm:w-auto" aria-label={t("a11y.sidebar")}>
            <Link href="/projects" aria-current={projects ? "page" : undefined} className={`flex-1 rounded-lg px-4 py-2 text-center font-medium sm:flex-none ${projects ? "bg-white text-accent shadow-[0_1px_3px_rgb(24_32_52/0.08)]" : "text-muted hover:text-ink"}`}>{t("nav.projects")}</Link>
            <Link href="/account" aria-current={account ? "page" : undefined} className={`flex-1 rounded-lg px-4 py-2 text-center font-medium sm:flex-none ${account ? "bg-white text-accent shadow-[0_1px_3px_rgb(24_32_52/0.08)]" : "text-muted hover:text-ink"}`}>{t("nav.account")}</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <LanguageMenu />
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:py-10" aria-label={t("a11y.main")}>{children}</main>
    </div>
  );
}

function UserMenu({ user }: { user: User | null }) {
  const { t } = useI18n();
  const initial = (user?.name || "?").slice(0, 1).toUpperCase();
  return (
    <Link href="/account" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-1.5 py-1 text-sm hover:bg-paper sm:px-2" aria-label={t("nav.account")}>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-soft text-xs font-bold text-violet ring-1 ring-violet/10">{initial}</span>
      <span className="hidden max-w-32 truncate sm:inline">{user?.name}</span>
    </Link>
  );
}
