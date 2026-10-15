/** Cliente HTTP del frontend. Traduce los fallos a mensajes de dominio. */

import type { MessageKey } from "@/lib/i18n";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Códigos conocidos del backend -> clave i18n del frontend. */
export function errorMessageKey(error: unknown): MessageKey {
  if (error instanceof ApiError) {
    if (error.status === 401) return "error.unauthorized";
    if (error.status === 403) return "error.forbidden";
    if (error.status === 404) return "error.notFound";
    if (error.status === 409) return "error.conflict";
    if (error.status === 413) return "error.tooLarge";
    if (error.status === 422) return "error.invalid";
    if (error.status === 429) return "error.tooMany";
    if (error.status >= 500) return "error.server";
    return "error.generic";
  }
  return "error.offline";
}

async function readDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data?.detail === "string" && data.detail.trim()) return data.detail.trim();
  } catch {
    /* cuerpo no JSON */
  }
  return response.statusText || "Error de API";
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (caught) {
    // Fallo de red: no hay respuesta que interpretar.
    throw new ApiError(0, caught instanceof Error ? caught.message : "network");
  }
  if (!response.ok) throw new ApiError(response.status, await readDetail(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, "POST", body);
}

export function putJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, "PUT", body);
}

export function patchJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, "PATCH", body);
}

export function deleteJson<T>(path: string): Promise<T> {
  return request<T>(path, "DELETE");
}

export function getJson<T>(path: string): Promise<T> {
  return request<T>(path, "GET");
}
