import { AuthScreen } from "@/components/chrome";
import { AuthForm } from "@/features/auth/AuthForm";
import { translate } from "@/lib/i18n";
import { readLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const locale = await readLocale();
  const query = await searchParams;
  return (
    <AuthScreen locale={locale} title={translate(locale, "auth.resetTitle")}>
      <AuthForm mode="reset" token={query.token || ""} />
    </AuthScreen>
  );
}
