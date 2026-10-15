"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-4">
      <section className="w-full max-w-md rounded-3xl border border-line bg-white p-7 text-center shadow-[0_20px_60px_rgb(35_48_88/0.08)]">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-xl font-bold text-danger">!</span>
        <h1 className="mt-5 text-xl font-bold">{t("error.server")}</h1>
        <p className="mt-2 text-sm text-muted">{t("error.generic")}</p>
        <Button type="button" className="mt-6" onClick={reset}>{t("job.retry")}</Button>
      </section>
    </main>
  );
}
