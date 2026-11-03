import { cookies } from "next/headers";
import { isTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

/** Tema elegido por el usuario, o `null` si sigue al del sistema. */
export async function readTheme(): Promise<Theme | null> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : null;
}
