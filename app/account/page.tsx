import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { AccountPanel } from "@/features/account/AccountPanel";
import { apiGet } from "@/lib/api";
import type { User } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const token = (await cookies()).get("ia_session")?.value;
  if (!token) redirect("/login");
  const user = await apiGet<User>("/api/auth/me", token);
  if (!user) redirect("/login");
  return (
    <Shell>
      <AccountPanel user={user} />
    </Shell>
  );
}
