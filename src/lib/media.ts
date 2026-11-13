/**
 * Análise do vídeo de referência 100% no navegador:
 *  - duração, resolução, proporção e estimativa de quadros/segundo;
 *  - extração de um poster (primeiro quadro) para o preview;
 *  - captura de um quadro específico + 16:9 / 9:16 com recorte,
 *    usado pelo fallback local de remoção de áudio.
 */

export type VideoInfo = {
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
  estimatedFps: number | null;
  posterUrl: string;
};

export type AspectId = "9:16" | "16:9" | "1:1" | "4:5" | "original";

export const ASPECTS: { id: AspectId; label: string; hint: string; ratio: number | null }[] = [
  { id: "9:16", label: "9:16", hint: "Vertical · Reels, Shorts, TikTok", ratio: 9 / 16 },
  { id: "16:9", label: "16:9", hint: "Horizontal · YouTube, cinema", ratio: 16 / 9 },
  { id: "1:1", label: "1:1", hint: "Quadrado · Feed", ratio: 1 },
  { id: "4:5", label: "4:5", hint: "Retrato · Instagram", ratio: 4 / 5 },
  { id: "original", label: "Original", hint: "Mesma proporção do vídeo de referência", ratio: null },
];

function loadVideo(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const fail = () =>
      reject(
        new Error(
          "Não foi possível ler o vídeo. Use MP4 (H.264) ou MOV — esse formato é o mais compatível.",
        ),
      );

    video.onloadedmetadata = async () => {
      // Alguns navegadores só expõem a duração depois de buscar o primeiro frame
      if (!Number.isFinite(video.duration) || video.duration === 0) {
        try {
          video.currentTime = 0.1;
          await new Promise((r) => setTimeout(r, 250));
        } catch {
          /* ignorado */
        }
      }
      resolve({ video, url });
    };
    video.onerror = fail;
    setTimeout(() => {
      if (video.readyState === 0) fail();
    }, 20000);
  });
}

/** Detecta se o arquivo tem trilha de áudio (usando o contexto de áudio do navegador). */
export async function detectAudioTrack(file: File): Promise<boolean | null> {
  try {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);
    video.muted = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("erro"));
      setTimeout(() => resolve(), 8000);
    });
    const audioTracks = (video as any).audioTracks;
    if (audioTracks && typeof audioTracks.length === "number") {
      return audioTracks.length > 0;
    }
    const moz = (video as any).mozHasAudio;
    if (typeof moz === "boolean") return moz;
    // webkitAudioDecodedByteCount não está na tipagem padrão
    const webkit = (video as any).webkitAudioDecodedByteCount;
    if (typeof webkit === "number" && video.readyState >= 2) return webkit > 0;
    return null;
  } catch {
    return null;
  }
}

export async function probeVideo(file: File): Promise<VideoInfo> {
  const { video, url } = await loadVideo(file);

  const width = video.videoWidth;
  const height = video.videoHeight;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;

  // estimativa de fps: conta quantos quadros "callback" acontecem em 1s
  let estimatedFps: number | null = null;
  try {
    estimatedFps = await new Promise<number | null>((resolve) => {
      let frames = 0;
      const start = performance.now();
      const rvfc = (video as any).requestVideoFrameCallback;
      if (typeof rvfc !== "function") return resolve(null);
      const tick = () => {
        frames += 1;
        const elapsed = performance.now() - start;
        if (elapsed >= 700) {
          resolve(Math.round((frames / elapsed) * 1000));
          return;
        }
        rvfc.call(video, tick);
      };
      video.currentTime = Math.min(1, duration / 3 || 0);
      video.play().catch(() => resolve(null));
      rvfc.call(video, tick);
      setTimeout(() => resolve(frames > 0 ? Math.round((frames / 700) * 1000) : null), 1500);
    });
  } catch {
    estimatedFps = null;
  }

  // poster: primeiro quadro
  let posterUrl = "";
  try {
    video.pause();
    video.currentTime = Math.min(0.35, duration / 2 || 0);
    await new Promise((r) => {
      video.onseeked = () => r(null);
      setTimeout(() => r(null), 3000);
    });
    const canvas = document.createElement("canvas");
    canvas.width = width || 720;
    canvas.height = height || 1280;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    posterUrl = canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    posterUrl = "";
  }

  video.src = "";
  URL.revokeObjectURL(url);

  return {
    duration,
    width,
    height,
    aspectRatio: height > 0 ? width / height : 9 / 16,
    estimatedFps,
    posterUrl,
  };
}

/** Captura o instante `time` já enquadrado na proporção desejada (recorte central). */
export async function captureFrame(file: File, time: number, ratio: number): Promise<Blob> {
  const { video, url } = await loadVideo(file);
  try {
    video.currentTime = Math.min(Math.max(0.01, time), Math.max(0.02, video.duration - 0.05));
    await new Promise((r) => {
      video.onseeked = () => r(null);
      setTimeout(() => r(null), 4000);
    });

    const targetW = 1080;
    const targetH = Math.round(targetW / ratio);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, targetW, targetH);

    const vw = video.videoWidth || 720;
    const vh = video.videoHeight || 1280;
    const scale = Math.max(targetW / vw, targetH / vh);
    const drawW = vw * scale;
    const drawH = vh * scale;
    ctx.drawImage(video, (targetW - drawW) / 2, (targetH - drawH) / 2, drawW, drawH);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar o quadro."))),
        "image/jpeg",
        0.92,
      ),
    );
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
}

/**
 * Re-renderiza o vídeo de referência no navegador (sem ffmpeg.wasm, para não
 * baixar ~30 MB). Serve para:
 *   - recortar/reenquadrar na proporção escolhida (9:16, 16:9, ...);
 *   - remover a trilha de áudio (keepAudio = false).
 * Retorna `null` se o navegador não suportar MediaRecorder.
 */
export async function renderVideo(
  file: File,
  options: {
    ratio: number;
    keepAudio: boolean;
    /** corta o vídeo neste instante (ex.: limite de 30s do modelo) */
    maxDuration?: number;
    /** "contain" preserva o corpo inteiro (barras) · "cover" preenche (recorta) */
    fit?: "cover" | "contain";
    onProgress: (percent: number) => void;
  },
): Promise<{ blob: Blob; extension: string } | null> {
  const { ratio, keepAudio, maxDuration, fit = "cover", onProgress } = options;
  if (typeof MediaRecorder === "undefined") return null;
  const preferred = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) return null;

  const { video, url } = await loadVideo(file);
  let audioContext: AudioContext | null = null;
  try {
    const width = 1280;
    const height = Math.round((width * 1) / ratio);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(30);

    if (keepAudio) {
      try {
        audioContext = new AudioContext();
        await audioContext.resume();
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        // A fonte passa a ir só para o gravador: nada de áudio nas caixas.
        source.connect(destination);
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
        video.muted = false;
      } catch {
        audioContext = null;
      }
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 6_000_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const finished = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
    });

    recorder.start(250);
    if (!keepAudio) video.muted = true;
    video.currentTime = 0;
    await video.play();

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const stopAt = Math.min(duration, maxDuration ?? duration);
    await new Promise<void>((resolve) => {
      let raf = 0;
      const draw = () => {
        const vw = video.videoWidth || 720;
        const vh = video.videoHeight || 1280;
        const scale =
          fit === "contain"
            ? Math.min(width / vw, height / vh)
            : Math.max(width / vw, height / vh);
        const drawW = vw * scale;
        const drawH = vh * scale;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(video, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
        if (duration > 0) onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
        if (video.ended || (stopAt > 0 && video.currentTime >= stopAt)) {
          resolve();
          return;
        }
        raf = requestAnimationFrame(draw);
      };
      video.onended = () => {
        cancelAnimationFrame(raf);
        resolve();
      };
      draw();
    });

    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
    const blob = await finished;
    if (!blob.size) return null;
    return { blob, extension: mimeType.includes("mp4") ? "mp4" : "webm" };
  } catch {
    return null;
  } finally {
    audioContext?.close().catch(() => undefined);
    video.src = "";
    URL.revokeObjectURL(url);
  }
}

/** Extrai as cores dominantes do poster do vídeo para personalizar a interface. */
export async function dominantColors(source: string): Promise<string[]> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = source;
    await new Promise((resolve, reject) => {
      image.onload = () => resolve(null);
      image.onerror = () => reject(new Error("erro"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0, 48, 48);
    const { data } = ctx.getImageData(0, 0, 48, 48);
    const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`;
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
      buckets.set(key, bucket);
    }
    return [...buckets.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 4)
      .map(({ r, g, b, n }) => `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`);
  } catch {
    return [];
  }
}
