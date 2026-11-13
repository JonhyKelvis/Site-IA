export type JobStage = "uploading" | "queueing" | "processing" | "done" | "error";

export type JobRecord = {
  id: string;
  createdAt: number;
  model: string;
  modelLabel: string;
  aspect: string;
  stage: JobStage;
  progress: number;
  thumbUrl: string | null;
  videoUrl: string | null;
  requestId?: string;
  error?: string;
  duration: number;
  queuePosition?: number | null;
  /** parâmetros usados na geração, para retomar o polling após recarregar a página */
  params?: {
    keepOriginalSound: boolean;
    characterOrientation: "image" | "video";
  };
};

const KEY = "motionlab.jobs.v1";

export function loadJobs(): JobRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((job) => job && typeof job.id === "string").slice(0, 12);
  } catch {
    return [];
  }
}

export function saveJobs(jobs: JobRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs.slice(0, 12)));
  } catch {
    /* armazenamento cheio / modo privado — ignorado */
  }
}
