import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "../lib/format.ts";
import { IconImage, IconTrash } from "./icons.tsx";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export function ImageDropzone({
  file,
  onFile,
  onClear,
}: {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const candidate = files?.[0];
      if (!candidate) return;
      if (!IMAGE_TYPES.includes(candidate.type) && !candidate.type.startsWith("image/")) {
        setError("Formato não suportado. Use JPG, PNG ou WEBP.");
        return;
      }
      setError(null);
      onFile(candidate);
    },
    [onFile],
  );

  if (file && preview) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-ink-900/70">
        <div className="relative w-full bg-black/60">
          <img src={preview} alt="Imagem de referência" className="max-h-[260px] w-full object-contain" />
        </div>
        <div className="flex items-center gap-2 border-t border-white/8 px-3 py-2">
          <span className="chip">{formatBytes(file.size)}</span>
          <span className="truncate text-[11px] text-zinc-500">{file.name}</span>
          <button
            onClick={onClear}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-rose-300"
          >
            <IconTrash className="h-3.5 w-3.5" />
            Trocar
          </button>
        </div>
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
        className={`group flex w-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed px-5 py-8 text-center transition ${
          dragging
            ? "border-cyan-300/80 bg-cyan-400/10"
            : "border-white/15 bg-white/[0.02] hover:border-cyan-300/50 hover:bg-white/[0.05]"
        }`}
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-400/25 to-fuchsia-400/20 text-cyan-100 transition group-hover:scale-105">
          <IconImage className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold text-white">Arraste a imagem de referência</span>
        <span className="max-w-xs text-xs leading-relaxed text-zinc-400">
          É o personagem/rosto que vai aparecer no vídeo. De preferência de corpo inteiro ou meio corpo,
          com o rosto visível. JPG, PNG ou WEBP até <b className="text-zinc-200">15 MB</b>.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-xs font-medium text-rose-300">{error}</p>}
    </div>
  );
}
