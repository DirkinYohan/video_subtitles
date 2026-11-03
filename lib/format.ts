const MEDIA_EXTENSION = /\.(mp4|mkv|mov|webm|avi|m4v|wav|mp3|m4a|aac|flac|ogg)$/i;

export function displayTitle(title: string): string {
  const clean = String(title ?? "")
    .replace(MEDIA_EXTENSION, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean || String(title ?? "");
}

export function formatBytes(bytes: number, locale = "es"): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit >= 2 && value < 100 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}
