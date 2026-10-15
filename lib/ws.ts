/**
 * URL del WebSocket del backend.
 *
 * IMPORTANTE: los `rewrites` de Next.js sólo proxean HTTP; NO reenvían el
 * upgrade a WebSocket. Conectar a `ws://<host-de-Next>/api/...` hace que el
 * dev server cierre el handshake ("WebSocket is closed before the connection
 * is established"). Por eso el navegador se conecta DIRECTAMENTE al backend,
 * cuya dirección se configura aquí.
 *
 * `NEXT_PUBLIC_WS_URL` debe apuntar al backend real, p. ej.
 *   NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000
 * Si no se define, se deduce del host de la página cambiando el puerto de la
 * API (`NEXT_PUBLIC_API_PORT`, 8000 por defecto), nunca del puerto de Next.
 */

const DEFAULT_API_PORT = "8000";

function apiPort(): string {
  const configured = process.env.NEXT_PUBLIC_API_PORT;
  return configured && configured.trim() ? configured.trim() : DEFAULT_API_PORT;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/**
 * Alinea el host de una URL de loopback con el de la página.
 *
 * La sesión es una cookie de host: si la página se abre en `localhost:3000`
 * la cookie pertenece a "localhost" y NO viaja a `ws://127.0.0.1:8000` (y al
 * revés). El backend responde "No autenticado", cierra y el cliente entra en
 * un bucle de reconexiones sin recibir nunca un subtítulo. Ambos nombres son
 * la misma máquina, así que se usa el que tenga la página.
 */
export function alignLoopbackHost(url: string, pageHostname: string | null | undefined): string {
  if (!pageHostname || !LOOPBACK.has(pageHostname)) return url;
  try {
    const parsed = new URL(url);
    if (!LOOPBACK.has(parsed.hostname) || parsed.hostname === pageHostname) return url;
    parsed.hostname = pageHostname;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return url;
  }
}

/** base del WebSocket del backend, sin barra final. */
export function wsBase(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit && explicit.trim()) {
    const base = explicit.trim().replace(/\/+$/, "");
    return typeof window === "undefined" ? base : alignLoopbackHost(base, window.location.hostname);
  }
  if (typeof window === "undefined") {
    // En servidor no hay host de página; se usa loopback con el puerto de la API.
    return `ws://127.0.0.1:${apiPort()}`;
  }
  // Se conserva el host que usa el usuario (127.0.0.1 o localhost) pero con el
  // puerto del BACKEND, que es quien sirve el WebSocket.
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.hostname}:${apiPort()}`;
}

export function wsUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${wsBase()}${clean}`;
}

/** Etiqueta legible para los logs de diagnóstico del WebSocket. */
export function wsLabel(path: string): string {
  return wsUrl(path);
}

export const __TEST__ = { apiPort, DEFAULT_API_PORT };

/**
 * Ticket de un solo uso para abrir un WebSocket del backend.
 *
 * Se pide por HTTP al MISMO origen de la página (Next lo proxea con la cookie
 * de sesión), así que funciona aunque el navegador no envíe la cookie al
 * puerto del backend (otro nombre de host, URL de red de Next…).
 * Devuelve "unauthorized" si la sesión ya no es válida: no tiene sentido
 * reintentar la conexión. `null` = backend no disponible: reintentar más tarde.
 */
export async function fetchWsTicket(): Promise<string | null | "unauthorized"> {
  try {
    const response = await fetch("/api/ws-ticket", { method: "POST", credentials: "include" });
    if (response.status === 401) return "unauthorized";
    if (!response.ok) return null;
    const data = (await response.json()) as { ticket?: string };
    return data.ticket || null;
  } catch {
    return null;
  }
}

export function wsUrlWithTicket(path: string, ticket: string | null): string {
  const url = wsUrl(path);
  if (!ticket) return url;
  return `${url}${url.includes("?") ? "&" : "?"}ticket=${encodeURIComponent(ticket)}`;
}
