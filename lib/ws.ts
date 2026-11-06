const DEFAULT_API_PORT = "8000";

function apiPort(): string {
  const configured = process.env.NEXT_PUBLIC_API_PORT;
  return configured && configured.trim() ? configured.trim() : DEFAULT_API_PORT;
}

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

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

export function wsBase(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit && explicit.trim()) {
    const base = explicit.trim().replace(/\/+$/, "");
    return typeof window === "undefined" ? base : alignLoopbackHost(base, window.location.hostname);
  }
  if (typeof window === "undefined") {
    return `ws://127.0.0.1:${apiPort()}`;
  }
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.hostname}:${apiPort()}`;
}

export function wsUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${wsBase()}${clean}`;
}

export function wsLabel(path: string): string {
  return wsUrl(path);
}

export const __TEST__ = { apiPort, DEFAULT_API_PORT };

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
