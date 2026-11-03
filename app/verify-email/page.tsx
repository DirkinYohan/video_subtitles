import { AuthScreen } from "@/components/chrome";
import { VerifyEmail } from "@/features/auth/VerifyEmail";
import { translate } from "@/lib/i18n";
import { readLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const locale = await readLocale();
  const query = await searchParams;
  return (
    <AuthScreen locale={locale} title={translate(locale, "verify.title")}>
      <VerifyEmail token={query.token || ""} />
    </AuthScreen>
  );
}
