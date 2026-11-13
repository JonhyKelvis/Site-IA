import { IconBolt, IconGithub } from "./icons.tsx";

export function Header({ onOpenGuide }: { onOpenGuide: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-lg shadow-fuchsia-500/25">
            <IconBolt className="h-5 w-5 text-white" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight text-white">
              Motion<span className="gradient-text">Lab</span>
            </p>
            <p className="hidden text-[11px] text-zinc-500 sm:block">motion control 9:16 · 16:9</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <button onClick={onOpenGuide} className="btn-ghost !py-2 text-xs sm:text-sm">
            Como funciona
          </button>
          <a
            href="https://github.com/JonhyKelvis/Site-IA"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost !px-2.5 !py-2"
            aria-label="Repositório no GitHub"
          >
            <IconGithub className="h-4 w-4" />
          </a>
        </nav>
      </div>
    </header>
  );
}
