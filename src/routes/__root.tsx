import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="page-grid flex min-h-screen items-center justify-center bg-background px-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] bg-navy p-8 text-center text-white shadow-elegant sm:p-12">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[36px] border-primary/10" />
        <div className="relative">
          <p className="text-8xl font-black tracking-[-0.06em] text-primary">404</p>
          <h1 className="mt-4 text-2xl font-black">Esta página não foi encontrada</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            O endereço pode ter mudado. Volte ao início para continuar aprendendo.
          </p>
          <Link
            to="/"
            className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-primary px-6 text-sm font-bold text-primary-foreground shadow-elegant transition-transform hover:-translate-y-0.5"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="page-grid flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-[2rem] border border-border bg-white p-8 text-center shadow-elegant sm:p-12">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-2xl">
          !
        </span>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Algo não saiu como esperado. Tente novamente ou retorne ao início.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-input bg-background px-5 text-sm font-bold text-foreground transition-colors hover:bg-secondary"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mãos que Falam" },
      {
        name: "description",
        content: "Aplicação educacional para aprender Libras com apoio da câmera.",
      },
      { name: "author", content: "Ryan Santos" },
      { property: "og:title", content: "Mãos que Falam" },
      {
        property: "og:description",
        content: "Aprenda o alfabeto manual e pratique Libras com detecção de mãos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
