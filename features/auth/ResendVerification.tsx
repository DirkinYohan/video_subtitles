"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { errorMessageKey, postJson } from "@/services/client";

export function ResendVerification({ email }: { email: string }) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function resend() {
    setState("sending");
    setError("");
    try {
      await postJson("/api/auth/resend-verification", { email, locale });
      setState("sent");
    } catch (caught) {
      setError(t(errorMessageKey(caught)));
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-ok">
        <Icon name="check" className="h-4 w-4" />
        {t("verify.resent")}
      </p>
    );
  }
  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        onClick={() => void resend()}
        disabled={state === "sending"}
        className="justify-self-start text-sm font-medium text-accent hover:underline hover:underline-offset-4 disabled:opacity-60"
      >
        {state === "sending" ? t("verify.resending") : t("verify.resend")}
      </button>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
