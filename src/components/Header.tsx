import { Link } from "@tanstack/react-router";
import { Hand } from "lucide-react";

const links = [
  { to: "/", label: "Início" },
  { to: "/aprender", label: "Aprender" },
  { to: "/praticar", label: "Praticar" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
            <Hand className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            Mãos que Falam
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-medium bg-secondary text-primary" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
