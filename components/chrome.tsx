import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageMenu } from "@/components/LanguageMenu";
import { Wordmark } from "@/components/Wordmark";
import { translate, type Locale, type MessageKey } from "@/lib/i18n";

export function PublicHeader({ locale }: { locale: Locale }) {
  const t = (key: MessageKey) => translate(locale, key);
  return (
    <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
      <Wordmark label={t("app.name")} />
      <nav className="flex items-center gap-1 text-sm">
        <Link
          href="/login"
          className="rounded-lg px-3 py-2 font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {t("home.login")}
        </Link>
        <LanguageMenu />
      </nav>
    </header>
  );
}

/**
 * Marco de las pantallas de autenticación.
 *
 * Dos paneles: a la izquierda el producto (tinta sólida, sin efectos), a la
 * derecha la tarea. En móvil queda sólo la tarea, con la marca arriba.
 */
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

  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[0.85fr_1fr]">
      <aside className="hidden flex-col bg-ink p-10 lg:flex xl:p-14">
        <Wordmark label={t("app.name")} tone="invert" />
        <div className="grid flex-1 place-items-center">
          <div className="max-w-sm">
            <p className="text-[1.75rem] font-semibold leading-[1.2] tracking-[-0.02em] text-paper">
              {t("home.title")}
            </p>
            <p className="mt-4 text-sm leading-6 text-paper/60">{t("app.tagline")}</p>
          </div>
        </div>
      </aside>

      <div className="grid place-items-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Wordmark label={t("app.name")} />
          </div>

          <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em] text-ink lg:mt-0">
            {title}
          </h1>
          {body && <p className="mt-2 text-sm leading-6 text-muted">{body}</p>}

          <div className="mt-7">{children}</div>
          {footer && <div className="mt-5 text-sm text-muted">{footer}</div>}

          <div className="mt-8 border-t border-line pt-4">
            <LanguageMenu />
          </div>
        </div>
      </div>
    </main>
  );
}
