export function publicApiBase(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  return value && value.trim() ? value.trim().replace(/\/+$/, "") : "";
}

export async function directApiUrl(path: string): Promise<string> {
  const base = publicApiBase();
  if (!base) return path;
  const response = await fetch("/api/ws-ticket", { method: "POST", credentials: "include" });
  if (!response.ok) throw new Error(`ticket ${response.status}`);
  const { ticket } = (await response.json()) as { ticket: string };
  const separator = path.includes("?") ? "&" : "?";
  return `${base}${path}${separator}ticket=${encodeURIComponent(ticket)}`;
}

export async function downloadDirect(path: string): Promise<void> {
  const link = document.createElement("a");
  link.href = await directApiUrl(path);
  link.download = "";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
