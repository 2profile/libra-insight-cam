import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Hand, Loader2, AlertTriangle } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/praticar")({
  head: () => ({
    meta: [
      { title: "Praticar com a câmera — Mãos que Falam" },
      { name: "description", content: "Área livre de prática: ative a câmera e veja o reconhecimento de mãos em tempo real para treinar sinais de Libras." },
      { property: "og:title", content: "Praticar Libras com a câmera" },
      { property: "og:description", content: "Reconhecimento de mãos em tempo real no navegador." },
    ],
  }),
  component: PraticarPage,
});

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

type Landmark = { x: number; y: number; z: number };

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
  const landmarkerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [handsCount, setHandsCount] = useState(0);
  const [fingers, setFingers] = useState<number | null>(null);

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
    setHandsCount(0);
    setFingers(null);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setStatus("loading");
    setError("");
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      landmarkerRef.current = await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("running");
      loop();
    } catch (e: any) {
      console.error(e);
      setError(
        e?.name === "NotAllowedError"
          ? "Permissão de câmera negada. Habilite o acesso à câmera e tente novamente."
          : "Não foi possível iniciar a câmera ou o modelo. Verifique sua conexão e permissões.",
      );
      setStatus("error");
      stop();
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
          Ative sua webcam para acompanhar os pontos da mão em tempo real. Tudo roda no seu navegador —
          nenhuma imagem é enviada para servidores.
        </p>

        <div className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
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
                    <p className="text-sm font-medium text-foreground">Carregando modelo de detecção…</p>
                  </>
                ) : status === "error" ? (
                  <>
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                    <p className="max-w-sm text-sm text-foreground">{error}</p>
                    <Button variant="hero" onClick={start}>Tentar novamente</Button>
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
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Dedos levantados</p>
                  <p className="text-2xl font-bold text-primary">{fingers ?? "—"}</p>
                </div>
              </div>
              <Button variant="outline" onClick={stop}>
                <CameraOff className="h-4 w-4" /> Parar
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
          <strong className="text-foreground">Área de integração:</strong> os 21 pontos de cada mão estão
          disponíveis em tempo real. Você pode evoluir esta área conectando um classificador de sinais
          para reconhecer letras e palavras completas da Libras.
        </div>
      </main>
    </div>
  );
}
