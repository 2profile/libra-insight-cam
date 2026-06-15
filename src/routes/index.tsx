import { createFileRoute, Link } from "@tanstack/react-router";
import { Hand, Camera, BookOpen, Sparkles, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-libras.jpg";

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

const features = [
  {
    icon: BookOpen,
    title: "Alfabeto manual",
    text: "Aprenda cada letra e número da datilologia com descrições claras.",
  },
  {
    icon: Camera,
    title: "Prática com câmera",
    text: "Área livre que usa sua webcam para detectar e acompanhar as mãos em tempo real.",
  },
  {
    icon: Sparkles,
    title: "No seu ritmo",
    text: "Conteúdo organizado e acessível para começar do zero.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-sm font-medium text-primary shadow-soft">
              <Hand className="h-4 w-4" /> Língua Brasileira de Sinais
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl">
              Aprenda <span className="text-primary">Libras</span> usando suas próprias mãos
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Estude o alfabeto manual, pratique cada sinal e acompanhe os pontos das mãos em tempo
              real pela câmera.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/praticar">
                  Praticar com a câmera <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link to="/aprender">Ver o alfabeto</Link>
              </Button>
            </div>
          </div>
          <div className="animate-float">
            <img
              src={heroImg}
              alt="Mãos diversas comunicando em língua de sinais"
              width={1280}
              height={960}
              className="w-full rounded-3xl shadow-elegant"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
          Como funciona
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-7 shadow-soft transition-transform hover:-translate-y-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="overflow-hidden rounded-3xl bg-gradient-primary p-10 text-center text-primary-foreground shadow-elegant md:p-16">
          <h2 className="text-3xl font-bold md:text-4xl">Pronto para começar?</h2>
          <p className="mx-auto mt-3 max-w-lg opacity-90">
            Ative sua câmera e veja a tecnologia acompanhar cada movimento das suas mãos.
          </p>
          <Button asChild variant="warm" size="xl" className="mt-7">
            <Link to="/praticar">
              Abrir prática livre <Camera className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        Mãos que Falam — projeto educacional de Libras.
      </footer>
    </div>
  );
}
