import { ApiError } from "@/services/client";

export type UploadResult = {
  id: string;
  job_id: string;
  title: string;
  duration_ms: number;
};

/**
 * Sube el vídeo con XHR para poder informar del progreso real de subida.
 *
 * Usa `FormData` con el `File` directamente: el navegador lo envía en streaming
 * (multipart), así que no se materializa el archivo entero en memoria.
 */
export function uploadVideo(
  file: File,
  source: string,
  targets: string[],
  onProgress: (loaded: number, total: number) => void,
  signal: { abort: () => void },
): Promise<UploadResult> {
  const body = new FormData();
  body.set("file", file);
  body.set("source_language", source);
  body.set("target_languages", targets.join(","));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    signal.abort = () => xhr.abort();
    xhr.open("POST", "/api/videos");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResult);
        } catch (caught) {
          reject(new ApiError(xhr.status, caught instanceof Error ? caught.message : "respuesta inválida"));
        }
        return;
      }
      let detail = xhr.statusText || "Error de API";
      try {
        const parsed = JSON.parse(xhr.responseText) as { detail?: unknown };
        if (typeof parsed?.detail === "string" && parsed.detail.trim()) detail = parsed.detail.trim();
      } catch {
        /* cuerpo no JSON */
      }
      reject(new ApiError(xhr.status, detail));
    };
    xhr.onerror = () => reject(new ApiError(0, "network"));
    xhr.ontimeout = () => reject(new ApiError(0, "timeout"));
    xhr.onabort = () => reject(new Error("abort"));
    xhr.send(body);
  });
}
