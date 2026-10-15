export const LANGS = ["es", "en", "fr", "pt", "it", "de", "ja", "zh"] as const;

const FLAGS: Record<string, string> = {
  es: "🇪🇸",
  en: "🇺🇸",
  fr: "🇫🇷",
  pt: "🇵🇹",
  it: "🇮🇹",
  de: "🇩🇪",
  ja: "🇯🇵",
  zh: "🇨🇳",
  und: "✦",
};

export function flag(code: string): string {
  return FLAGS[code] || "✦";
}
