import { IconClose } from "./icons.tsx";

export function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/12 bg-ink-900 p-5 sm:rounded-3xl sm:p-7">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Como funciona o MotionLab</h2>
            <p className="mt-1 text-sm text-zinc-400">Três passos para transformar sua imagem em vídeo.</p>
          </div>
          <button onClick={onClose} className="btn-ghost !px-2 !py-2" aria-label="Fechar">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <ol className="space-y-4 text-sm leading-relaxed text-zinc-300">
          <li>
            <b className="text-white">1. Vídeo de referência.</b> É de onde vem o movimento: uma dança, uma
            fala, uma caminhada. Use de 2 a 30 segundos (no Kling) ou até 2 minutos (no Wan 2.2 Animate).
            Prefira uma pessoa de corpo inteiro ou meio corpo, sem nada na frente.
          </li>
          <li>
            <b className="text-white">2. Imagem de referência.</b> É o personagem que vai aparecer no
            resultado. Use o rosto visível e, de preferência, o corpo inteiro. Fotos, ilustrações e
            personagens 3D funcionam.
          </li>
          <li>
            <b className="text-white">3. Escolha 9:16 ou 16:9 e gere.</b> O vídeo é renderizado na nuvem e
            aparece aqui com botão de download.
          </li>
        </ol>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Orientação</p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              <b className="text-zinc-200">Seguir o vídeo</b>: o resultado tem a mesma proporção do vídeo de
              referência e lida melhor com movimentos corporais.{" "}
              <b className="text-zinc-200">Seguir a imagem</b>: o resultado tem a proporção da imagem e é
              melhor quando o movimento é de câmera.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Áudio original</p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              Você pode manter o som do vídeo de referência ou gerar silencioso. Alguns modelos (Wan) não
              carregam o áudio — nesse caso o vídeo sai sem som.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Dicas de qualidade</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-100/90">
            <li>Melhor luz e foco nos dois arquivos: evite fotos escuras ou tremidas.</li>
            <li>Uma pessoa só na cena — o modelo escolhe a maior pessoa do quadro.</li>
            <li>Vídeos com o corpo inteiro visível dão resultados melhores.</li>
            <li>Se o resultado cortar a cabeça, tente a orientação “Seguir a imagem”.</li>
          </ul>
        </div>

        <button onClick={onClose} className="btn-primary mt-5 w-full">
          Entendi
        </button>
      </div>
    </div>
  );
}
