"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { LanguageMenu } from "@/components/LanguageMenu";
import { Button, Field, TextInput, Toast } from "@/components/ui";
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
      const data = await postJson<{ email: string }>("/api/auth/change-email", { email, password: emailPassword });
      setEmail(data.email);
      setEmailPassword("");
      setNotice(t("account.emailSaved"));
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
      // Aunque falle la llamada, la sesión local se descarta igualmente.
      setError(t("error.offline"));
    } finally {
      setPending(null);
      router.replace("/login");
      router.refresh();
    }
  }

  const strength = password.length >= 12 ? t("auth.passwordGood") : password.length >= 8 ? t("auth.passwordFair") : password ? t("auth.passwordWeak") : "";

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
        {t("account.title")}
      </h1>

      {notice && <Toast>{notice}</Toast>}
      {error && <Toast tone="danger">{error}</Toast>}

      {/* --- Perfil --- */}
      <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-ink">{t("account.personal")}</h2>

        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-semibold text-ink"
          >
            {initial}
          </span>
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold text-ink">{user.name}</p>
            <p className="truncate text-muted">{user.email}</p>
          </div>
        </div>

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
            className="w-full sm:w-auto"
            disabled={pending !== null || name.trim() === user.name}
            onClick={() => void saveName()}
          >
            {pending === "name" ? t("auth.loading") : t("account.saveName")}
          </Button>
        </div>

        <dl className="grid divide-y divide-line border-t border-line text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="min-w-0 py-2.5 sm:py-0 sm:pr-4">
            <dt className="text-xs text-muted">{t("account.email")}</dt>
            <dd className="mt-0.5 truncate font-medium text-ink">{user.email}</dd>
          </div>
          <div className="min-w-0 py-2.5 sm:py-0 sm:pl-4">
            <dt className="text-xs text-muted">{t("account.since")}</dt>
            <dd className="mt-0.5 font-medium text-ink">{since || "—"}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* --- Correo --- */}
        <section className="grid content-start gap-3.5 rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">{t("account.changeEmail")}</h2>
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
          <div className="mt-1">
            <Button type="button" disabled={pending !== null} onClick={() => void changeEmail()}>
              {pending === "email" ? t("auth.loading") : t("account.changeEmail")}
            </Button>
          </div>
        </section>

        {/* --- Seguridad --- */}
        <section className="grid content-start gap-3.5 rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-ink">{t("account.security")}</h2>
          <Field label={t("account.currentPassword")}>
            <TextInput
              type="password"
              value={current}
              autoComplete="current-password"
              onChange={(event) => setCurrent(event.target.value)}
            />
          </Field>
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
          <div className="mt-1">
            <Button
              type="button"
              disabled={pending !== null}
              onClick={() => void changePassword()}
            >
              {pending === "password" ? t("auth.loading") : t("account.changePassword")}
            </Button>
          </div>
        </section>
      </div>

      {/* --- Preferencias --- */}
      <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5 lg:grid-cols-2">
        <h2 className="text-sm font-semibold text-ink lg:col-span-2">
          {t("account.preferences")}
        </h2>

        <div className="grid gap-2">
          <p className="text-sm text-ink-2">{t("settings.language")}</p>
          <LanguageMenu align="left" />
        </div>

        <label className="grid gap-2.5 text-sm">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-ink-2">{t("account.captionSize")}</span>
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
          <span
            className={`${CAPTION_CLASS[size]} rounded-md bg-stage py-2 text-center text-white`}
          >
            Aa
          </span>
        </label>
      </section>

      <div className="pb-2">
        <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => void logout()}>
          {t("user.logout")}
        </Button>
      </div>
    </div>
  );
}

