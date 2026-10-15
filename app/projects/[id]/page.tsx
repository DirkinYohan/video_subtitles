import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { WatchStudio } from "@/features/studio/WatchStudio";
import { apiGet } from "@/lib/api";
import type { Cue, Job, VideoProject } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("ia_session")?.value;
  if (!token) redirect("/login");
  const data = await apiGet<{ video: VideoProject; jobs: Job[] }>(`/api/videos/${id}`, token);
  if (!data) notFound();
  const subs = await apiGet<{ subtitles: { language: string; cues: Cue[] }[] }>(`/api/subtitles/${id}`, token);
  const tracks: Record<string, Cue[]> = {};
  for (const track of subs?.subtitles || []) tracks[track.language] = track.cues;
  return (
    <Shell>
      <WatchStudio project={data.video} job={data.jobs[0] ?? null} tracks={tracks} />
    </Shell>
  );
}
