"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CommandPalette } from "@/components/CommandPalette";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Kbd, MenuItem, Popover, SPRING, menuKeys, useDismiss } from "@/components/kit";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Wordmark } from "@/components/Wordmark";
import { postJson } from "@/services/client";
import type { User } from "@/types/domain";

export function AppFrame({ user, children }: { user: User | null; children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [palette, setPalette] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const links = [
    { href: "/projects", label: t("nav.projects"), active: pathname.startsWith("/projects") },
    { href: "/account", label: t("nav.account"), active: pathname.startsWith("/account") },
  ];

  // La cabecera se asienta (borde + material) en cuanto el contenido pasa por debajo.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closePalette = useCallback(() => setPalette(false), []);

  return (
    <div className="min-h-[100dvh] bg-paper text-ink">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-[var(--shadow-float)]"
      >
        {t("a11y.skipToContent")}
      </a>
      <div ref={sentinel} aria-hidden="true" className="absolute top-0 h-px w-px" />

      <header
        className={`sticky top-0 z-40 border-b transition-[border-color,background-color] duration-200 ${
          scrolled ? "material border-line" : "border-transparent bg-paper"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-2 px-4 sm:px-6">
          <Wordmark label={t("app.name")} href="/projects" hideLabelOnMobile />

          <nav className="ml-3 flex items-center sm:ml-6" aria-label={t("a11y.sidebar")}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active ? "page" : undefined}
                className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  link.active ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {link.active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={reduce ? { duration: 0 } : SPRING}
                    className="absolute inset-0 rounded-lg bg-surface-2 ring-1 ring-inset ring-line"
                  />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPalette(true)}
              aria-label={t("palette.title")}
              aria-keyshortcuts="Control+K Meta+K"
              className="hidden h-9 items-center gap-2 rounded-lg border border-line bg-surface pl-2.5 pr-1.5 text-sm text-subtle hover:border-line-strong hover:text-ink-2 md:inline-flex"
            >
              <Icon name="search" className="h-4 w-4" />
              <span className="pr-6">{t("palette.short")}</span>
              <Kbd>⌘K</Kbd>
            </button>
            <button
              type="button"
              onClick={() => setPalette(true)}
              aria-label={t("palette.title")}
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink md:hidden"
            >
              <Icon name="search" className="h-[18px] w-[18px]" />
            </button>
            <ThemeToggle />
            <LanguageMenu />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main
        key={pathname}
        id="contenido"
        className="enter mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10"
        aria-label={t("a11y.main")}
      >
        {children}
      </main>

      <CommandPalette open={palette} onClose={closePalette} />
    </div>
  );
}

function UserMenu({ user }: { user: User | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrap], trigger);

  useEffect(() => {
    if (open) wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const initial = (user?.name || "?").slice(0, 1).toUpperCase();

  async function logout() {
    setPending(true);
    try {
      await postJson("/api/auth/logout", {});
    } catch {
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="relative ml-1" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("user.menu")}
        onClick={() => setOpen((value) => !value)}
        className="grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-paper hover:ring-2 hover:ring-line-strong aria-expanded:ring-2 aria-expanded:ring-accent"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink ring-1 ring-inset ring-accent-softer">
          {initial}
        </span>
      </button>

      <Popover open={open} role="menu" label={t("user.menu")} className="w-64">
        <div onKeyDown={menuKeys}>
          <div className="flex items-center gap-3 px-2.5 pb-3 pt-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuItem icon="user" href="/account" onSelect={close}>
            {t("nav.account")}
          </MenuItem>
          <MenuItem icon="settings" href="/account#preferencias" onSelect={close}>
            {t("account.preferences")}
          </MenuItem>
          <MenuItem
            icon="command"
            onSelect={() => {
              close();
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
            }}
            hint={<Kbd>⌘K</Kbd>}
          >
            {t("palette.title")}
          </MenuItem>
          <div className="my-1 h-px bg-line" />
          <MenuItem icon="logout" tone="danger" onSelect={() => void (pending ? undefined : logout())}>
            {t("user.logout")}
          </MenuItem>
        </div>
      </Popover>
    </div>
  );
}
