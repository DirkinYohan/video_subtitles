// Archivo soltado fuera de "Nuevo proyecto" (p. ej. sobre Mis proyectos) que la
// pantalla de subida recoge al montarse. Vive sólo en memoria del cliente.
let pending: File | null = null;

export function setPendingUpload(file: File): void {
  pending = file;
}

export function takePendingUpload(): File | null {
  const file = pending;
  pending = null;
  return file;
}

export function isMediaFile(file: File | null | undefined): file is File {
  if (!file) return false;
  return /^(video|audio)\//.test(file.type) || /\.(mp4|mkv|mov|wav|mp3|m4a)$/i.test(file.name);
}
