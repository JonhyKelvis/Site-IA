import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { handleApi, loadEnvFile } from "./server/api.ts";

loadEnvFile();

const MAX_BODY = 1024 * 1024; // 1 MB — os uploads de arquivos vão direto para o CDN

function readBody(req: any): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Corpo da requisição muito grande."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on("error", reject);
  });
}

/**
 * Plugin de dev server: mantém exatamente as mesmas rotas /api/* que a
 * Vercel usa em produção, para que dev e produção se comportem igual.
 */
function devApi(): Plugin {
  return {
    name: "motionlab-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.originalUrl ?? req.url ?? "/";
        if (!rawUrl.startsWith("/api/")) return next();

        try {
          const host = req.headers.host ?? "localhost";
          const url = new URL(rawUrl, `http://${host}`);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === "string") headers.set(key, value);
            else if (Array.isArray(value)) headers.set(key, value.join(","));
          }

          const body = await readBody(req);
          const request = new Request(url.href, {
            method: req.method,
            headers,
            body: body as unknown as BodyInit | undefined,
          });

          const response = await handleApi(request, url.pathname);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error: any) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: error?.message ?? "Erro interno" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  // Permite o preview dentro do iframe do Arena/E2B e hosts *.e2b.app
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 5173,
    strictPort: false,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
