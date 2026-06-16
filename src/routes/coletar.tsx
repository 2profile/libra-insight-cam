import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Camera, CameraOff, Download, Loader2, Trash2 } from "lucide-react";
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
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-primary">
              <Camera className="h-4 w-4" /> Dataset
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Coleta de landmarks
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Grave sequências curtas de 30 frames por letra para treinar o classificador do TCC.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => downloadJson(samples)}
              disabled={samples.length === 0}
            >
              <Download className="h-4 w-4" /> Exportar JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => setSamples([])}
              disabled={samples.length === 0}
            >
              <Trash2 className="h-4 w-4" /> Limpar
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
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
                        Carregando câmera e modelo...
                      </p>
                    </>
                  ) : status === "error" ? (
                    <>
                      <AlertTriangle className="h-10 w-10 text-destructive" />
                      <p className="max-w-sm text-sm text-foreground">{error}</p>
                      <Button variant="hero" onClick={startCamera}>
                        Tentar novamente
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-primary shadow-soft">
                        <Camera className="h-8 w-8" />
                      </span>
                      <Button variant="hero" size="lg" onClick={startCamera}>
                        <Camera className="h-4 w-4" /> Ativar câmera
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-5">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Mãos</p>
                  <p className="text-2xl font-bold text-foreground">{handsCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Frames</p>
                  <p className="text-2xl font-bold text-primary">
                    {capturedFrames}/{SAMPLE_FRAMES}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Amostras</p>
                  <p className="text-2xl font-bold text-foreground">{samples.length}</p>
                </div>
              </div>

              {status === "running" ? (
                <Button
                  variant={recording ? "warm" : "hero"}
                  onClick={startRecording}
                  disabled={recording}
                >
                  {recording ? "Gravando..." : "Gravar amostra"}
                </Button>
              ) : (
                <Button variant="outline" onClick={stopCamera}>
                  <CameraOff className="h-4 w-4" /> Parar
                </Button>
              )}
            </div>
          </section>

          <aside className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <label className="block text-sm font-medium text-foreground">
              Letra
              <select
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
                {alphabet.map((sign) => (
                  <option key={sign.letter} value={sign.letter}>
                    {sign.letter}
                  </option>
                ))}
              </select>
            </label>

            {devices.length > 0 && status !== "running" && (
              <label className="mt-4 block text-sm font-medium text-foreground">
                Câmera
                <select
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
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

            <div className="mt-5 rounded-2xl border border-dashed border-border bg-secondary/40 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Classe atual</p>
              <p className="mt-1 text-4xl font-extrabold text-primary">{label}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Mantenha a mão dentro do quadro durante a gravação.
              </p>
            </div>

            <div className="mt-5">
              <h2 className="text-sm font-semibold text-foreground">Amostras por letra</h2>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {alphabet.map((sign) => (
                  <div
                    key={sign.letter}
                    className={`rounded-xl border p-2 text-center ${
                      label === sign.letter ? "border-primary bg-secondary" : "border-border"
                    }`}
                  >
                    <p className="text-sm font-bold text-foreground">{sign.letter}</p>
                    <p className="text-xs text-muted-foreground">
                      {samplesByLabel[sign.letter] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
