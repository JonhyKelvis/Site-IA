import { useState } from "react";
import { login } from "../lib/api.ts";
import { IconLock, IconSpinner } from "./icons.tsx";

export function AccessGate({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(code.trim());
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? "Código incorreto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/30 to-cyan-400/20 text-violet-100">
          <IconLock className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-white">Área privada</h1>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          Este estúdio pede um código de acesso para proteger os créditos de geração.
        </p>
        <label className="label mt-5" htmlFor="code">
          Código de acesso
        </label>
        <input
          id="code"
          className="field"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="••••••••"
          autoFocus
        />
        {error && <p className="mt-2 text-xs font-medium text-rose-300">{error}</p>}
        <button type="submit" className="btn-primary mt-4 w-full" disabled={loading || !code.trim()}>
          {loading && <IconSpinner className="h-4 w-4" />}
          Entrar
        </button>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
          O código é definido na variável <code className="text-zinc-400">SITE_ACCESS_CODE</code>. Deixe-a
          vazia para o site ficar aberto.
        </p>
      </form>
    </div>
  );
}
