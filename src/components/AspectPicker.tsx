import { ASPECTS, type AspectId } from "../lib/media.ts";

function Shape({ ratio, active }: { ratio: number; active: boolean }) {
  const max = 26;
  const width = ratio >= 1 ? max : Math.max(10, max * ratio);
  const height = ratio >= 1 ? Math.max(10, max / ratio) : max;
  return (
    <span
      className={`block rounded-[4px] border-2 transition ${active ? "border-violet-300 bg-violet-300/20" : "border-zinc-500"}`}
      style={{ width: (width / max) * 30, height: (height / max) * 30 }}
    />
  );
}

export function AspectPicker({
  value,
  onChange,
  effectiveRatio,
  sourceRatio,
}: {
  value: AspectId;
  onChange: (value: AspectId) => void;
  effectiveRatio: number;
  sourceRatio: number | null;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {ASPECTS.map((aspect) => {
        const active = aspect.id === value;
        const ratio = aspect.ratio ?? sourceRatio ?? 9 / 16;
        return (
          <button
            key={aspect.id}
            type="button"
            onClick={() => onChange(aspect.id)}
            className={`flex flex-col items-center gap-2 rounded-xl border px-1 py-2.5 transition ${
              active
                ? "border-violet-400/70 bg-violet-500/15"
                : "border-white/10 bg-white/[0.03] hover:border-white/25"
            }`}
            title={aspect.hint}
          >
            <span className="grid h-8 place-items-center">
              <Shape ratio={ratio} active={active} />
            </span>
            <span className={`text-[11px] font-semibold ${active ? "text-white" : "text-zinc-400"}`}>
              {aspect.label}
            </span>
          </button>
        );
      })}
      <p className="col-span-5 text-[11px] leading-relaxed text-zinc-500">
        {ASPECTS.find((aspect) => aspect.id === value)?.hint} · enquadramento final{" "}
        {value === "original"
          ? `segue o vídeo (${effectiveRatio.toFixed(2).replace(".", ",")}:1)`
          : `${value.replace(":", ":")}`}
      </p>
    </div>
  );
}
