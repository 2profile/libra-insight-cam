import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Database,
  Download,
  Loader2,
  Radio,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { alphabet } from "@/lib/libras";

export const Route = createFileRoute("/coletar")({
  head: () => ({
    meta: [
      { title: "Coletar dados — Mãos que Falam" },
      {
        name: "description",
        content: "Coleta de landmarks da mão para montar dataset de treino do alfabeto em Libras.",
      },
    ],
  }),
  component: ColetarPage,
});

const SAMPLE_FRAMES = 30;
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

type Landmark = { x: number; y: number; z: number };
type Vision = typeof import("@mediapipe/tasks-vision");
type HandLandmarker = Awaited<ReturnType<Vision["HandLandmarker"]["createFromOptions"]>>;
type HandLandmarkerResult = ReturnType<HandLandmarker["detectForVideo"]>;

type DatasetFrame = {
  t: number;
  landmarks: Landmark[];
  handedness?: string;
  score?: number;
};

type DatasetSample = {
  id: string;
  label: string;
  createdAt: string;
  frameCount: number;
  frames: DatasetFrame[];
};

function getPrimaryHand(result: HandLandmarkerResult) {
  const landmarks = result.landmarks?.[0];
  if (!landmarks) return null;

  const handedness = result.handednesses?.[0]?.[0];
  return {
    landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    handedness: handedness?.categoryName,
    score: handedness?.score,
  };
}

function downloadJson(samples: DatasetSample[]) {
  const payload = {
    name: "libra-insight-cam-landmarks",
    version: 1,
    frameCount: SAMPLE_FRAMES,
    createdAt: new Date().toISOString(),
    labels: [...new Set(samples.map((sample) => sample.label))].sort(),
    samples,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `libras-landmarks-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function ColetarPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentFramesRef = useRef<DatasetFrame[]>([]);
  const recordingRef = useRef(false);
  const labelRef = useRef("A");

  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [error, setError] = useState("");
  const [label, setLabel] = useState("A");
  const [recording, setRecording] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState(0);
  const [handsCount, setHandsCount] = useState(0);
  const [samples, setSamples] = useState<DatasetSample[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");

  labelRef.current = label;

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recordingRef.current = false;
    currentFramesRef.current = [];
    setRecording(false);
    setCapturedFrames(0);
    setHandsCount(0);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current)
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, []);

  const stop = useCallback(() => {
    stopCamera();
    setStatus("idle");
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((items) => setDevices(items.filter((device) => device.kind === "videoinput")))
      .catch(() => setDevices([]));
  }, [status]);

  const finishSample = useCallback((frames: DatasetFrame[]) => {
    const sample: DatasetSample = {
      id: crypto.randomUUID(),
      label: labelRef.current,
      createdAt: new Date().toISOString(),
      frameCount: frames.length,
      frames,
    };

    setSamples((current) => [sample, ...current]);
    currentFramesRef.current = [];
    recordingRef.current = false;
    setRecording(false);
    setCapturedFrames(0);
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker) return;

    if (video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const result = landmarker.detectForVideo(video, performance.now());
      const hands = result.landmarks ?? [];
      const hand = getPrimaryHand(result);
      setHandsCount(hands.length);

      if (hand && recordingRef.current) {
        const frames = [
          ...currentFramesRef.current,
          {
            t: performance.now(),
            landmarks: hand.landmarks,
            handedness: hand.handedness,
            score: hand.score,
          },
        ];
        currentFramesRef.current = frames;
        setCapturedFrames(frames.length);
        if (frames.length >= SAMPLE_FRAMES) finishSample(frames);
      }

      for (const lm of hands) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 3;
        for (const [a, b] of HAND_CONNECTIONS) {
          ctx.beginPath();
          ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
          ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
          ctx.stroke();
        }
        for (const p of lm) {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#f5a623";
          ctx.fill();
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [finishSample]);

  const startCamera = async () => {
    setStatus("loading");
    setError("");
    try {
      if (!window.isSecureContext) throw new Error("insecure-context");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera-unavailable");

      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      landmarkerRef.current = await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        },
        runningMode: "VIDEO",
        numHands: 1,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("running");
      loop();
    } catch (e: unknown) {
      console.error(e);
      setError(
        e instanceof Error && e.message === "insecure-context"
          ? "No celular, a câmera só funciona em HTTPS. Use o deploy da Vercel para coletar."
          : e instanceof DOMException && e.name === "NotAllowedError"
            ? "Permissão de câmera negada. Habilite o acesso à câmera e tente novamente."
            : "Não foi possível iniciar a câmera ou o modelo. Verifique conexão e permissões.",
      );
      setStatus("error");
      stopCamera();
    }
  };

  const startRecording = () => {
    currentFramesRef.current = [];
    recordingRef.current = true;
    setRecording(true);
    setCapturedFrames(0);
  };

  const samplesByLabel = samples.reduce<Record<string, number>>((acc, sample) => {
    acc[sample.label] = (acc[sample.label] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="relative overflow-hidden bg-navy py-12 text-white sm:py-16">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[42px] border-primary/10" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Database className="h-4 w-4" /> Laboratório do projeto
            </span>
            <div className="mt-5 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="max-w-3xl text-balance text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                  Coleta de landmarks
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
                  Grave sequências de {SAMPLE_FRAMES} frames por letra para ampliar o dataset do
                  classificador.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => downloadJson(samples)}
                  disabled={samples.length === 0}
                  className="border-white/15 bg-white/8 text-white hover:bg-white/15 hover:text-white"
                >
                  <Download className="h-4 w-4" /> Exportar JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSamples([])}
                  disabled={samples.length === 0}
                  className="border-white/15 bg-white/8 text-white hover:bg-white/15 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" /> Limpar sessão
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="page-grid py-8 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <section className="min-w-0 overflow-hidden rounded-[2rem] bg-navy shadow-elegant">
                <div className="relative h-[360px] bg-[radial-gradient(circle_at_center,oklch(0.34_0.09_191),oklch(0.18_0.06_244))] sm:aspect-video sm:h-auto sm:min-h-72">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
                  />
                  {status !== "running" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
                      <div className="absolute h-44 w-44 rounded-full border border-primary/20" />
                      <div className="absolute h-32 w-32 rounded-full border border-dashed border-white/15" />
                      {status === "loading" ? (
                        <>
                          <Loader2 className="relative h-11 w-11 animate-spin text-primary" />
                          <p className="relative text-sm font-bold">Carregando câmera e modelo…</p>
                        </>
                      ) : status === "error" ? (
                        <>
                          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                            <AlertTriangle className="h-8 w-8" />
                          </span>
                          <p className="relative w-full max-w-xs text-sm leading-relaxed text-white/70">
                            {error}
                          </p>
                          <Button className="relative" variant="hero" onClick={startCamera}>
                            Tentar novamente
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-primary">
                            <Camera className="h-8 w-8" />
                          </span>
                          <div className="relative w-full max-w-xs">
                            <p className="font-bold">Prepare o enquadramento</p>
                            <p className="mt-1 text-sm text-white/55">
                              Uma mão por vez, bem iluminada e dentro do quadro.
                            </p>
                          </div>
                          <Button
                            className="relative"
                            variant="hero"
                            size="lg"
                            onClick={startCamera}
                          >
                            <Camera className="h-4 w-4" /> Ativar câmera
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {status === "running" && (
                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-navy/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                      <span
                        className={`h-2 w-2 rounded-full ${recording ? "animate-pulse bg-coral" : "bg-primary"}`}
                      />
                      {recording ? "Gravando" : "Câmera ativa"}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-px bg-white/10">
                  {[
                    ["Mãos", handsCount],
                    ["Frames", `${capturedFrames}/${SAMPLE_FRAMES}`],
                    ["Amostras", samples.length],
                  ].map(([text, value]) => (
                    <div key={text} className="bg-navy px-3 py-4 text-center sm:px-5 sm:text-left">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                        {text}
                      </p>
                      <p className="mt-1 text-xl font-black text-primary sm:text-2xl">{value}</p>
                    </div>
                  ))}
                </div>

                {status === "running" && (
                  <div className="flex flex-col gap-2 border-t border-white/10 p-4 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={stop}
                      className="border-white/15 bg-white/8 text-white hover:bg-white/15 hover:text-white"
                    >
                      <CameraOff className="h-4 w-4" /> Encerrar
                    </Button>
                    <Button
                      variant={recording ? "warm" : "hero"}
                      onClick={startRecording}
                      disabled={recording}
                    >
                      <Radio className="h-4 w-4" /> {recording ? "Gravando…" : "Gravar amostra"}
                    </Button>
                  </div>
                )}
              </section>

              <aside className="min-w-0 rounded-[2rem] border border-border bg-white p-5 shadow-soft">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                  Configuração
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-foreground">Nova amostra</h2>
                <div className="mt-5 grid gap-4">
                  <label className="block text-sm font-bold text-foreground">
                    Letra
                    <select
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-primary"
                    >
                      {alphabet.map((sign) => (
                        <option key={sign.letter} value={sign.letter}>
                          {sign.letter}
                        </option>
                      ))}
                    </select>
                  </label>
                  {devices.length > 0 && status !== "running" && (
                    <label className="block text-sm font-bold text-foreground">
                      Câmera
                      <select
                        value={deviceId}
                        onChange={(event) => setDeviceId(event.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-primary"
                      >
                        <option value="">Padrão do navegador</option>
                        {devices.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Câmera ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="mt-5 rounded-2xl bg-navy p-5 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                    Classe atual
                  </p>
                  <p className="mt-1 text-5xl font-black text-primary">{label}</p>
                  <p className="mt-3 text-xs leading-relaxed text-white/55">
                    Mantenha a mão dentro do quadro durante toda a gravação.
                  </p>
                </div>

                <div className="mt-5">
                  <h3 className="text-sm font-extrabold text-foreground">Amostras por letra</h3>
                  <div className="mt-3 grid grid-cols-5 gap-1.5">
                    {alphabet.map((sign) => (
                      <button
                        type="button"
                        key={sign.letter}
                        onClick={() => setLabel(sign.letter)}
                        className={`rounded-xl border p-2 text-center transition-colors ${
                          label === sign.letter
                            ? "border-primary bg-secondary"
                            : "border-border bg-background hover:border-primary/40"
                        }`}
                      >
                        <span className="block text-xs font-black text-foreground">
                          {sign.letter}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {samplesByLabel[sign.letter] ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            <section className="mt-5 rounded-[2rem] border border-border bg-white p-5 shadow-soft sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                    Sessão atual
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-foreground">
                    Amostras coletadas
                  </h2>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                  {samples.length} no total
                </span>
              </div>
              {samples.length ? (
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {samples.map((sample) => (
                    <div
                      key={sample.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-lg font-black text-primary">
                          {sample.label}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {sample.frameCount} frames
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(sample.createdAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir amostra da letra ${sample.label}`}
                        onClick={() =>
                          setSamples((current) => current.filter((item) => item.id !== sample.id))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-border bg-background p-8 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    Nenhuma amostra nesta sessão.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ative a câmera e grave a primeira sequência.
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
