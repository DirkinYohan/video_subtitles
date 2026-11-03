/**
 * Formatos de presentación compartidos. Módulo puro (Server y Client).
 */

const MEDIA_EXTENSION = /\.(mp4|mkv|mov|webm|avi|m4v|wav|mp3|m4a|aac|flac|ogg)$/i;

/**
 * Título legible de un proyecto: sin la extensión del archivo y con espacios
 * en lugar de guiones bajos. "Rutinas_de_fin.mp4" → "Rutinas de fin".
 * Si al limpiarlo no queda nada, se devuelve el original.
 */
export function displayTitle(title: string): string {
  const clean = String(title ?? "")
    .replace(MEDIA_EXTENSION, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean || String(title ?? "");
}

/** Tamaño de archivo legible: 512 KB, 12,4 MB, 1,2 GB. */
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
