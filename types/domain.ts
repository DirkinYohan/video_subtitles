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
  /** Duración real del medio, medida con ffprobe al subir. 0 si no se pudo leer. */
  duration_ms: number;
  /** URL de la miniatura generada, o "" si no hay. */
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
  /** Etapas recorridas, tal como las registró el servidor. */
  stage_history?: JobStageEntry[];
  /** `progressive` publica subtítulos mientras procesa; `full` al final. */
  mode?: ProcessingMode;
  /** Último milisegundo de audio con subtítulos ya disponibles. */
  last_cue_ms?: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  created_at?: string;
};
