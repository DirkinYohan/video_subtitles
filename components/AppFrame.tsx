"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { glassClass } from "@/components/classes";
import { Wordmark } from "@/components/Wordmark";
import { VerifyBanner } from "@/features/auth/VerifyBanner";
import { postJson } from "@/services/client";
import type { User } from "@/types/domain";

export function AppFrame({ user, children }: { user: User | null; children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  const links = [
    { href: "/projects", label: t("nav.projects"), active: pathname.startsWith("/projects") },
    // En móvil «Cuenta» la cubre el avatar: la barra no cabe con todo.
    { href: "/account", label: t("nav.account"), active: pathname.startsWith("/account"), desktopOnly: true },
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
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Wordmark label={t("app.name")} href="/projects" hideLabelOnMobile />

          <nav
            className="ml-2 flex min-w-0 items-center gap-0.5 rounded-xl bg-nav p-1 sm:ml-4"
            aria-label={t("a11y.sidebar")}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium sm:px-3.5 ${link.desktopOnly ? "hidden sm:block" : ""} ${
                  link.active
                    ? "bg-nav-active text-ink shadow-[var(--shadow-card)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <ThemeToggle />
            <LanguageMenu />
            <UserMenu user={user} />
            <LogoutButton />
          </div>
        </div>
      </header>

      {user && user.email_verified === false && <VerifyBanner email={user.email} />}

      {/* La clave por ruta vuelve a disparar la entrada al navegar. */}
      <main
        key={pathname}
        id="contenido"
        className="enter mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10"
        aria-label={t("a11y.main")}
      >
        {children}
      </main>
    </div>
  );
}

/** Siempre a la vista: con texto desde `sm`, sólo el icono en móvil. */
function LogoutButton() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await postJson("/api/auth/logout", {});
    } catch {
      // Aunque falle la llamada, se sale igualmente: la cookie caduca sola.
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={pending}
      title={t("user.logout")}
      aria-label={t("user.logout")}
      className="ml-1 flex h-10 items-center gap-2 rounded-xl border border-line px-2.5 text-sm font-medium text-ink-2 transition-colors hover:border-danger-softer hover:bg-danger-soft hover:text-danger disabled:opacity-60 sm:px-3"
    >
      <Icon name="logout" className="h-[18px] w-[18px]" />
      <span className="hidden sm:inline">{t("user.logout")}</span>
    </button>
  );
}

function UserMenu({ user }: { user: User | null }) {
  const { t } = useI18n();
  const initial = (user?.name || "?").slice(0, 1).toUpperCase();
  return (
    <Link
      href="/account"
      className="flex h-10 items-center gap-2.5 rounded-xl py-1 pl-1 pr-1 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink sm:pr-3"
      aria-label={t("nav.account")}
    >
      <span className="brand-mark grid h-8 w-8 place-items-center rounded-full text-xs font-semibold">
        {initial}
      </span>
      <span className="hidden max-w-32 truncate sm:inline">{user?.name}</span>
    </Link>
  );
}
