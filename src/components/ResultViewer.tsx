import { downloadUrl } from "../lib/api.ts";
import { IconDownload } from "./icons.tsx";

export function ResultViewer({ videoUrl, aspect }: { videoUrl: string; aspect: string }) {
  const vertical = aspect === "9:16" || aspect === "4:5";

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_40px_100px_-50px_rgba(139,92,246,0.9)] ${
          vertical ? "max-h-[70vh] w-full max-w-[360px]" : "w-full"
        }`}
        style={{ aspectRatio: aspect === "16:9" ? "16 / 9" : aspect === "1:1" ? "1 / 1" : vertical ? "9 / 16" : undefined }}
      >
        <video
          src={videoUrl}
          controls
          playsInline
          className="h-full w-full object-contain"
          poster=""
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <a href={downloadUrl(videoUrl)} className="btn-primary" download="motionlab.mp4">
          <IconDownload className="h-4 w-4" />
          Baixar vídeo
        </a>
        <a href={videoUrl} target="_blank" rel="noreferrer" className="btn-ghost">
          Abrir em nova aba
        </a>
      </div>
      <p className="text-center text-[11px] leading-relaxed text-zinc-500">
        O link do vídeo gerado pela IA expira com o tempo. Baixe agora para guardar na sua galeria.
      </p>
    </div>
  );
}
