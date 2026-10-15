import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ProjectBoard } from "@/features/projects/ProjectBoard";
import { apiGet } from "@/lib/api";
import type { VideoProject } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const token = (await cookies()).get("ia_session")?.value;
  if (!token) redirect("/login");
  const data = await apiGet<{ videos: VideoProject[] }>("/api/videos", token);
  if (!data) redirect("/login");
  return (
    <Shell>
      <ProjectBoard videos={data.videos} />
    </Shell>
  );
}
