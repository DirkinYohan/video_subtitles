"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Button, Field, TextInput } from "@/components/ui";
import { postJson } from "@/services/client";

type Mode = "login" | "register" | "forgot" | "reset";

export function AuthForm({ mode, token = "" }: { mode: Mode; token?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const strength = password.length >= 10 && /[A-Z]/.test(password) && /\d/.test(password)
    ? "good"
    : password.length >= 8
      ? "fair"
      : password
        ? "weak"
        : "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    if (mode !== "forgot" && password.length < 8) {
      setError(t("auth.short"));
      return;
    }
    if ((mode === "register" || mode === "reset") && password !== confirm) {
      setError(t("auth.mismatch"));
      return;
    }
    setPending(true);
    const data = new FormData(event.currentTarget);
    try {
      if (mode === "login") {
        await postJson("/api/auth/login", {
          email: data.get("email"),
          password: data.get("password"),
          remember: data.get("remember") === "on",
        });
        router.push("/projects");
      } else if (mode === "register") {
        await postJson("/api/auth/register", {
          name: data.get("name"),
          email: data.get("email"),
          password,
          confirm,
        });
        router.push("/projects");
      } else if (mode === "forgot") {
        await postJson("/api/auth/forgot-password", { email: data.get("email") });
        setInfo(t("auth.sent"));
      } else {
        await postJson("/api/auth/reset-password", { token, password, confirm });
        router.push("/login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.genericError"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 rounded-3xl border border-line bg-white p-5 shadow-[0_20px_60px_rgb(39_52_92/0.08)] sm:p-7" noValidate>
      {mode === "register" && (
        <Field label={t("auth.name")}>
          <TextInput name="name" autoComplete="name" required />
        </Field>
      )}
      {mode !== "reset" && (
        <Field label={t("auth.email")}>
          <TextInput name="email" type="email" autoComplete="email" required />
        </Field>
      )}
      {mode !== "forgot" && (
        <Field label={t("auth.password")}>
          <div className="relative">
            <TextInput
              name="password"
              type={show ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-24"
            />
            <button type="button" className="absolute right-2 top-1/2 min-h-8 -translate-y-1/2 rounded-lg px-2 text-xs font-medium text-muted hover:bg-paper hover:text-ink" onClick={() => setShow((value) => !value)}>
              {show ? t("auth.hide") : t("auth.show")}
            </button>
          </div>
        </Field>
      )}
      {(mode === "register" || mode === "reset") && strength && (
        <p className="rounded-lg bg-paper px-3 py-2 text-xs font-medium text-muted" aria-live="polite">
          {strength === "good" ? t("auth.passwordGood") : strength === "fair" ? t("auth.passwordFair") : t("auth.passwordWeak")}
        </p>
      )}
      {(mode === "register" || mode === "reset") && (
        <Field label={t("auth.confirm")}>
          <TextInput
            name="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>
      )}
      {mode === "login" && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-muted">
            <input name="remember" type="checkbox" className="accent-accent" /> {t("auth.remember")}
          </label>
          <Link href="/forgot-password" className="font-medium text-accent hover:text-accent-strong">{t("auth.forgot")}</Link>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      {info && <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok">{info}</p>}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? t("auth.loading") : mode === "login" ? t("auth.login") : mode === "register" ? t("auth.register") : mode === "forgot" ? t("auth.sendLink") : t("auth.reset")}
      </Button>
      {mode === "login" && (
        <p className="text-center text-sm text-muted">
          <span className="mx-2 text-muted">{t("auth.or")}</span>
          <span className="mt-2 block">{t("auth.noAccount")} <Link href="/register" className="font-medium text-accent hover:text-accent-strong">{t("auth.create")}</Link></span>
        </p>
      )}
      {mode === "register" && (
        <p className="text-center text-sm text-muted">
          {t("auth.haveAccount")} <Link href="/login" className="font-medium text-accent hover:text-accent-strong">{t("auth.loginLink")}</Link>
        </p>
      )}
      {mode === "forgot" && (
        <p className="text-center text-sm">
          <Link href="/login" className="text-accent">← {t("auth.backLogin")}</Link>
        </p>
      )}
    </form>
  );
}
