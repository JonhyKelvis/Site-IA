/// <reference lib="dom" />
/**
 * Núcleo do backend (compartilhado entre o dev server do Vite e as
 * Serverless Functions da Vercel).
 *
 * Responsabilidades:
 *  1. Guardar a FAL_KEY só no servidor e falar com a fila da fal.ai.
 *  2. Exigir o código de acesso (SITE_ACCESS_CODE), se configurado.
 *  3. Emitir URLs assinadas + tokens temporários para que o NAVEGADOR
 *     faça upload direto no CDN da fal (sem passar pela função serverless),
 *     permitindo arquivos de até ~200 MB.
 */

const QUEUE_BASE = "https://queue.fal.run";
const REST_BASE = "https://rest.fal.ai";
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB — limite aceito pelos modelos
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 h

export type ModelId = "kling-pro" | "kling-standard" | "wan-animate";

type ModelDef = {
  id: ModelId;
  endpoint: string;
  label: string;
  maxSeconds: number;
  pricePerSecond: number;
};

export const MODELS: Record<ModelId, ModelDef> = {
  "kling-pro": {
    id: "kling-pro",
    endpoint: "fal-ai/kling-video/v3/pro/motion-control",
    label: "Kling 3.0 Pro",
    maxSeconds: 30,
    pricePerSecond: 0.168,
  },
  "kling-standard": {
    id: "kling-standard",
    endpoint: "fal-ai/kling-video/v3/standard/motion-control",
    label: "Kling 3.0 Standard",
    maxSeconds: 30,
    pricePerSecond: 0.126,
  },
  "wan-animate": {
    id: "wan-animate",
    endpoint: "fal-ai/wan/v2.2-14b/animate/move",
    label: "Wan 2.2 Animate",
    maxSeconds: 120,
    pricePerSecond: 0.154,
  },
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function loadEnvFile() {
  try {
    // Carrega .env / .env.local em runtime (dev server e funções da Vercel)
    (process as any).loadEnvFile?.();
    (process as any).loadEnvFile?.(".env.local");
  } catch {
    /* ignorado: arquivo inexistente */
  }
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function env(name: string): string {
  loadEnvFile();
  return (process.env[name] ?? "").trim();
}

function falKey(): string {
  const key = env("FAL_KEY");
  if (!key) {
    throw Object.assign(new Error("FAL_KEY não configurada no servidor."), { status: 500 });
  }
  return key;
}

function sign(payload: string, secret: string): string {
  // HMAC-SHA256 usando Web Crypto (disponível na Vercel e no Node 20+)
  const encoder = new TextEncoder();
  const keyPromise = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return keyPromise
    .then((key) => crypto.subtle.sign("HMAC", key, encoder.encode(payload)))
    .then((sig) =>
      btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, ""),
    );
}

/** Token de sessão assinado (não expõe o código de acesso). */
async function issueSessionToken(secret: string) {
  const payload = JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS });
  const encoded = btoa(payload).replace(/=+$/, "");
  return `${encoded}.${await sign(encoded, secret)}`;
}

async function verifySessionToken(token: string, secret: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return false;
  if ((await sign(encoded, secret)) !== signature) return false;
  try {
    const { exp } = JSON.parse(atob(encoded));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

/** Verifica se a requisição pode usar a API (código de acesso opcional). */
async function isAuthorized(req: Request): Promise<boolean> {
  const code = env("SITE_ACCESS_CODE");
  if (!code) return true;
  const token = req.headers.get("x-access-token") ?? "";
  return token ? verifySessionToken(token, code) : false;
}

async function readJson(req: Request): Promise<any> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function falFetch(path: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(`${REST_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Key ${falKey()}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw Object.assign(
      new Error("Não foi possível conectar à fal.ai. Verifique a conexão do servidor e a FAL_KEY."),
      { status: 502 },
    );
  }
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const detail = data?.detail ?? data?.error ?? text ?? "falha na fal.ai";
    throw Object.assign(
      new Error(typeof detail === "string" ? detail : JSON.stringify(detail)),
      { status: response.status },
    );
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* rotas                                                               */
/* ------------------------------------------------------------------ */

async function handleSession(req: Request) {
  const required = Boolean(env("SITE_ACCESS_CODE"));
  const body = await readJson(req);
  const token = req.headers.get("x-access-token") || (typeof body?.token === "string" ? body.token : "");

  if (!required) {
    return Response.json({
      ok: true,
      accessRequired: false,
      token: null,
      models: Object.values(MODELS).map(({ id, label, maxSeconds, pricePerSecond }) => ({
        id,
        label,
        maxSeconds,
        pricePerSecond,
      })),
    });
  }

  if (token && (await verifySessionToken(token, env("SITE_ACCESS_CODE")))) {
    return Response.json({
      ok: true,
      accessRequired: true,
      token,
      models: Object.values(MODELS).map(({ id, label, maxSeconds, pricePerSecond }) => ({
        id,
        label,
        maxSeconds,
        pricePerSecond,
      })),
    });
  }

  return Response.json({ ok: false, accessRequired: true, needCode: true });
}

async function handleLogin(req: Request) {
  const body = await readJson(req);
  const code = env("SITE_ACCESS_CODE");
  if (!code) return Response.json({ ok: true, token: null, accessRequired: false });
  if ((body?.code ?? "").toString().trim() !== code) {
    return jsonError("Código de acesso incorreto.", 401);
  }
  return Response.json({ ok: true, token: await issueSessionToken(code), accessRequired: true });
}

async function handleUploadInit(req: Request) {
  if (!(await isAuthorized(req))) return jsonError("Não autorizado.", 401);
  const body = await readJson(req);
  const contentType = String(body?.contentType ?? "application/octet-stream");
  const fileName = String(body?.fileName ?? "arquivo");
  const size = Number(body?.size ?? 0);
  const kind = body?.kind === "image" ? "image" : "video";

  const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (!Number.isFinite(size) || size <= 0) return jsonError("Arquivo inválido.");
  if (size > limit) {
    return jsonError(
      `Arquivo muito grande (${(size / 1024 / 1024).toFixed(1)} MB). Máximo: ${Math.round(
        limit / 1024 / 1024,
      )} MB.`,
      413,
    );
  }

  const data = await falFetch("/storage/upload/initiate?storage_type=fal-cdn-v3", {
    method: "POST",
    body: JSON.stringify({ content_type: contentType, file_name: fileName }),
  });

  return Response.json({ uploadUrl: data.upload_url, fileUrl: data.file_url });
}

async function handleRun(req: Request) {
  if (!(await isAuthorized(req))) return jsonError("Não autorizado.", 401);
  const body = await readJson(req);

  const model = MODELS[body?.model as ModelId];
  if (!model) return jsonError("Modelo inválido.");
  if (!body?.imageUrl || !body?.videoUrl) return jsonError("Envie a imagem e o vídeo.");
  const duration = Number(body?.duration ?? 0);
  if (duration > model.maxSeconds) {
    return jsonError(`Este modelo aceita no máximo ${model.maxSeconds}s de vídeo de referência.`);
  }

  let input: Record<string, unknown>;
  if (model.id === "wan-animate") {
    input = {
      image_url: body.imageUrl,
      video_url: body.videoUrl,
      resolution: body.resolution === "480p" ? "480p" : "720p",
      use_turbo: true,
    };
  } else {
    input = {
      image_url: body.imageUrl,
      video_url: body.videoUrl,
      character_orientation: body.characterOrientation === "video" ? "video" : "image",
      keep_original_sound: body.keepOriginalSound !== false,
      ...(body.prompt ? { prompt: body.prompt } : {}),
    };
  }

  const submitted = await falFetch(`/${model.endpoint}`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  return Response.json({ requestId: submitted.request_id, model: model.id });
}

async function handleStatus(req: Request, url: URL) {
  if (!(await isAuthorized(req))) return jsonError("Não autorizado.", 401);
  const model = MODELS[url.searchParams.get("model") as ModelId];
  const requestId = url.searchParams.get("requestId") ?? "";
  if (!model || !requestId) return jsonError("Parâmetros inválidos.");

  let response: Response;
  try {
    response = await fetch(
      `${QUEUE_BASE}/${model.endpoint}/requests/${requestId}/status?logs=1`,
      { headers: { Authorization: `Key ${falKey()}` } },
    );
  } catch (error) {
    // erro de rede momentâneo: o front tenta de novo
    return Response.json({ status: "IN_QUEUE", transient: true });
  }

  if (!response.ok) {
    const text = await response.text();
    return Response.json(
      { status: "ERROR", error: text || `Status ${response.status}` },
      { status: 200 },
    );
  }

  const data = await response.json();
  const status = data.status as string;

  if (status === "COMPLETED") {
    const result = await falFetch(`/${model.endpoint}/requests/${requestId}`);
    const videoUrl = result?.video?.url ?? null;
    return Response.json({ status, videoUrl, raw: videoUrl ? undefined : result });
  }

  return Response.json({
    status,
    queuePosition: data.queue_position ?? null,
    logs: Array.isArray(data.logs)
      ? data.logs.slice(-3).map((log: any) => log?.message).filter(Boolean)
      : [],
  });
}

async function handleDownload(url: URL) {
  const target = url.searchParams.get("url");
  if (!target || !/^https:\/\//.test(target)) return jsonError("URL inválida.");
  const upstream = await fetch(target);
  if (!upstream.ok) return jsonError("Não foi possível baixar o vídeo.", 502);
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
      "Content-Disposition": 'attachment; filename="motionlab.mp4"',
      "Cache-Control": "no-store",
    },
  });
}

/* ------------------------------------------------------------------ */
/* entrada única                                                       */
/* ------------------------------------------------------------------ */

export async function handleApi(req: Request, pathname: string): Promise<Response> {
  const url = new URL(req.url);
  const route = pathname.replace(/^\/api/, "").replace(/\/$/, "") || "/";

  try {
    switch (route) {
      case "/session":
        return await handleSession(req);
      case "/login":
        return req.method === "POST" ? await handleLogin(req) : jsonError("Use POST.", 405);
      case "/upload-init":
        return req.method === "POST" ? await handleUploadInit(req) : jsonError("Use POST.", 405);
      case "/run":
        return req.method === "POST" ? await handleRun(req) : jsonError("Use POST.", 405);
      case "/status":
        return await handleStatus(req, url);
      case "/download":
        return await handleDownload(url);
      case "/health":
        return Response.json({ ok: true, falKey: Boolean(env("FAL_KEY")) });
      default:
        return jsonError("Rota não encontrada.", 404);
    }
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return Response.json({ error: error?.message ?? "Erro inesperado." }, { status });
  }
}
