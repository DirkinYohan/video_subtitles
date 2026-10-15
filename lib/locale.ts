import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export async function readLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "es";
}
