"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { LanguageMenu } from "@/components/LanguageMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Field, PageHeader, TextInput, Toast } from "@/components/ui";
import { CAPTION_CLASS, useCaptionSize, writeCaptionSize, type CaptionSize } from "@/lib/captions";
import { errorMessageKey, patchJson, postJson } from "@/services/client";
import type { User } from "@/types/domain";

const SIZE_KEYS = ["studio.sizeSm", "studio.sizeMd", "studio.sizeLg", "studio.sizeXl"] as const;

export function AccountPanel({ user }: { user: User }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [emailPassword, setEmailPassword] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const size = useCaptionSize();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"name" | "email" | "password" | "logout" | null>(null);
  const since = user.created_at ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(user.created_at)) : "";
  const initial = user.name.slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError(t("account.nameInvalid"));
      return;
    }
    setError("");
    setNotice("");
    setPending("name");
    try {
      const data = await patchJson<User>("/api/users/me", { name: trimmed });
      setName(data.name);
      setNotice(t("account.nameSaved"));
      router.refresh();
    } catch (caught) {
      setError(t(errorMessageKey(caught)));
    } finally {
      setPending(null);
    }
  }

  async function changeEmail() {
    setError("");
    setNotice("");
    setPending("email");
    try {
      const data = await postJson<{ email: string; pending_email: string }>("/api/auth/change-email", {
        email,
        password: emailPassword,
        locale,
      });
      setEmail(data.email);
      setEmailPassword("");
      setNotice(data.pending_email ? t("account.emailPending", { email: data.pending_email }) : "");
      router.refresh();
    } catch (caught) {
      setError(t(errorMessageKey(caught)));
    } finally {
      setPending(null);
    }
  }

  async function changePassword() {
    setError("");
    setNotice("");
    if (password.length < 8) {
      setError(t("auth.short"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.mismatch"));
      return;
    }
    setPending("password");
    try {
      await postJson("/api/auth/change-password", { current, password, confirm });
      setCurrent("");
      setPassword("");
      setConfirm("");
      setNotice(t("account.passwordSaved"));
    } catch (caught) {
      setError(t(errorMessageKey(caught)));
    } finally {
      setPending(null);
    }
  }

  async function logout() {
    setPending("logout");
    setError("");
    try {
      await postJson("/api/auth/logout", {});
    } catch {
      setError(t("error.offline"));
    } finally {
      setPending(null);
      router.replace("/login");
      router.refresh();
    }
  }

  const strength = password.length >= 12 ? t("auth.passwordGood") : password.length >= 8 ? t("auth.passwordFair") : password ? t("auth.passwordWeak") : "";

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8">
      <PageHeader title={t("account.title")} description={t("account.subtitle")} />

      {notice && <Toast>{notice}</Toast>}
      {error && <Toast tone="danger">{error}</Toast>}

      <section className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <span
            aria-hidden
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent-soft text-xl font-semibold text-accent-ink ring-1 ring-inset ring-accent-softer"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold tracking-[-0.02em] text-ink">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          <dl className="text-right text-sm">
            <dt className="text-xs text-muted">{t("account.since")}</dt>
            <dd className="font-medium text-ink">{since || "-"}</dd>
          </dl>
        </div>
      </section>

      <div className="grid gap-8">
        <SettingsRow title={t("account.personal")} description={t("account.personalHint")}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field label={t("account.name")}>
              <TextInput
                value={name}
                maxLength={80}
                autoComplete="name"
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
              />
            </Field>
            <Button
              type="button"
              className="min-h-11 w-full sm:w-auto"
              disabled={pending !== null || name.trim() === user.name}
              onClick={() => void saveName()}
            >
              {pending === "name" ? t("auth.loading") : t("account.saveName")}
            </Button>
          </div>
        </SettingsRow>

        <SettingsRow title={t("account.changeEmail")} description={t("account.emailHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("account.newEmail")}>
              <TextInput
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label={t("account.currentPassword")}>
              <TextInput
                type="password"
                value={emailPassword}
                autoComplete="current-password"
                onChange={(event) => setEmailPassword(event.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="button" disabled={pending !== null} onClick={() => void changeEmail()}>
              {pending === "email" ? t("auth.loading") : t("account.changeEmail")}
            </Button>
          </div>
        </SettingsRow>

        <SettingsRow title={t("account.security")} description={t("account.securityHint")}>
          <Field label={t("account.currentPassword")}>
            <TextInput
              type="password"
              value={current}
              autoComplete="current-password"
              onChange={(event) => setCurrent(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("account.newPassword")}
              hint={strength ? `${strength} · ${t("auth.short")}` : t("auth.short")}
            >
              <TextInput
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field label={t("account.confirmPassword")}>
              <TextInput
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(event) => setConfirm(event.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="button" disabled={pending !== null} onClick={() => void changePassword()}>
              {pending === "password" ? t("auth.loading") : t("account.changePassword")}
            </Button>
          </div>
        </SettingsRow>

        <SettingsRow title={t("account.preferences")} description={t("account.preferencesHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <span className="text-sm font-medium text-ink">{t("settings.language")}</span>
              <LanguageMenu />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
              <span className="text-sm font-medium text-ink">{t("account.theme")}</span>
              <ThemeToggle />
            </div>
          </div>
          <label className="grid gap-3 rounded-xl border border-line px-4 py-4 text-sm">
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-ink">{t("account.captionSize")}</span>
              <span className="text-xs text-subtle">{t(SIZE_KEYS[size])}</span>
            </span>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={size}
              aria-label={t("account.captionSize")}
              onChange={(event) => writeCaptionSize(Number(event.target.value) as CaptionSize)}
            />
            <span className="relative grid h-24 place-items-center overflow-hidden rounded-lg bg-stage">
              <span aria-hidden="true" className="preview-scene absolute inset-0 opacity-80" />
              <span
                className={`${CAPTION_CLASS[size]} relative rounded-md bg-scrim-strong px-3 py-1.5 leading-snug text-white transition-[font-size] duration-200`}
              >
                Aa
              </span>
            </span>
          </label>
        </SettingsRow>

        <div className="flex justify-end border-t border-line pt-6">
          <Button type="button" variant="danger" disabled={pending !== null} onClick={() => void logout()}>
            {t("user.logout")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      </div>
      <div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}
