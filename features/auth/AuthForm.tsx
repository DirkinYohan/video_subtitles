"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/classes";
import { Button, Field, TextInput } from "@/components/ui";
import { ResendVerification } from "@/features/auth/ResendVerification";
import { ApiError, postJson } from "@/services/client";

type Mode = "login" | "register" | "forgot" | "reset";

export function AuthForm({
  mode,
  token = "",
  notice = "",
  email: initialEmail = "",
}: {
  mode: Mode;
  token?: string;
  notice?: string;
  email?: string;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [error, setError] = useState("");
  const [info, setInfo] = useState(notice);
  const [checkInbox, setCheckInbox] = useState("");
  const [unverified, setUnverified] = useState("");
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
    setUnverified("");
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
        router.refresh();
      } else if (mode === "register") {
        await postJson("/api/auth/register", {
          name: data.get("name"),
          email: data.get("email"),
          password,
          confirm,
          locale,
        });
        setCheckInbox(String(data.get("email") || "").trim().toLowerCase());
      } else if (mode === "forgot") {
        await postJson("/api/auth/forgot-password", { email: data.get("email"), locale });
        setInfo(t("auth.sent"));
      } else {
        await postJson("/api/auth/reset-password", { token, password, confirm });
        router.push("/login");
      }
    } catch (err) {
      if (mode === "login" && err instanceof ApiError && err.status === 403) {
        setError(t("verify.notVerified"));
        setUnverified(String(data.get("email") || "").trim().toLowerCase());
        return;
      }
      setError(err instanceof Error ? err.message : t("auth.genericError"));
    } finally {
      setPending(false);
    }
  }

  if (checkInbox) {
    return (
      <div className="grid gap-5">
        <div role="status" className="grid gap-2 rounded-xl bg-accent-soft px-4 py-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-accent-ink">
            <Icon name="check" className="h-4 w-4" />
            {t("verify.checkInboxTitle")}
          </p>
          <p className="break-words leading-6 text-ink-2">{t("verify.checkInboxBody", { email: checkInbox })}</p>
        </div>
        <ResendVerification email={checkInbox} />
        <Link href="/login" className={`${buttonClass("secondary")} w-full`}>
          {t("verify.toLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {mode === "register" && (
        <Field label={t("auth.name")}>
          <TextInput name="name" autoComplete="name" required />
        </Field>
      )}
      {mode !== "reset" && (
        <Field label={t("auth.email")}>
          <TextInput name="email" type="email" autoComplete="email" required defaultValue={initialEmail} />
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
            <button
              type="button"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              onClick={() => setShow((value) => !value)}
            >
              {show ? t("auth.hide") : t("auth.show")}
            </button>
          </div>
        </Field>
      )}
      {(mode === "register" || mode === "reset") && strength && (
        <p className="text-xs font-medium text-muted" aria-live="polite">
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
          <label className="flex items-center gap-2 text-ink-2">
            <input name="remember" type="checkbox" className="h-3.5 w-3.5 rounded-sm accent-accent" />
            {t("auth.remember")}
          </label>
          <Link
            href="/forgot-password"
            className="font-medium text-accent hover:underline hover:underline-offset-4"
          >
            {t("auth.forgot")}
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {unverified && <ResendVerification key={unverified} email={unverified} />}
      {info && (
        <p role="status" className="rounded-md bg-ok-soft px-3 py-2 text-sm text-ok">
          {info}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? t("auth.loading") : mode === "login" ? t("auth.login") : mode === "register" ? t("auth.register") : mode === "forgot" ? t("auth.sendLink") : t("auth.reset")}
      </Button>
      {mode === "login" && (
        <p className="text-center text-sm text-muted">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="font-medium text-accent hover:underline hover:underline-offset-4">
            {t("auth.create")}
          </Link>
        </p>
      )}
      {mode === "register" && (
        <p className="text-center text-sm text-muted">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-medium text-accent hover:underline hover:underline-offset-4">
            {t("auth.loginLink")}
          </Link>
        </p>
      )}
      {mode === "forgot" && (
        <p className="text-center text-sm">
          <Link href="/login" className="text-accent hover:underline hover:underline-offset-4">
            {t("auth.backLogin")}
          </Link>
        </p>
      )}
    </form>
  );
}
