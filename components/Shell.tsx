import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppFrame } from "@/components/AppFrame";
import { apiGet } from "@/lib/api";
import type { User } from "@/types/domain";

export async function Shell({ children }: { children: ReactNode }) {
  const token = (await cookies()).get("ia_session")?.value;
  const user = token ? await apiGet<User>("/api/auth/me", token) : null;
  return <AppFrame user={user}>{children}</AppFrame>;
}
