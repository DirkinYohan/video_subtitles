const API = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

export async function apiGet<T>(path: string, cookie: string): Promise<T | null> {
  const response = await fetch(`${API}${path}`, {
    headers: { cookie: `ia_session=${cookie}` },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}
