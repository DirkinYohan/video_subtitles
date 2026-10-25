"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-4">
      <section className="grid w-full max-w-sm justify-items-center rounded-xl border border-line bg-surface p-7 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-danger-soft text-danger">
          <Icon name="alert" className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-base font-semibold text-ink">{t("error.server")}</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted">{t("error.generic")}</p>
        <Button type="button" className="mt-5" onClick={reset}>
          {t("job.retry")}
        </Button>
      </section>
    </main>
  );
}
