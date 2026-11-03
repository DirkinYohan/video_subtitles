import { AuthScreen } from "@/components/chrome";
import { AuthForm } from "@/features/auth/AuthForm";
import { translate } from "@/lib/i18n";
import { readLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; email?: string }>;
}) {
  const locale = await readLocale();
  const query = await searchParams;
  const notice = query.verified === "1" ? translate(locale, "verify.doneLogin") : "";
  return (
    <AuthScreen locale={locale} title={translate(locale, "auth.welcome")}>
      <AuthForm mode="login" notice={notice} email={query.email || ""} />
    </AuthScreen>
  );
}
