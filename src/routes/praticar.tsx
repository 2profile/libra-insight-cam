import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Hand, Loader2, AlertTriangle } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";

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

const LETTER_GUIDE: Array<{
  letter: string;
  hint: string;
  fingers: [boolean, boolean, boolean, boolean, boolean];
}> = [
  { letter: "A", hint: "Punho fechado", fingers: [false, false, false, false, false] },
  { letter: "B", hint: "Quatro dedos abertos", fingers: [false, true, true, true, true] },
  { letter: "I", hint: "Mindinho aberto", fingers: [false, false, false, false, true] },
  { letter: "L", hint: "Polegar e indicador", fingers: [true, true, false, false, false] },
  { letter: "U", hint: "Indicador e médio juntos", fingers: [false, true, true, false, false] },
  { letter: "V", hint: "Indicador e médio", fingers: [false, true, true, false, false] },
  { letter: "W", hint: "Três dedos abertos", fingers: [false, true, true, true, false] },
  { letter: "Y", hint: "Polegar e mindinho", fingers: [true, false, false, false, true] },
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

function MiniHand({ fingers }: { fingers: [boolean, boolean, boolean, boolean, boolean] }) {
  return (
    <div className="flex h-14 items-end justify-center gap-1 rounded-xl bg-secondary/70 px-3 py-2">
      {fingers.map((open, index) => (
        <span
          key={index}
          className={`w-2 rounded-full ${open ? "h-10 bg-primary" : "h-4 bg-muted-foreground/35"}`}
        />
      ))}
    </div>
  );
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-primary">
          <Hand className="h-4 w-4" /> Prática livre
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Reconhecimento de mãos pela câmera
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Ative sua webcam para acompanhar os pontos da mão em tempo real. Tudo roda no seu
          navegador — nenhuma imagem é enviada para servidores.
        </p>

        {devices.length > 0 && status !== "running" && (
          <label className="mt-5 block max-w-md text-sm font-medium text-foreground">
            Câmera
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
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

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_260px]">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <div className="relative aspect-video bg-muted">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-hero p-6 text-center">
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <p className="text-sm font-medium text-foreground">
                        Carregando modelo de detecção…
                      </p>
                    </>
                  ) : status === "error" ? (
                    <>
                      <AlertTriangle className="h-10 w-10 text-destructive" />
                      <p className="max-w-sm text-sm text-foreground">{error}</p>
                      <Button variant="hero" onClick={start}>
                        Tentar novamente
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-primary shadow-soft">
                        <Camera className="h-8 w-8" />
                      </span>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Clique para ativar a câmera e começar a detecção das mãos.
                      </p>
                      <Button variant="hero" size="lg" onClick={start}>
                        <Camera className="h-4 w-4" /> Ativar câmera
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {status === "running" && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-5">
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Mãos</p>
                    <p className="text-2xl font-bold text-foreground">{handsCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Dedos levantados
                    </p>
                    <p className="text-2xl font-bold text-primary">{fingers ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Letra</p>
                    <p className="text-2xl font-bold text-primary">{letter ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Confiança
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {modelConfidence == null ? "—" : `${Math.round(modelConfidence * 100)}%`}
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={stop}>
                  <CameraOff className="h-4 w-4" /> Parar
                </Button>
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-border bg-card p-4 shadow-soft">
            <h2 className="text-sm font-semibold text-foreground">Guia de teste</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {model
                ? `Modelo treinado: ${model.labels.join(", ")}`
                : "Heurística simples: posição dos dedos."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-1">
              {LETTER_GUIDE.map((item) => (
                <div
                  key={item.letter}
                  className={`rounded-2xl border p-3 ${
                    letter === item.letter ? "border-primary bg-secondary" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-2xl font-extrabold text-foreground">{item.letter}</p>
                      <p className="text-xs text-muted-foreground">{item.hint}</p>
                    </div>
                    <MiniHand fingers={item.fingers} />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
          <strong className="text-foreground">Área de integração:</strong> os 21 pontos de cada mão
          estão disponíveis em tempo real. Esta versão usa modelo treinado quando disponível e
          mantém heurística como fallback.
        </div>
      </main>
    </div>
  );
}
