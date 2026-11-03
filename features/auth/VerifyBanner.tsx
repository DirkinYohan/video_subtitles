"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { errorMessageKey, postJson } from "@/services/client";

/** Aviso fijo mientras el correo de la cuenta no esté confirmado. */
export function VerifyBanner({ email }: { email: string }) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function resend() {
    setState("sending");
    setError("");
    try {
      await postJson("/api/auth/resend-verification", { locale });
      setState("sent");
    } catch (caught) {
      setError(t(errorMessageKey(caught)));
      setState("idle");
    }
  }

  return (
    <div role="status" className="border-b border-line bg-warn-soft">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-6">
        <Icon name="alert" className="h-4 w-4 shrink-0 text-warn" />
        <p className="min-w-0 flex-1 text-ink-2">
          <span className="font-semibold text-ink">{t("verify.bannerTitle")}</span>{" "}
          <span className="break-words">{t("verify.bannerBody", { email })}</span>
          {error && <span className="ml-2 font-medium text-danger">{error}</span>}
        </p>
        {state === "sent" ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ok">
            <Icon name="check" className="h-3.5 w-3.5" />
            {t("verify.resent")}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={state === "sending"}
            className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            {state === "sending" ? t("verify.resending") : t("verify.resend")}
          </button>
        )}
      </div>
    </div>
  );
}
