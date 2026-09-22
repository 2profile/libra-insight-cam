import { Link } from "@tanstack/react-router";
import { ChevronDown, Database, Hand, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const links = [
  { to: "/", label: "Início" },
  { to: "/praticar", label: "Praticar" },
] as const;

const navClass =
  "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

export function Header() {
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="rounded-full text-muted-foreground">
                Mais <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-elegant">
              <DropdownMenuItem asChild className="rounded-xl p-3">
                <Link to="/coletar" className="cursor-pointer">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Database className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-semibold">Coletar dados</span>
                    <span className="text-xs text-muted-foreground">Ferramenta do projeto</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[88%] border-l-0 p-6 sm:max-w-sm">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle className="flex items-center gap-3 text-xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-primary">
                  <Hand className="h-5 w-5" />
                </span>
                Mãos que Falam
              </SheetTitle>
              <SheetDescription>Aprenda, pratique e acompanhe seus sinais.</SheetDescription>
            </SheetHeader>
            <nav className="mt-8 grid gap-2" aria-label="Navegação móvel">
              {[...links, { to: "/coletar", label: "Coletar dados" } as const].map((l) => (
                <SheetClose asChild key={l.to}>
                  <Link
                    to={l.to}
                    className="rounded-2xl px-4 py-3.5 text-base font-semibold text-foreground hover:bg-secondary"
                    activeProps={{
                      className:
                        "rounded-2xl bg-secondary px-4 py-3.5 text-base font-semibold text-secondary-foreground",
                    }}
                    activeOptions={{ exact: l.to === "/" }}
                  >
                    {l.label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
            <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-navy p-5 text-white">
              <p className="text-sm font-semibold">Pratique direto no navegador</p>
              <p className="mt-1 text-xs leading-relaxed text-white/65">
                Sua imagem não é enviada para servidores.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
