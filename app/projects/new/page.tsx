import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { CreateStudio } from "@/features/studio/CreateStudio";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const token = (await cookies()).get("ia_session")?.value;
  if (!token) redirect("/login");
  return (
    <Shell>
      <CreateStudio />
    </Shell>
  );
}
