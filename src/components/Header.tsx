import { Link } from "@tanstack/react-router";
import { Database, Hand, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Início" },
  { to: "/praticar", label: "Praticar" },
] as const;

const navClass =
  "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="group flex items-center gap-3" aria-label="Mãos que Falam — início">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-primary shadow-soft transition-transform group-hover:-rotate-3">
            <Hand className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-extrabold leading-none tracking-tight text-foreground sm:text-lg">
              Mãos que Falam
            </span>
            <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Libras com tecnologia
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={navClass}
              activeProps={{ className: `${navClass} bg-secondary text-secondary-foreground` }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
          <Button asChild variant="ghost" className="rounded-full text-muted-foreground">
            <Link to="/coletar">
              <Database className="h-4 w-4" /> Coletar dados
            </Link>
          </Button>
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <Button asChild variant="ghost" size="icon" aria-label="Coletar dados">
            <Link to="/coletar">
              <Database className="h-5 w-5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          {menuOpen && (
            <div className="fixed inset-0 z-[60] md:hidden" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-black/50"
                aria-label="Fechar menu"
                onClick={() => setMenuOpen(false)}
              />
              <aside
                id="mobile-menu"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-menu-title"
                className="relative z-10 ml-auto flex h-full w-[88%] max-w-sm flex-col bg-background p-6 shadow-lg"
              >
                <button
                  type="button"
                  className="absolute right-4 top-4 rounded-sm p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Fechar menu"
                  onClick={() => setMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3 pr-8">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-primary">
                    <Hand className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 id="mobile-menu-title" className="text-xl font-semibold text-foreground">
                      Mãos que Falam
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Aprenda, pratique e acompanhe seus sinais.
                    </p>
                  </div>
                </div>
                <nav className="mt-8 grid gap-2" aria-label="Navegação móvel">
                  {[...links, { to: "/coletar", label: "Coletar dados" } as const].map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setMenuOpen(false)}
                      className="rounded-2xl px-4 py-3.5 text-base font-semibold text-foreground hover:bg-secondary"
                      activeProps={{
                        className:
                          "rounded-2xl bg-secondary px-4 py-3.5 text-base font-semibold text-secondary-foreground",
                      }}
                      activeOptions={{ exact: l.to === "/" }}
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-auto rounded-2xl bg-navy p-5 text-white">
                  <p className="text-sm font-semibold">Pratique direto no navegador</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/65">
                    Sua imagem não é enviada para servidores.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
