import { uploadToFal, type UploadProgress } from "./upload.ts";
import { probeVideo } from "./media.ts";

const TOKEN_KEY = "motionlab.access-token";

export type ModelInfo = {
  id: "kling-pro" | "kling-standard" | "wan-animate";
  label: string;
  maxSeconds: number;
  pricePerSecond: number;
};

export type SessionInfo = {
  accessRequired: boolean;
  needCode: boolean;
  models: ModelInfo[];
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* modo privado */
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (token) headers.set("x-access-token", token);

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(
      "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.",
      0,
    );
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error ??
      (response.status === 404
        ? "Rota de API não encontrada. No deploy, confirme que o site está rodando na Vercel (com a pasta /api)."
        : `Erro ${response.status}.`);
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export async function fetchSession(): Promise<SessionInfo> {
  const data = await apiFetch<any>("/api/session", { cache: "no-store" } as RequestInit);
  if (data?.token) setToken(data.token);
  return {
    accessRequired: Boolean(data?.accessRequired),
    needCode: Boolean(data?.needCode),
    models: Array.isArray(data?.models) ? data.models : [],
  };
}

export async function login(code: string): Promise<void> {
  const data = await apiFetch<any>("/api/login", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  if (data?.token) setToken(data.token);
}

export type RunOptions = {
  model: string;
  imageUrl: string;
  videoUrl: string;
  characterOrientation: "image" | "video";
  keepOriginalSound: boolean;
  prompt?: string;
  resolution?: "480p" | "720p";
  duration: number;
};

export async function startRun(options: RunOptions) {
  return apiFetch<{ requestId: string; model: string }>("/api/run", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export type JobStatus = {
  status: string;
  videoUrl?: string | null;
  queuePosition?: number | null;
  logs?: string[];
  error?: string;
};

export async function fetchStatus(model: string, requestId: string): Promise<JobStatus> {
  const params = new URLSearchParams({ model, requestId });
  return apiFetch<JobStatus>(`/api/status?${params.toString()}`);
}

export function downloadUrl(videoUrl: string): string {
  return `/api/download?url=${encodeURIComponent(videoUrl)}`;
}

/** Sobe a imagem/vídeo direto para o CDN da fal.ai (sem limite da Vercel). */
export async function uploadMedia(
  file: File,
  kind: "image" | "video",
  onProgress: (progress: UploadProgress) => void,
): Promise<string> {
  return uploadToFal(file, kind, onProgress, () => getToken());
}

export { probeVideo };
