import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  downloadUrl,
  fetchSession,
  fetchStatus,
  startRun,
  uploadMedia,
  type ModelInfo,
  type SessionInfo,
} from "./lib/api.ts";
import {
  ASPECTS,
  dominantColors,
  probeVideo,
  renderVideo,
  type AspectId,
  type VideoInfo,
} from "./lib/media.ts";
import { formatClock, formatMoney } from "./lib/format.ts";
import { loadJobs, saveJobs, type JobRecord, type JobStage } from "./lib/history.ts";
import { Header } from "./components/Header.tsx";
import { GuideModal } from "./components/GuideModal.tsx";
import { AccessGate } from "./components/AccessGate.tsx";
import { VideoDropzone } from "./components/VideoDropzone.tsx";
import { ImageDropzone } from "./components/ImageDropzone.tsx";
import { AspectPicker } from "./components/AspectPicker.tsx";
import { ProjectPanel } from "./components/ProjectPanel.tsx";
import { ResultViewer } from "./components/ResultViewer.tsx";
import {
  GenerationSteps,
  ProgressBar,
  SectionHeader,
  Segmented,
  ToastStack,
  type Toast,
} from "./components/UI.tsx";
import {
  IconBolt,
  IconCheck,
  IconDownload,
  IconGithub,
  IconInfo,
  IconSpinner,
} from "./components/icons.tsx";

const FALLBACK_MODELS: ModelInfo[] = [
  { id: "kling-pro", label: "Kling 3.0 Pro", maxSeconds: 30, pricePerSecond: 0.168 },
  { id: "kling-standard", label: "Kling 3.0 Standard", maxSeconds: 30, pricePerSecond: 0.126 },
  { id: "wan-animate", label: "Wan 2.2 Animate", maxSeconds: 120, pricePerSecond: 0.154 },
];

/** Cria (e libera) uma URL de preview para um File. */
function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

export default function App() {
  const [guideOpen, setGuideOpen] = useState(false);

  /* -------------------------------------------------------------- */
  /* sessão / modelos                                               */
  /* -------------------------------------------------------------- */
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [needsCode, setNeedsCode] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>(FALLBACK_MODELS);

  /** Não recarrega a sessão quando a pessoa volta ao site (evita piscar o login). */
  const refetchOnReturnRef = useRef(true);

  const loadSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      const info = await fetchSession();
      setSession(info);
      setNeedsCode(Boolean(info.needCode));
      if (!info.needCode) refetchOnReturnRef.current = Boolean(info.accessRequired);
      if (info.models.length) setModels(info.models);
    } catch {
      setSession({ accessRequired: false, needCode: false, models: FALLBACK_MODELS });
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && refetchOnReturnRef.current) void loadSession();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadSession]);

  /* -------------------------------------------------------------- */
  /* entradas                                                        */
  /* -------------------------------------------------------------- */
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const imagePreviewUrl = useObjectUrl(imageFile);

  /* -------------------------------------------------------------- */
  /* configurações                                                   */
  /* -------------------------------------------------------------- */
  const [modelId, setModelId] = useState<string>("kling-pro");
  const [aspect, setAspect] = useState<AspectId>("9:16");
  const [orientation, setOrientation] = useState<"video" | "image">("video");
  const [keepSound, setKeepSound] = useState(true);
  const [refine, setRefine] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [resolution, setResolution] = useState<"720p" | "480p">("720p");

  const model = useMemo(
    () => models.find((item) => item.id === modelId) ?? models[0] ?? FALLBACK_MODELS[0],
    [models, modelId],
  );
  const isWan = model.id === "wan-animate";
  // Kling com orientação "seguir imagem" aceita no máximo 10s de referência
  const effectiveMax =
    isWan ? model.maxSeconds : orientation === "image" ? Math.min(10, model.maxSeconds) : model.maxSeconds;

  /* -------------------------------------------------------------- */
  /* estado de geração                                               */
  /* -------------------------------------------------------------- */
  const [stage, setStage] = useState<JobStage>("uploading");
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressDetail, setProgressDetail] = useState("");
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [currentAspect, setCurrentAspect] = useState<string>("9:16");
  const [jobs, setJobs] = useState<JobRecord[]>(() => loadJobs());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pollRef = useRef<number | null>(null);

  useEffect(() => saveJobs(jobs), [jobs]);


  const notify = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, tone === "error" ? 9000 : 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const patchJob = useCallback((id: string, patch: Partial<JobRecord>) => {
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  }, []);

  /* -------------------------------------------------------------- */
  /* métricas derivadas                                              */
  /* -------------------------------------------------------------- */
  const effectiveRatio = useMemo(() => {
    if (aspect === "original") return videoInfo?.aspectRatio ?? 9 / 16;
    return ASPECTS.find((item) => item.id === aspect)?.ratio ?? 9 / 16;
  }, [aspect, videoInfo]);

  const durationUsed = useMemo(() => {
    const reference = videoInfo?.duration ?? 0;
    if (!reference) return 0;
    return Math.min(reference, effectiveMax);
  }, [videoInfo, effectiveMax]);

  const estimatedCost = useMemo(() => {
    if (!durationUsed) return 0;
    return Math.ceil(durationUsed) * model.pricePerSecond;
  }, [durationUsed, model.pricePerSecond]);

  const canGenerate = Boolean(videoFile && imageFile && !busy && !analyzing);

  /* -------------------------------------------------------------- */
  /* handlers de arquivo                                             */
  /* -------------------------------------------------------------- */
  const handleVideoFile = useCallback(
    async (file: File) => {
      setVideoFile(file);
      setVideoInfo(null);
      setVideoError(null);
      setAnalyzing(true);
      try {
        const info = await probeVideo(file);
        if (!info.duration || !info.width) {
          throw new Error(
            "Não consegui ler a duração deste vídeo. Converta para MP4 (H.264) e tente de novo.",
          );
        }
        setVideoInfo(info);
        const colors = await dominantColors(info.posterUrl);
        if (colors[0]) document.documentElement.style.setProperty("--accent", colors[0]);
      } catch (error: any) {
        setVideoError(error?.message ?? "Erro ao ler o vídeo.");
      } finally {
        setAnalyzing(false);
      }
    },
    [],
  );

  /* -------------------------------------------------------------- */
  /* polling                                                         */
  /* -------------------------------------------------------------- */
  const startPolling = useCallback(
    (job: JobRecord) => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      const tick = async () => {
        try {
          const status = await fetchStatus(job.model, job.requestId!);
          if (status.status === "COMPLETED" && status.videoUrl) {
            window.clearInterval(pollRef.current!);
            pollRef.current = null;
            setStage("done");
            setBusy(false);
            setProgressPercent(100);
            setProgressLabel("Vídeo pronto!");
            setProgressDetail("");
            setCurrentVideo(status.videoUrl);
            setCurrentAspect(job.aspect);
            setActiveJobId(job.id);
            patchJob(job.id, { stage: "done", progress: 100, videoUrl: status.videoUrl });
            notify("Vídeo gerado com sucesso 🎬", "success");
            return;
          }
          if (status.status === "ERROR" || status.status === "FAILED") {
            window.clearInterval(pollRef.current!);
            pollRef.current = null;
            setStage("error");
            setBusy(false);
            const message = status.error ?? "A geração falhou.";
            patchJob(job.id, { stage: "error", error: message });
            notify(`Falha na geração: ${message}`, "error");
            return;
          }
          if (status.status === "IN_QUEUE") {
            setStage("queueing");
            setProgressLabel("Na fila da IA…");
            setProgressDetail(
              status.queuePosition ? `posição ${status.queuePosition}` : "aguardando um servidor",
            );
            patchJob(job.id, { stage: "queueing", queuePosition: status.queuePosition ?? null });
          } else {
            setStage("processing");
            setProgressPercent((percent) => Math.min(92, percent + 2));
            setProgressLabel("Renderizando seu vídeo…");
            setProgressDetail(status.logs?.[status.logs.length - 1] ?? "isso pode levar alguns minutos");
            patchJob(job.id, { stage: "processing" });
          }
        } catch (error: any) {
          if (error instanceof ApiError && (error.status === 401 || error.status === 500)) {
            window.clearInterval(pollRef.current!);
            pollRef.current = null;
            setBusy(false);
            setStage("error");
            notify(error.message, "error");
          }
          // erros de rede: continua tentando no próximo ciclo
        }
      };
      void tick();
      pollRef.current = window.setInterval(tick, 4000);
    },
    [notify, patchJob],
  );

  /* retoma um job em andamento depois de recarregar a página (?job=...) */
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || sessionLoading || needsCode) return;
    const jobId = new URLSearchParams(window.location.search).get("job");
    if (!jobId) return;
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
    resumedRef.current = true;
    setActiveJobId(job.id);
    if (job.stage === "done" && job.videoUrl) {
      setCurrentVideo(job.videoUrl);
      setCurrentAspect(job.aspect);
    } else if (job.requestId && (job.stage === "queueing" || job.stage === "processing")) {
      setBusy(true);
      setStage(job.stage);
      startPolling(job);
    }
  }, [jobs, needsCode, sessionLoading, startPolling]);

  /* -------------------------------------------------------------- */
  /* gerar                                                           */
  /* -------------------------------------------------------------- */
  const handleGenerate = async () => {
    if (!videoFile || !imageFile || !videoInfo) return;
    setBusy(true);
    setCurrentVideo(null);
    setStage("uploading");
    setProgressPercent(0);
    setProgressLabel("Enviando arquivos…");
    setProgressDetail("");

    const jobId = `job_${Date.now()}`;

    const record: JobRecord = {
      id: jobId,
      createdAt: Date.now(),
      model: model.id,
      modelLabel: model.label,
      aspect: aspect === "original" ? "Original" : aspect,
      stage: "uploading",
      progress: 0,
      thumbUrl: videoInfo.posterUrl || null,
      videoUrl: null,
      duration: durationUsed,
    };
    setJobs((current) => [record, ...current].slice(0, 12));
    setActiveJobId(jobId);
    window.history.replaceState({}, "", `${window.location.pathname}?job=${jobId}`);

    try {
      /* 1. prepara o vídeo de referência (corte de duração / reenquadramento / áudio) */
      let videoToUpload: File = videoFile;
      const needsTrim = videoInfo.duration > effectiveMax + 0.05;
      // só reenquadra se a proporção da referência estiver realmente diferente
      const needsReframe =
        aspect !== "original" && Math.abs(videoInfo.aspectRatio - effectiveRatio) > 0.02;
      const needToStripAudio = !keepSound && !isWan;

      if (needsTrim || needsReframe || needToStripAudio) {
        setProgressLabel("Otimizando o vídeo de referência…");
        setProgressPercent(0);
        const rendered = await renderVideo(videoFile, {
          ratio: effectiveRatio,
          keepAudio: keepSound && !isWan,
          maxDuration: needsTrim ? effectiveMax : undefined,
          onProgress: (percent) => {
            setProgressPercent(percent);
            setProgressDetail(`${percent}% — feito no seu navegador`);
          },
        });
        if (rendered) {
          videoToUpload = new File([rendered.blob], `referencia.${rendered.extension}`, {
            type: rendered.blob.type,
          });
        } else if (needsTrim) {
          notify(
            "Seu navegador não permitiu cortar o vídeo. Vou enviar do mesmo jeito — o modelo usa os primeiros segundos.",
            "info",
          );
        }
      }

      /* 2. upload direto para o CDN (até 200 MB, sem passar pela Vercel) */
      setStage("uploading");
      setProgressLabel("Enviando o vídeo de referência…");
      setProgressPercent(0);

      const [videoUrl, imageUrl] = await Promise.all([
        uploadMedia(videoToUpload, "video", ({ percent, loaded, total }) => {
          setProgressPercent(percent);
          setProgressDetail(`${percent}% · ${(loaded / 1048576).toFixed(1)} de ${(total / 1048576).toFixed(1)} MB`);
        }),
        uploadMedia(imageFile, "image", () => undefined),
      ]);

      /* 3. dispara a geração */
      setStage("queueing");
      setProgressLabel("Entrando na fila…");
      setProgressPercent(100);
      setProgressDetail("");

      const { requestId } = await startRun({
        model: model.id,
        imageUrl,
        videoUrl,
        characterOrientation: isWan ? "video" : orientation,
        keepOriginalSound: keepSound,
        prompt: refine && customPrompt.trim() ? customPrompt.trim() : undefined,
        resolution,
        duration: durationUsed,
      });

      patchJob(jobId, {
        requestId,
        stage: "queueing",
        aspect: aspect === "original" ? "Original" : aspect,
        params: {
          keepOriginalSound: keepSound,
          characterOrientation: isWan ? "video" : orientation,
        },
      });
      startPolling({ ...record, requestId });
    } catch (error: any) {
      setStage("error");
      setBusy(false);
      const message = error?.message ?? "Erro inesperado ao gerar o vídeo.";
      patchJob(jobId, { stage: "error", error: message });
      notify(message, "error");
    }
  };

  /* -------------------------------------------------------------- */
  /* render                                                          */
  /* -------------------------------------------------------------- */
  const showGate = !sessionLoading && needsCode;

  return (
    <div className="min-h-full">
      <Header onOpenGuide={() => setGuideOpen(true)} />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      {sessionLoading ? (
        <div className="grid min-h-[60vh] place-items-center">
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <IconSpinner className="h-5 w-5" /> Carregando estúdio…
          </div>
        </div>
      ) : showGate ? (
        <AccessGate
          onSuccess={() => {
            setNeedsCode(false);
            void loadSession();
          }}
        />
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {/* hero */}
          <section className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="chip mb-3 !border-violet-400/30 !bg-violet-500/10 !text-violet-200">
                <IconBolt className="h-3.5 w-3.5" />
                Kling 3.0 Motion Control · até {Math.max(...models.map((item) => item.maxSeconds))}s
              </span>
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
                Seu personagem, <span className="gradient-text">no movimento do vídeo</span>.
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                Suba um vídeo de referência (o movimento) e uma imagem de referência (o personagem). A IA
                transfere a performance para a sua imagem — em 9:16, 16:9 ou na proporção que quiser.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">até</p>
                <p className="text-lg font-bold text-white">200 MB</p>
                <p className="text-[10px] text-zinc-500">por vídeo</p>
              </div>
              <span className="h-9 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">até</p>
                <p className="text-lg font-bold text-white">{effectiveMax}s</p>
                <p className="text-[10px] text-zinc-500">de geração</p>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* coluna esquerda */}
            <div className="space-y-5">
              <section className="card p-4 sm:p-5">
                <SectionHeader
                  step="1"
                  title="Vídeo de referência"
                  description="O vídeo que tem o movimento que você quer copiar (dança, fala, gestos, câmera)."
                  right={
                    videoInfo ? (
                      <span className="chip !border-emerald-400/30 !bg-emerald-400/10 !text-emerald-200">
                        <IconCheck className="h-3.5 w-3.5" /> pronto
                      </span>
                    ) : undefined
                  }
                />
                <VideoDropzone
                  file={videoFile}
                  info={videoInfo}
                  maxSeconds={effectiveMax}
                  onFile={handleVideoFile}
                  onClear={() => {
                    setVideoFile(null);
                    setVideoInfo(null);
                    setVideoError(null);
                  }}
                />
                {analyzing && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                    <IconSpinner className="h-3.5 w-3.5" /> analisando o vídeo…
                  </p>
                )}
                {videoError && <p className="mt-2 text-xs font-medium text-rose-300">{videoError}</p>}
              </section>

              <section className="card p-4 sm:p-5">
                <SectionHeader
                  step="2"
                  title="Imagem de referência"
                  description="O personagem que vai aparecer no vídeo. Rosto visível, corpo inteiro ou meio corpo."
                  right={
                    imageFile ? (
                      <span className="chip !border-emerald-400/30 !bg-emerald-400/10 !text-emerald-200">
                        <IconCheck className="h-3.5 w-3.5" /> pronta
                      </span>
                    ) : undefined
                  }
                />
                <ImageDropzone
                  file={imageFile}
                  onFile={setImageFile}
                  onClear={() => setImageFile(null)}
                />
              </section>

              <section className="card p-4 sm:p-5">
                <SectionHeader
                  step="3"
                  title="Formato e modelo"
                  description="Escolha a proporção final e o motor de geração."
                />
                <AspectPicker
                  value={aspect}
                  onChange={setAspect}
                  effectiveRatio={effectiveRatio}
                  sourceRatio={videoInfo?.aspectRatio ?? null}
                />

                <div className="mt-5">
                  <span className="label">Modelo</span>
                  <Segmented
                    value={modelId}
                    onChange={(id) => setModelId(id)}
                    options={models.map((item) => ({
                      id: item.id,
                      label: item.label,
                      sub: `até ${item.maxSeconds}s`,
                      hint:
                        item.id === "wan-animate"
                          ? `${formatMoney(item.pricePerSecond)}/s · movimento + expressões`
                          : `${formatMoney(item.pricePerSecond)}/s · ${
                              item.id === "kling-pro" ? "máxima qualidade" : "mais econômico"
                            }`,
                    }))}
                  />
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="label">Orientação do resultado</span>
                    {isWan ? (
                      <p className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-400">
                        O Wan 2.2 Animate sempre segue a proporção do vídeo de referência (por isso o vídeo é
                        reenquadrado antes do envio).
                      </p>
                    ) : (
                      <Segmented
                        value={orientation}
                        onChange={setOrientation}
                        options={[
                          { id: "video", label: "Seguir vídeo", hint: "movimentos complexos · até 30s" },
                          { id: "image", label: "Seguir imagem", hint: "movimento de câmera · até 10s" },
                        ]}
                        columns={2}
                      />
                    )}
                  </div>

                  <div>
                    <span className="label">Áudio</span>
                    <Segmented
                      value={isWan ? "off" : keepSound ? "on" : "off"}
                      onChange={(value) => setKeepSound(value === "on")}
                      options={[
                        { id: "on", label: "Manter áudio", hint: "som original da referência" },
                        { id: "off", label: "Sem áudio", hint: "vídeo silencioso" },
                      ]}
                      columns={2}
                    />
                    {(isWan || (!keepSound && videoInfo)) && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
                        {isWan
                          ? "O Wan 2.2 Animate não devolve o áudio da referência."
                          : "Vou remover a trilha de áudio no seu navegador antes de enviar."}
                      </p>
                    )}
                  </div>
                </div>

                {isWan && (
                  <div className="mt-4">
                    <span className="label">Qualidade</span>
                    <Segmented
                      value={resolution}
                      onChange={setResolution}
                      options={[
                        { id: "720p", label: "720p", hint: "melhor qualidade" },
                        { id: "480p", label: "480p", hint: "mais rápido/barato" },
                      ]}
                      columns={2}
                    />
                  </div>
                )}

                <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-3.5">
                  <button
                    type="button"
                    onClick={() => setRefine((value) => !value)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span>
                      <span className="text-sm font-medium text-zinc-200">Ajuste fino (opcional)</span>
                      <span className="mt-0.5 block text-[11px] text-zinc-500">
                        Descreva cenário, luz ou estilo para ajudar o modelo.
                      </span>
                    </span>
                    <span
                      className={`relative h-5 w-9 shrink-0 rounded-full transition ${refine ? "bg-violet-500" : "bg-white/15"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${refine ? "left-4" : "left-0.5"}`}
                      />
                    </span>
                  </button>
                  {refine && (
                    <textarea
                      className="field mt-3 min-h-[72px] resize-y"
                      placeholder="Ex.: luz de estúdio suave, fundo cinza, figurino preto, sem cortes de câmera."
                      value={customPrompt}
                      onChange={(event) => setCustomPrompt(event.target.value.slice(0, 400))}
                      maxLength={400}
                    />
                  )}
                </div>
              </section>
            </div>

            {/* coluna direita */}
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Prévia do quadro</p>
                  <span className="chip !px-2 !py-0.5 !text-[10px]">{aspect === "original" ? "original" : aspect}</span>
                </div>

                <div className="grid place-items-center rounded-2xl border border-white/10 bg-black/50 p-3">
                  <div
                    className="relative w-full max-w-[190px] overflow-hidden rounded-xl border border-white/15 bg-ink-900"
                    style={{
                      aspectRatio: `${effectiveRatio}`,
                      maxWidth: effectiveRatio >= 1 ? "100%" : "190px",
                    }}
                  >
                    {videoInfo?.posterUrl && (
                      <img
                        src={videoInfo.posterUrl}
                        alt="Frame do vídeo de referência"
                        className="h-full w-full object-cover opacity-90"
                      />
                    )}
                    {imagePreviewUrl ? (
                      <img
                        src={imagePreviewUrl}
                        alt="Imagem de referência"
                        className="absolute bottom-1.5 right-1.5 h-1/3 w-auto rounded-md border border-white/50 object-contain shadow-lg"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-500/10 to-cyan-400/10">
                        <span className="px-3 text-center text-[10px] leading-relaxed text-zinc-500">
                          envie a imagem para ver a prévia
                        </span>
                      </div>
                    )}
                    {!videoInfo && (
                      <div className="absolute inset-0 grid place-items-center">
                        <span className="text-[10px] text-zinc-600">vídeo de referência</span>
                      </div>
                    )}
                  </div>
                </div>

                <dl className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-500">Duração usada</dt>
                    <dd className="font-semibold text-zinc-200">
                      {durationUsed ? `${formatClock(durationUsed)} / ${formatClock(effectiveMax)}` : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-500">Custo estimado</dt>
                    <dd className="font-semibold text-zinc-200">
                      {estimatedCost ? `≈ ${formatMoney(estimatedCost)}` : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-500">Formato de saída</dt>
                    <dd className="font-semibold text-zinc-200">
                      {aspect === "original" ? "igual ao vídeo" : aspect}
                    </dd>
                  </div>
                </dl>

                <button onClick={handleGenerate} disabled={!canGenerate} className="btn-primary mt-4 w-full">
                  {busy ? <IconSpinner className="h-4 w-4" /> : <IconBolt className="h-4 w-4" />}
                  {busy ? "Gerando…" : "Gerar vídeo de motion control"}
                </button>
                {!videoFile || !imageFile ? (
                  <p className="mt-2 text-center text-[11px] text-zinc-500">
                    Envie o vídeo e a imagem para liberar a geração.
                  </p>
                ) : (
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-zinc-500">
                    Os créditos são cobrados pela fal.ai por segundo de vídeo gerado.
                  </p>
                )}
              </div>

              {busy && (
                <div className="card p-4">
                  <GenerationSteps stage={stage} />
                  <div className="mt-4">
                    <ProgressBar
                      percent={progressPercent}
                      label={progressLabel}
                      detail={progressDetail}
                      indeterminate={stage === "processing"}
                    />
                  </div>
                </div>
              )}

              {!busy && currentVideo && (
                <div className="card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                      Resultado
                    </p>
                    <span className="chip !border-emerald-400/30 !bg-emerald-400/10 !text-emerald-200">
                      pronto
                    </span>
                  </div>
                  <ResultViewer videoUrl={currentVideo} aspect={currentAspect} />
                </div>
              )}

              <ProjectPanel
                jobs={jobs}
                activeId={activeJobId}
                onClear={() => {
                  setJobs([]);
                  setCurrentVideo(null);
                  setActiveJobId(null);
                }}
                onSelect={(job) => {
                  setActiveJobId(job.id);
                  if (job.videoUrl) {
                    setCurrentVideo(job.videoUrl);
                    setCurrentAspect(job.aspect);
                  } else if (job.stage === "error") {
                    notify(job.error ?? "Essa geração falhou.", "error");
                  } else {
                    notify("Esse job ainda está em andamento (ou foi perdido ao recarregar a página).");
                  }
                }}
              />

              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
                  <IconInfo className="h-3.5 w-3.5 text-violet-300" /> Privacidade
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  Seus arquivos vão direto do navegador para o CDN da fal.ai usando URLs assinadas. A chave da
                  API nunca é exposta e nada é armazenado no servidor do site.
                </p>
              </div>
            </aside>
          </div>

          <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/8 py-6 text-[11px] text-zinc-500 sm:flex-row">
            <p>
              MotionLab · feito com React + Vite, funções serverless na Vercel e modelos da fal.ai.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/JonhyKelvis/Site-IA"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-zinc-300"
              >
                <IconGithub className="h-3.5 w-3.5" /> repositório
              </a>
              <a
                href={currentVideo ? downloadUrl(currentVideo) : undefined}
                className={`inline-flex items-center gap-1.5 ${currentVideo ? "hover:text-zinc-300" : "opacity-40"}`}
              >
                <IconDownload className="h-3.5 w-3.5" /> baixar último
              </a>
            </div>
          </footer>
        </main>
      )}

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />
    </div>
  );
}
