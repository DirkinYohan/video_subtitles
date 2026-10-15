import { AuthScreen } from "@/components/chrome";
import { AuthForm } from "@/features/auth/AuthForm";
import { translate } from "@/lib/i18n";
import { readLocale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const locale = await readLocale();
  return (
    <AuthScreen locale={locale} title={translate(locale, "auth.registerTitle")}>
      <AuthForm mode="register" />
    </AuthScreen>
  );
}
