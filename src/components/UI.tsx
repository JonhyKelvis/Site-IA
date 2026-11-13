import type { ReactNode } from "react";
import { IconClose, IconSpinner } from "./icons.tsx";

/* ---------------------------------------------------------------- */
/* Toast                                                             */
/* ---------------------------------------------------------------- */

export type Toast = { id: number; message: string; tone: "error" | "success" | "info" };

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${
            toast.tone === "error"
              ? "border-rose-400/40 bg-rose-950/80 text-rose-100"
              : toast.tone === "success"
                ? "border-emerald-400/40 bg-emerald-950/80 text-emerald-100"
                : "border-white/15 bg-ink-800/90 text-zinc-100"
          }`}
        >
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="mt-0.5 shrink-0 rounded-md p-0.5 text-white/60 transition hover:text-white"
            aria-label="Fechar aviso"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Section                                                           */
/* ---------------------------------------------------------------- */

export function SectionHeader({
  step,
  title,
  description,
  right,
}: {
  step: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/[0.06] text-xs font-bold text-violet-200">
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white sm:text-lg">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-zinc-400">{description}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Segmented control                                                 */
/* ---------------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: { id: T; label: string; hint?: string; sub?: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.id === value;
        const disabled = Boolean(option.disabled);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`group relative rounded-2xl border p-3 text-left transition ${
              disabled ? "cursor-not-allowed opacity-40" : ""
            } ${
              active
                ? "border-violet-400/60 bg-violet-500/15 shadow-[0_0_0_1px_rgba(167,139,250,0.5),0_18px_40px_-24px_rgba(139,92,246,0.9)]"
                : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-semibold ${active ? "text-white" : "text-zinc-200"}`}>
                {option.label}
              </span>
              {active && <span className="h-2 w-2 rounded-full bg-violet-300" />}
            </div>
            {option.sub && (
              <div className={`mt-0.5 text-[11px] font-medium ${active ? "text-violet-200" : "text-zinc-500"}`}>
                {option.sub}
              </div>
            )}
            {option.hint && <div className="mt-1 text-[11px] leading-snug text-zinc-500">{option.hint}</div>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Progress                                                          */
/* ---------------------------------------------------------------- */

export function ProgressBar({
  percent,
  label,
  detail,
  indeterminate,
}: {
  percent?: number;
  label?: string;
  detail?: string;
  indeterminate?: boolean;
}) {
  return (
    <div className="w-full">
      {(label || detail) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="font-medium text-zinc-300">{label}</span>
          <span className="tabular-nums text-zinc-500">{detail}</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 transition-[width] duration-300 ${
            indeterminate ? "shimmer w-2/3" : ""
          }`}
          style={indeterminate ? undefined : { width: `${Math.max(2, Math.min(100, percent ?? 0))}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Steps da geração                                                  */
/* ---------------------------------------------------------------- */

export function GenerationSteps({
  stage,
}: {
  stage: "idle" | "uploading" | "queueing" | "processing" | "done" | "error";
}) {
  const steps = [
    { id: "uploading", label: "Envio dos arquivos" },
    { id: "queueing", label: "Na fila da IA" },
    { id: "processing", label: "Renderizando o vídeo" },
    { id: "done", label: "Pronto" },
  ] as const;
  const order = ["uploading", "queueing", "processing", "done"];
  const currentIndex = order.indexOf(stage);

  return (
    <ol className="space-y-2.5">
      {steps.map((step, index) => {
        const done = currentIndex > index;
        const active = currentIndex === index;
        return (
          <li key={step.id} className="flex items-center gap-3 text-sm">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                done
                  ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300"
                  : active
                    ? "border-violet-400/60 bg-violet-400/15 text-violet-200"
                    : "border-white/10 bg-white/[0.03] text-zinc-500"
              }`}
            >
              {done ? "✓" : active ? <IconSpinner className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={active ? "font-medium text-white" : done ? "text-zinc-300" : "text-zinc-500"}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
