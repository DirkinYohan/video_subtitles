import en from "@/i18n/en/common.json";
import es from "@/i18n/es/common.json";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type MessageKey = keyof typeof es;
export const LOCALE_COOKIE = "ia_locale";

const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  es,
  en: en as Record<MessageKey, string>,
};

const esKeys = Object.keys(es);
const enKeys = Object.keys(en);
if (esKeys.length !== enKeys.length || esKeys.some((key) => !(key in en))) {
  throw new Error("i18n: es y en no tienen las mismas claves");
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "es" || value === "en";
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text = dictionaries[locale][key] ?? dictionaries.es[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function languageLabel(locale: Locale, code: string): string {
  const key = `lang.${code}` as MessageKey;
  if (key in dictionaries.es) return translate(locale, key);
  return code;
}
