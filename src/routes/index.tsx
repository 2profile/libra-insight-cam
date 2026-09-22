import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  Hand,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-libras-v2.webp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mãos que Falam — Aprenda Libras com a câmera" },
      {
        name: "description",
        content:
          "Aplicação educacional para aprender Libras: alfabeto manual, lições interativas e prática livre com reconhecimento de sinais pela câmera.",
      },
      { property: "og:title", content: "Mãos que Falam — Aprenda Libras" },
      {
        property: "og:description",
        content: "Aprenda o alfabeto em Libras e pratique com reconhecimento de mãos pela câmera.",
      },
    ],
  }),
  component: Index,
});

const steps = [
  {
    icon: BookOpen,
    eyebrow: "01 · Conheça",
    title: "Conheça cada configuração",
    text: "Use a guia construída com amostras reais para observar os pontos e a posição de cada letra mapeada.",
    to: "/praticar" as const,
    link: "Ver guia visual",
  },
  {
    icon: Camera,
    eyebrow: "02 · Experimente",
    title: "Pratique diante da câmera",
    text: "Ative a webcam e acompanhe os pontos das mãos em tempo real, sem enviar imagens.",
    to: "/praticar" as const,
    link: "Iniciar prática",
  },
  {
    icon: ScanLine,
    eyebrow: "03 · Entenda",
    title: "Tecnologia que acompanha",
    text: "Um modelo treinado analisa landmarks e combina reconhecimento com orientações visuais.",
    to: "/praticar" as const,
    link: "Ver tecnologia",
  },
];

function Index() {
  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <Header />

      <main>
        <section className="relative isolate min-h-[650px] overflow-hidden bg-navy lg:min-h-[690px]">
          <img
            src={heroImg}
            alt="Estudante praticando Libras com visualização digital dos pontos da mão"
            width={1672}
            height={941}
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-[66%_center]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.18_0.07_250)_0%,oklch(0.18_0.07_250/.96)_30%,oklch(0.2_0.06_238/.62)_51%,transparent_76%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy/55 to-transparent" />
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full border-[44px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-28 left-[42%] h-72 w-72 rounded-full bg-primary/15 blur-3xl" />

          <div className="relative mx-auto flex min-h-[650px] max-w-7xl items-center px-4 py-20 sm:px-6 lg:min-h-[690px]">
            <div className="max-w-xl animate-fade-up text-white">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary backdrop-blur-md sm:text-sm">
                <Sparkles className="h-4 w-4" /> Aprendizado visual e interativo
              </span>
              <h1 className="mt-6 text-balance text-4xl font-black leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-7xl">
                Libras ganha vida nas suas mãos.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-white/72 sm:text-lg">
                Aprenda o alfabeto manual, pratique cada configuração e veja a tecnologia acompanhar
                seus movimentos pela câmera — direto no navegador.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="hero" size="xl" className="w-full sm:w-auto">
                  <Link to="/praticar">
                    Praticar com a câmera <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="xl"
                  className="w-full border-white/25 bg-white/10 text-white hover:border-white/45 hover:bg-white/15 hover:text-white sm:w-auto"
                >
                  <a href="#como-funciona">Entender como funciona</a>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/65">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Sem cadastro
                </span>
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Imagens ficam no dispositivo
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="page-grid relative scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <span className="text-sm font-extrabold uppercase tracking-[0.18em] text-primary">
                  Sua jornada
                </span>
                <h2 className="mt-3 text-balance text-3xl font-black tracking-[-0.035em] text-foreground sm:text-5xl">
                  Da primeira letra à prática em tempo real.
                </h2>
              </div>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground lg:justify-self-end">
                Uma experiência simples para quem está começando, com tecnologia visível o bastante
                para transformar cada tentativa em aprendizado.
              </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {steps.map((step, index) => (
                <article
                  key={step.title}
                  className={`group relative overflow-hidden rounded-[2rem] border bg-card p-7 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant ${
                    index === 1
                      ? "border-primary/30 lg:-translate-y-5 lg:hover:-translate-y-6"
                      : "border-border"
                  }`}
                >
                  <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-secondary transition-transform duration-500 group-hover:scale-125" />
                  <div className="relative">
                    <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-navy text-primary shadow-soft">
                      <step.icon className="h-6 w-6" />
                    </span>
                    <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
                      {step.eyebrow}
                    </p>
                    <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-3 min-h-18 text-sm leading-relaxed text-muted-foreground">
                      {step.text}
                    </p>
                    <Link
                      to={step.to}
                      className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-primary"
                    >
                      {step.link}{" "}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] bg-navy px-6 py-12 text-white shadow-elegant sm:px-12 sm:py-16">
            <div className="absolute -right-16 -top-28 h-80 w-80 rounded-full border-[48px] border-primary/10" />
            <div className="absolute bottom-0 right-[28%] h-40 w-40 rounded-full bg-coral/15 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                  <Hand className="h-4 w-4" /> Seu próximo sinal começa aqui
                </span>
                <h2 className="mt-3 max-w-2xl text-balance text-3xl font-black tracking-tight sm:text-4xl">
                  Abra a câmera e transforme movimento em prática.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
                  Tudo acontece no navegador e você pode parar quando quiser.
                </p>
              </div>
              <Button asChild variant="warm" size="xl" className="w-full lg:w-auto">
                <Link to="/praticar">
                  Começar agora <Camera className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center text-sm text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
          <span className="flex items-center gap-2 font-bold text-foreground">
            <Hand className="h-4 w-4 text-primary" /> Mãos que Falam
          </span>
          <p>Projeto educacional de Libras com reconhecimento visual.</p>
        </div>
      </footer>
    </div>
  );
}
