export const LANGS = ["es", "en", "fr", "pt", "it"] as const;

const FLAGS: Record<string, string> = {
  es: "🇪🇸",
  en: "🇺🇸",
  fr: "🇫🇷",
  pt: "🇵🇹",
  it: "🇮🇹",
  und: "✦",
};

export function flag(code: string): string {
  return FLAGS[code] || "✦";
}

/** Nombre de cada idioma en su propia lengua. */
export const NATIVE_NAMES: Record<string, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  pt: "Português",
  it: "Italiano",
};

const RECENT_KEY = "ia_recent_langs";

export function readRecentLanguages(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

export function rememberLanguage(code: string): void {
  if (!code || code === "und") return;
  try {
    const next = [code, ...readRecentLanguages().filter((item) => item !== code)].slice(0, 3);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
  }
}
