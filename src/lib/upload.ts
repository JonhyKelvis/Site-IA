/**
 * Upload direto do navegador para o CDN da fal.ai.
 *
 * Fluxo (igual ao do SDK oficial, mas sem expor a chave):
 *   1. POST /api/upload-init  -> recebe { uploadUrl, fileUrl } (a função
 *      serverless assina com a FAL_KEY; o navegador nunca vê a chave).
 *   2. PUT no uploadUrl com o arquivo e progresso real via XMLHttpRequest.
 *
 * Como o arquivo não passa pela função serverless, o limite é o do modelo
 * (200 MB), e não os ~4,5 MB do corpo de uma função da Vercel.
 */

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export async function uploadToFal(
  file: File,
  kind: "image" | "video",
  onProgress: (progress: UploadProgress) => void,
  getToken: () => string | null,
): Promise<string> {
  const token = getToken();
  const initResponse = await fetch("/api/upload-init", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-access-token": token } : {}),
    },
    body: JSON.stringify({
      contentType: file.type || (kind === "image" ? "image/jpeg" : "video/mp4"),
      fileName: (file.name || `${kind}-${Date.now()}`).replace(/[^\w.\-]+/g, "_"),
      size: file.size,
      kind,
    }),
  });

  const initText = await initResponse.text();
  let initData: any = null;
  try {
    initData = initText ? JSON.parse(initText) : null;
  } catch {
    initData = null;
  }

  if (!initResponse.ok || !initData?.uploadUrl) {
    throw new Error(
      initData?.error ??
        `Não foi possível preparar o upload (erro ${initResponse.status}). Verifique se a FAL_KEY está configurada.`,
    );
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", initData.uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({ loaded: file.size, total: file.size, percent: 100 });
        resolve();
      } else {
        reject(new Error(`Falha no upload (${xhr.status}). Tente novamente.`));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Falha de rede durante o upload. Verifique sua conexão."));
    xhr.ontimeout = () => reject(new Error("O upload demorou demais. Tente novamente."));
    xhr.timeout = 30 * 60 * 1000;
    xhr.send(file);
  });

  return initData.fileUrl as string;
}
