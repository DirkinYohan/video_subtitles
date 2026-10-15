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
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
      <div className="mb-1 lg:col-span-2">
        <p className="text-sm font-semibold text-accent">{t("app.tagline")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{t("account.title")}</h1>
      </div>
      {notice && <div className="lg:col-span-2"><Toast>{notice}</Toast></div>}
      {error && <div className="lg:col-span-2"><Toast tone="danger">{error}</Toast></div>}
      <section className="grid gap-5 rounded-3xl border border-line bg-white p-5 sm:p-6 lg:col-span-2">
        <h2 className="text-sm font-bold">{t("account.personal")}</h2>
        <div className="flex min-w-0 items-center gap-4">
          <span aria-hidden className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-violet-soft text-xl font-bold text-violet ring-1 ring-violet/10">{initial}</span>
          <div className="min-w-0 text-sm">
            <p className="truncate text-base font-bold">{user.name}</p>
            <p className="truncate text-muted">{user.email}</p>
            {since && <p className="text-xs text-muted">{t("account.since")}: {since}</p>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label={t("account.name")}>
            <TextInput
              value={name}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => { setName(event.target.value); setError(""); }}
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
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl bg-paper p-3.5"><dt className="text-xs font-medium text-muted">{t("account.email")}</dt><dd className="mt-1 truncate font-semibold">{user.email}</dd></div>
          <div className="rounded-2xl bg-paper p-3.5"><dt className="text-xs font-medium text-muted">{t("account.since")}</dt><dd className="mt-1 font-semibold">{since || "—"}</dd></div>
        </dl>
      </section>
      <section className="grid content-start gap-5 rounded-3xl border border-line bg-white p-5 sm:p-6">
        <div>
          <span aria-hidden className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-accent-soft font-bold text-accent">@</span>
          <h2 className="font-bold">{t("account.changeEmail")}</h2>
        </div>
        <Field label={t("account.newEmail")}>
          <TextInput type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label={t("account.currentPassword")}>
          <TextInput type="password" value={emailPassword} autoComplete="current-password" onChange={(event) => setEmailPassword(event.target.value)} />
        </Field>
        <div className="mt-auto"><Button type="button" className="w-full sm:w-auto" disabled={pending !== null} onClick={() => void changeEmail()}>{pending === "email" ? t("auth.loading") : t("account.changeEmail")}</Button></div>
      </section>
      <section className="grid content-start gap-5 rounded-3xl border border-line bg-white p-5 sm:p-6">
        <div>
          <span aria-hidden className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-ok-soft font-bold text-ok">••</span>
          <h2 className="font-bold">{t("account.security")}</h2>
        </div>
        <Field label={t("account.currentPassword")}>
          <TextInput type="password" value={current} autoComplete="current-password" onChange={(event) => setCurrent(event.target.value)} />
        </Field>
        <Field label={t("account.newPassword")}>
          <TextInput type="password" value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
        </Field>
        {strength && <p className="rounded-lg bg-paper px-3 py-2 text-xs font-medium text-muted">{strength}</p>}
        <p className="text-xs leading-5 text-muted">{t("auth.short")}</p>
        <Field label={t("account.confirmPassword")}>
          <TextInput type="password" value={confirm} autoComplete="new-password" onChange={(event) => setConfirm(event.target.value)} />
        </Field>
        <div className="mt-auto"><Button type="button" className="w-full sm:w-auto" disabled={pending !== null} onClick={() => void changePassword()}>{pending === "password" ? t("auth.loading") : t("account.changePassword")}</Button></div>
      </section>
      <section className="grid gap-5 rounded-3xl border border-line bg-white p-5 sm:p-6 lg:col-span-2 lg:grid-cols-2">
        <h2 className="font-bold lg:col-span-2">{t("account.preferences")}</h2>
        <div className="rounded-2xl bg-paper p-4">
          <p className="mb-3 text-sm font-semibold">{t("settings.language")}</p>
          <LanguageMenu align="left" />
        </div>
        <label className="grid gap-3 rounded-2xl bg-paper p-4 text-sm">
          <span className="font-semibold">{t("account.captionSize")}</span>
          <span className="text-xs text-muted">{t(SIZE_KEYS[size])}</span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={size}
            aria-label={t("account.captionSize")}
            onChange={(event) => writeCaptionSize(Number(event.target.value) as CaptionSize)}
          />
          <span className={`${CAPTION_CLASS[size]} text-center font-bold text-ink`}>Aa</span>
        </label>
      </section>
      <div className="pt-2 lg:col-span-2">
        <Button type="button" variant="secondary" disabled={pending !== null} onClick={() => void logout()}>
          {t("user.logout")}
        </Button>
      </div>
    </div>
  );
}

