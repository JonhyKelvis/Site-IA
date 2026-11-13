import type { JobRecord } from "../lib/history.ts";
import { formatDateTime } from "../lib/format.ts";
import { IconPlay } from "./icons.tsx";

export function ProjectPanel({
  jobs,
  onSelect,
  onClear,
  activeId,
}: {
  jobs: JobRecord[];
  onSelect: (job: JobRecord) => void;
  onClear: () => void;
  activeId: string | null;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Fila do estúdio</p>
        {jobs.length > 0 && (
          <button onClick={onClear} className="text-[11px] font-medium text-zinc-500 hover:text-rose-300">
            limpar progresso
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[11px] leading-relaxed text-zinc-500">
          Nenhum vídeo gerado ainda.
          <br />
          Só esta sessão do navegador guarda o histórico — por privacidade, nada é salvo no servidor.
        </div>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => {
            const active = job.id === activeId;
            const statusColor =
              job.stage === "done"
                ? "text-emerald-300"
                : job.stage === "error"
                  ? "text-rose-300"
                  : "text-violet-300";
            return (
              <li key={job.id}>
                <button
                  onClick={() => onSelect(job)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition ${
                    active
                      ? "border-violet-400/50 bg-violet-500/10"
                      : "border-white/8 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black">
                    {job.thumbUrl ? (
                      <img src={job.thumbUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-zinc-600">
                        <IconPlay className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                      <span className={statusColor}>{job.aspect}</span>
                      <span className="text-zinc-600">·</span>
                      <span className="truncate text-zinc-400">{job.modelLabel}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                      {job.stage === "done"
                        ? formatDateTime(job.createdAt)
                        : job.stage === "error"
                          ? job.error ?? "falhou"
                          : "em andamento…"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
