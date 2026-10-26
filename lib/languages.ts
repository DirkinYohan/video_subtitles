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
