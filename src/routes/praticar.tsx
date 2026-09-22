import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  CameraOff,
  Hand,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { alphabet } from "@/lib/libras";

export const Route = createFileRoute("/praticar")({
  head: () => ({
    meta: [
      { title: "Praticar com a câmera — Mãos que Falam" },
      {
        name: "description",
        content:
          "Área livre de prática: ative a câmera e veja o reconhecimento de mãos em tempo real para treinar sinais de Libras.",
      },
      { property: "og:title", content: "Praticar Libras com a câmera" },
      { property: "og:description", content: "Reconhecimento de mãos em tempo real no navegador." },
    ],
  }),
  component: PraticarPage,
});

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
type FingerState = {
  thumb: boolean;
  index: boolean;
  middle: boolean;
  ring: boolean;
  pinky: boolean;
};
type LandmarkModel = {
  kind: string;
  labels: string[];
  k?: number;
  centroids?: Record<string, number[]>;
  prototypes?: Array<{
    label: string;
    features: number[];
  }>;
  metrics?: {
    testAccuracy?: number;
  };
};
type ModelPrediction = {
  label: string;
  confidence: number;
};

type GuidePoint = { x: number; y: number };

const TRAINED_LABELS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "I",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
];
function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeLandmarks(landmarks: Landmark[]): number[] {
  const wrist = landmarks[0];
  const scale = Math.max(distance(landmarks[5], landmarks[17]), 0.0001);
  return landmarks.flatMap((point) => [
    (point.x - wrist.x) / scale,
    (point.y - wrist.y) / scale,
    (point.z - wrist.z) / scale,
  ]);
}

function squaredDistance(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
}

function getRepresentativeFeatures(model: LandmarkModel | null): Record<string, number[]> {
  if (!model) return {};
  if (model.centroids) return model.centroids;

  const grouped = new Map<string, number[][]>();
  for (const prototype of model.prototypes ?? []) {
    const group = grouped.get(prototype.label) ?? [];
    group.push(prototype.features);
    grouped.set(prototype.label, group);
  }

  return Object.fromEntries(
    [...grouped.entries()].map(([label, samples]) => {
      const mean = samples[0].map(
        (_, index) => samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length,
      );
      const representative = samples.reduce((best, sample) =>
        squaredDistance(sample, mean) < squaredDistance(best, mean) ? sample : best,
      );
      return [label, representative];
    }),
  );
}

function projectGuidePoints(features: number[]): GuidePoint[] {
  const raw = Array.from({ length: 21 }, (_, index) => ({
    x: features[index * 3] ?? 0,
    y: features[index * 3 + 1] ?? 0,
  }));
  const xs = raw.map((point) => point.x);
  const ys = raw.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 0.001);
  const height = Math.max(maxY - minY, 0.001);
  const scale = 76 / Math.max(width, height);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return raw.map((point) => ({
    x: 50 + (point.x - centerX) * scale,
    y: 50 + (point.y - centerY) * scale,
  }));
}

function LandmarkGuide({ features, label }: { features?: number[]; label: string }) {
  const points = features ? projectGuidePoints(features) : [];

  return (
    <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-[1.75rem] bg-navy text-primary">
      <div className="absolute h-52 w-52 rounded-full border border-primary/15" />
      <div className="absolute h-40 w-40 rounded-full border border-dashed border-white/10" />
      <span className="absolute left-5 top-4 text-5xl font-black text-white/8">{label}</span>
      {points.length ? (
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label={`Representação dos pontos da mão para a letra ${label}`}
          className="relative h-56 w-56 drop-shadow-[0_0_18px_rgba(27,209,194,0.25)]"
        >
          {HAND_CONNECTIONS.map(([start, end]) => (
            <line
              key={`${start}-${end}`}
              x1={points[start].x}
              y1={points[start].y}
              x2={points[end].x}
              y2={points[end].y}
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              opacity="0.72"
            />
          ))}
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={index === 0 ? 2.2 : 1.6}
              fill={index === 0 ? "white" : "currentColor"}
            />
          ))}
        </svg>
      ) : (
        <div className="relative text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-3 text-xs font-bold text-white/55">Preparando guia visual…</p>
        </div>
      )}
    </div>
  );
}

function predictWithModel(model: LandmarkModel, landmarks: Landmark[]): ModelPrediction | null {
  const features = normalizeLandmarks(landmarks);

  if (model.prototypes?.length) {
    const neighbors = model.prototypes
      .map((prototype) => ({
        label: prototype.label,
        distance: squaredDistance(features, prototype.features),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, model.k ?? 3);

    const votes = new Map<string, number>();
    for (const neighbor of neighbors) {
      votes.set(neighbor.label, (votes.get(neighbor.label) ?? 0) + 1 / (neighbor.distance + 1e-9));
    }

    const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return null;
    const total = ranked.reduce((sum, [, score]) => sum + score, 0);
    return {
      label: ranked[0][0],
      confidence: total ? Math.max(0, Math.min(1, ranked[0][1] / total)) : 0,
    };
  }

  if (!model.centroids) return null;

  const scores = model.labels
    .map((label) => ({
      label,
      distance: squaredDistance(features, model.centroids?.[label] ?? []),
    }))
    .sort((a, b) => a.distance - b.distance);

  if (!scores.length) return null;
  const best = scores[0];
  const second = scores[1];
  const confidence = second ? second.distance / (best.distance + second.distance) : 1;
  return { label: best.label, confidence: Math.max(0, Math.min(1, confidence)) };
}

function getFingerState(lm: Landmark[]): FingerState {
  const palmWidth = distance(lm[5], lm[17]);
  const isUp = (tip: number, pip: number) => lm[tip].y < lm[pip].y - palmWidth * 0.08;

  return {
    thumb: Math.abs(lm[4].x - lm[2].x) > palmWidth * 0.55,
    index: isUp(8, 6),
    middle: isUp(12, 10),
    ring: isUp(16, 14),
    pinky: isUp(20, 18),
  };
}

function classifyLetter(lm: Landmark[]): string | null {
  const f = getFingerState(lm);
  const palmWidth = distance(lm[5], lm[17]);
  const indexMiddleGap = distance(lm[8], lm[12]) / Math.max(palmWidth, 0.0001);

  if (!f.index && !f.middle && !f.ring && !f.pinky) return "A";
  if (f.index && f.middle && f.ring && f.pinky) return "B";
  if (!f.thumb && !f.index && !f.middle && !f.ring && f.pinky) return "I";
  if (f.thumb && f.index && !f.middle && !f.ring && !f.pinky) return "L";
  if (f.index && f.middle && !f.ring && !f.pinky) return indexMiddleGap < 0.55 ? "U" : "V";
  if (f.index && f.middle && f.ring && !f.pinky) return "W";
  if (f.thumb && !f.index && !f.middle && !f.ring && f.pinky) return "Y";

  return null;
}

function countFingers(lm: Landmark[]): number {
  let count = 0;
  // Dedos (indicador, médio, anelar, mínimo): ponta acima da junção
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  for (let i = 0; i < tips.length; i++) {
    if (lm[tips[i]].y < lm[pips[i]].y) count++;
  }
  // Polegar: comparação horizontal
  if (Math.abs(lm[4].x - lm[0].x) > Math.abs(lm[3].x - lm[0].x)) count++;
  return count;
}

function PraticarPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const modelRef = useRef<LandmarkModel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [handsCount, setHandsCount] = useState(0);
  const [fingers, setFingers] = useState<number | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [model, setModel] = useState<LandmarkModel | null>(null);
  const [modelConfidence, setModelConfidence] = useState<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [guideLetter, setGuideLetter] = useState(TRAINED_LABELS[0]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current)
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, []);

  const stop = useCallback(() => {
    stopCamera();
    setStatus("idle");
    setHandsCount(0);
    setFingers(null);
    setLetter(null);
    setModelConfidence(null);
  }, [stopCamera]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((items) => setDevices(items.filter((d) => d.kind === "videoinput")))
      .catch(() => setDevices([]));
  }, [status]);

  useEffect(() => {
    fetch(`/models/landmark-centroids.json?v=${Date.now()}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        modelRef.current = data;
        setModel(data);
      })
      .catch(() => {
        modelRef.current = null;
        setModel(null);
      });
  }, []);

  const start = async () => {
    setStatus("loading");
    setError("");
    try {
      if (!window.isSecureContext) {
        throw new Error("insecure-context");
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("camera-unavailable");
      }

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
        numHands: 2,
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
          ? "No celular, a câmera só funciona em HTTPS. Acesse por um link HTTPS ou publique a aplicação."
          : e instanceof DOMException && e.name === "NotAllowedError"
            ? "Permissão de câmera negada. Habilite o acesso à câmera e tente novamente."
            : "Não foi possível iniciar a câmera ou o modelo. Verifique sua conexão e permissões.",
      );
      setStatus("error");
      stopCamera();
    }
  };

  const loop = () => {
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
      setHandsCount(hands.length);
      setFingers(hands.length ? countFingers(hands[0]) : null);
      if (hands.length) {
        const prediction = modelRef.current ? predictWithModel(modelRef.current, hands[0]) : null;
        const shapeLetter = classifyLetter(hands[0]);
        setLetter(
          shapeLetter === "U" || shapeLetter === "V"
            ? shapeLetter
            : (prediction?.label ?? shapeLetter),
        );
        setModelConfidence(prediction?.confidence ?? null);
      } else {
        setLetter(null);
        setModelConfidence(null);
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
  };

  const mappedLabels = model?.labels?.length ? model.labels : TRAINED_LABELS;
  const activeSign = letter ? alphabet.find((sign) => sign.letter === letter) : null;
  const guideSign = alphabet.find((sign) => sign.letter === guideLetter);
  const representativeFeatures = useMemo(() => getRepresentativeFeatures(model), [model]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="relative overflow-hidden bg-navy py-12 text-white sm:py-16">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[42px] border-primary/10" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Hand className="h-4 w-4" /> Prática livre
            </span>
            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-end">
              <div>
                <h1 className="max-w-3xl text-balance text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                  Veja seus movimentos ganharem forma.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
                  Ative a webcam para acompanhar os pontos da mão e testar o reconhecimento em tempo
                  real.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/8 p-4 lg:justify-self-end">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="max-w-sm text-xs leading-relaxed text-white/65 sm:text-sm">
                  Privacidade local: nenhuma imagem da câmera é enviada para servidores.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="page-grid py-8 sm:py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            {devices.length > 0 && status !== "running" && (
              <label className="mb-5 block max-w-md text-sm font-bold text-foreground">
                Escolha a câmera
                <select
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-medium text-foreground shadow-sm outline-none focus:border-primary"
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

            <div className="grid gap-5">
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
                          <div className="relative w-full max-w-xs">
                            <p className="font-bold">Preparando o reconhecimento</p>
                            <p className="mt-1 text-sm text-white/55">
                              Carregando câmera e modelo…
                            </p>
                          </div>
                        </>
                      ) : status === "error" ? (
                        <>
                          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                            <AlertTriangle className="h-8 w-8" />
                          </span>
                          <p className="relative w-full max-w-xs text-sm leading-relaxed text-white/75">
                            {error}
                          </p>
                          <Button className="relative" variant="hero" size="lg" onClick={start}>
                            Tentar novamente
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-primary shadow-soft backdrop-blur-sm">
                            <Camera className="h-8 w-8" />
                          </span>
                          <div className="relative w-full max-w-xs">
                            <p className="font-bold">Sua área de prática está pronta</p>
                            <p className="mt-1 max-w-sm text-sm text-white/55">
                              Posicione as mãos dentro do quadro e comece quando quiser.
                            </p>
                          </div>
                          <Button className="relative" variant="hero" size="lg" onClick={start}>
                            <Camera className="h-4 w-4" /> Ativar câmera
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {status === "running" && (
                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-navy/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Ao vivo
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
                  {[
                    ["Mãos", handsCount],
                    ["Dedos", fingers ?? "—"],
                    ["Letra", letter ?? "—"],
                    [
                      "Confiança",
                      modelConfidence == null ? "—" : `${Math.round(modelConfidence * 100)}%`,
                    ],
                  ].map(([labelText, value]) => (
                    <div key={labelText} className="bg-navy px-4 py-4 text-center sm:text-left">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                        {labelText}
                      </p>
                      <p className="mt-1 text-2xl font-black text-primary">{value}</p>
                    </div>
                  ))}
                </div>
                {status === "running" && (
                  <div className="flex justify-end border-t border-white/10 p-4">
                    <Button
                      variant="outline"
                      onClick={stop}
                      className="border-white/15 bg-white/8 text-white hover:bg-white/15 hover:text-white"
                    >
                      <CameraOff className="h-4 w-4" /> Encerrar câmera
                    </Button>
                  </div>
                )}
              </section>

              <section className="min-w-0 rounded-[2rem] border border-border bg-white p-5 shadow-soft sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                      Mapa de reconhecimento
                    </p>
                    <h2 className="mt-1 text-xl font-extrabold text-foreground">
                      Letras disponíveis no modelo
                    </h2>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {mappedLabels.length} letras mapeadas
                  </span>
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                  <LandmarkGuide
                    label={guideLetter}
                    features={representativeFeatures[guideLetter]}
                  />
                  <div className="min-w-0">
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
                      {mappedLabels.map((mappedLetter) => {
                        const sign = alphabet.find((item) => item.letter === mappedLetter);
                        const isSelected = guideLetter === mappedLetter;
                        const isDetected = letter === mappedLetter;
                        return (
                          <button
                            type="button"
                            key={mappedLetter}
                            title={sign?.description}
                            aria-pressed={isSelected}
                            aria-label={
                              sign
                                ? `Exibir guia da letra ${mappedLetter}: ${sign.description}`
                                : `Exibir guia da letra ${mappedLetter}`
                            }
                            onClick={() => setGuideLetter(mappedLetter)}
                            className={`relative flex aspect-square min-w-0 items-center justify-center rounded-2xl border text-lg font-black transition-all hover:-translate-y-0.5 ${
                              isSelected
                                ? "border-primary bg-navy text-primary shadow-elegant"
                                : "border-border bg-background text-foreground hover:border-primary/50"
                            }`}
                          >
                            {mappedLetter}
                            {isDetected && (
                              <span
                                className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-coral"
                                aria-label="Letra reconhecida agora"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 rounded-2xl bg-secondary/70 px-4 py-4">
                      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">
                        Guia da letra {guideLetter}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {guideSign?.description ?? "Descrição indisponível para esta letra."}
                      </p>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        O desenho usa uma amostra representativa do conjunto que treinou o modelo.
                        Use-o como referência de posição e orientação da mão.
                      </p>
                      {activeSign && (
                        <button
                          type="button"
                          onClick={() => setGuideLetter(activeSign.letter)}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:text-primary"
                        >
                          Reconhecida agora: {activeSign.letter}
                          <span className="h-2 w-2 rounded-full bg-coral" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-primary/20 bg-secondary/70 p-4 text-sm text-muted-foreground">
              <Activity className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p>
                <strong className="text-foreground">Como funciona:</strong> os 21 pontos de cada mão
                são analisados em tempo real. O modelo treinado é usado quando disponível, com uma
                heurística visual como apoio.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
