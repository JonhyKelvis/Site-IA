/**
 * Adaptador entre o runtime Node da Vercel (req/res) e o núcleo Web
 * (Request/Response) compartilhado em server/api.ts.
 */
import { handleApi, loadEnvFile } from "./api.ts";

async function readRawBody(req: any): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function webRequestFromNode(req: any): Promise<{ request: Request; pathname: string }> {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(","));
  }

  let body: Buffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (Buffer.isBuffer(req.body)) body = req.body;
    else if (typeof req.body === "string") body = Buffer.from(req.body);
    else if (req.body && typeof req.body === "object") body = Buffer.from(JSON.stringify(req.body));
    else body = await readRawBody(req);
    if (body && body.length === 0) body = undefined;
    if (body) headers.set("content-type", headers.get("content-type") ?? "application/json");
  }

  const request = new Request(url.href, {
    method: req.method,
    headers,
    body: body as unknown as BodyInit | undefined,
  });

  return { request, pathname: url.pathname };
}

export async function sendNodeResponse(res: any, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export async function vercelHandler(req: any, res: any) {
  loadEnvFile();
  try {
    const { request, pathname } = await webRequestFromNode(req);
    const response = await handleApi(request, pathname);
    await sendNodeResponse(res, response);
  } catch (error: any) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: error?.message ?? "Erro inesperado." }));
  }
}

export default vercelHandler;
