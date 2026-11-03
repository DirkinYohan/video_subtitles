export type Cue = {
  index: number;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker: string;
  language: string;
  state: "provisional" | "final";
};

export type VideoProject = {
  id: string;
  title: string;
  source_language: string;
  target_languages: string[];
  status: string;
  created_at: string;
  duration_ms: number;
  thumbnail_url: string;
};

export type JobStageEntry = {
  stage: string;
  status: string;
  progress: number;
  at: string;
};

export type ProcessingMode = "progressive" | "full";

export type Job = {
  id: string;
  project_id: string;
  status: string;
  progress: number;
  stage: string;
  error: string;
  updated_at: string;
  stage_history?: JobStageEntry[];
  mode?: ProcessingMode;
  last_cue_ms?: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  created_at?: string;
  email_verified?: boolean;
};
