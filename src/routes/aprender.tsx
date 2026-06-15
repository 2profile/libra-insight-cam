import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { alphabet, numbers, type Sign } from "@/lib/libras";

export const Route = createFileRoute("/aprender")({
  head: () => ({
    meta: [
      { title: "Aprender o alfabeto em Libras — Mãos que Falam" },
      { name: "description", content: "Conheça o alfabeto manual e os números em Libras com descrições de como configurar cada sinal." },
      { property: "og:title", content: "Aprender o alfabeto em Libras" },
      { property: "og:description", content: "Datilologia: letras e números da Língua Brasileira de Sinais." },
    ],
  }),
  component: AprenderPage,
});

function SignGrid({ signs, onSelect, selected }: { signs: Sign[]; onSelect: (s: Sign) => void; selected: Sign | null }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
      {signs.map((s) => (
        <button
          key={s.letter}
          onClick={() => onSelect(s)}
          className={`aspect-square rounded-2xl border text-2xl font-bold transition-all hover:-translate-y-1 hover:shadow-soft ${
            selected?.letter === s.letter
              ? "border-primary bg-gradient-primary text-primary-foreground shadow-elegant"
              : "border-border bg-card text-foreground"
          }`}
        >
          {s.letter}
        </button>
      ))}
    </div>
  );
}

function AprenderPage() {
  const [selected, setSelected] = useState<Sign | null>(alphabet[0]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Alfabeto manual
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Toque em uma letra ou número para ver como configurar a mão. Depois, treine na aba de prática.
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
          <Tabs defaultValue="letters">
            <TabsList>
              <TabsTrigger value="letters">Letras</TabsTrigger>
              <TabsTrigger value="numbers">Números</TabsTrigger>
            </TabsList>
            <TabsContent value="letters" className="mt-5">
              <SignGrid signs={alphabet} onSelect={setSelected} selected={selected} />
            </TabsContent>
            <TabsContent value="numbers" className="mt-5">
              <SignGrid signs={numbers} onSelect={setSelected} selected={selected} />
            </TabsContent>
          </Tabs>

          <aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-soft md:sticky md:top-24">
            {selected ? (
              <>
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-primary text-5xl font-extrabold text-primary-foreground shadow-elegant">
                  {selected.letter}
                </div>
                <h2 className="mt-5 text-lg font-semibold text-foreground">
                  Sinal de “{selected.letter}”
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {selected.description}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione um sinal.</p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
