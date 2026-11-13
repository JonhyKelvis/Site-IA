import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes, formatClock } from "../lib/format.ts";
import type { VideoInfo } from "../lib/media.ts";
import { IconClose, IconFilm, IconPlay, IconTrash } from "./icons.tsx";

const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

export function VideoDropzone({
  file,
  info,
  maxSeconds,
  onFile,
  onClear,
}: {
  file: File | null;
  info: VideoInfo | null;
  maxSeconds: number;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const candidate = files?.[0];
      if (!candidate) return;
      if (!VIDEO_TYPES.includes(candidate.type) && !candidate.type.startsWith("video/")) {
        setError("Formato não suportado. Converta para MP4 (H.264) ou MOV.");
        return;
      }
      setError(null);
      onFile(candidate);
    },
    [onFile],
  );

  if (file && info && objectUrl) {
    const tooLong = info.duration > maxSeconds + 0.5;
    const fps = info.estimatedFps;

    return (
      <div className="overflow-hidden rounded-2xl border border-white/12 bg-ink-900/70">
        <div className="relative aspect-video w-full bg-black">
          <video
            src={objectUrl}
            className="h-full w-full object-contain"
            controls
            playsInline
            preload="metadata"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/8 px-3 py-2.5">
          <span className="chip border-emerald-400/30! bg-emerald-400/10! text-emerald-200!">
            <IconFilm className="h-3.5 w-3.5" />
            {formatClock(info.duration)}
          </span>
          <span className="chip">
            {info.width}×{info.height}
          </span>
          {fps && <span className="chip">≈{fps} fps</span>}
          <span className="chip">{formatBytes(file.size)}</span>
          <button
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-rose-300"
          >
            <IconTrash className="h-3.5 w-3.5" />
            Trocar
          </button>
        </div>

        {tooLong && (
          <p className="border-t border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
            O vídeo tem {formatClock(info.duration)} e o modelo escolhido aceita até{" "}
            {formatClock(maxSeconds)}. Vou cortar automaticamente no envio.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-5 py-10 text-center transition ${
          dragging
            ? "border-violet-400/80 bg-violet-500/10"
            : "border-white/15 bg-white/[0.02] hover:border-violet-400/50 hover:bg-white/[0.05]"
        }`}
      >
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/25 to-cyan-400/20 text-violet-100 transition group-hover:scale-105">
          <IconPlay className="h-6 w-6" />
          <span className="absolute inset-0 rounded-2xl pulse-ring" />
        </span>
        <span className="text-sm font-semibold text-white">Arraste o vídeo de referência</span>
        <span className="max-w-sm text-xs leading-relaxed text-zinc-400">
          É o vídeo que tem o movimento que você quer copiar. MP4 (H.264) ou MOV, até{" "}
          <b className="text-zinc-200">200 MB</b>.
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-zinc-300">
          Escolher vídeo do celular ou computador
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-rose-300">
          <IconClose className="mt-0.5 h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}
