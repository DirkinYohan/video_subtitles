"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/classes";
import { postJson } from "@/services/client";

/**
 * Confirma el correo con el token del enlace y lleva al inicio de sesión.
 *
 * Se confirma con un POST desde la página y no al abrir el enlace: los
 * antivirus de correo visitan los enlaces por su cuenta y, si bastara con
 * abrirlo, lo gastarían antes de que el usuario hiciera clic.
 */
export function VerifyEmail({ token }: { token: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<"checking" | "done" | "failed">(token ? "checking" : "failed");
  const sent = useRef(false);

  useEffect(() => {
    // Una sola vez aunque React monte el efecto dos veces en desarrollo.
    if (!token || sent.current) return;
    sent.current = true;
    postJson<{ email: string }>("/api/auth/verify-email", { token })
      .then((data) => {
        setState("done");
        router.replace(`/login?verified=1&email=${encodeURIComponent(data.email)}`);
      })
      .catch(() => setState("failed"));
  }, [token, router]);

  if (state === "checking" || state === "done") {
    return (
      <p role="status" className="flex items-center gap-2.5 text-sm text-muted">
        {state === "done" ? (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-ok text-white">
            <Icon name="check" className="h-3 w-3" />
          </span>
        ) : (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
        )}
        {state === "done" ? t("verify.redirecting") : t("verify.checking")}
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3.5 text-sm text-danger">
        {t("verify.failed")}
      </p>
      <Link href="/login" className={`${buttonClass("secondary")} w-full`}>
        {t("verify.toLogin")}
      </Link>
    </div>
  );
}
