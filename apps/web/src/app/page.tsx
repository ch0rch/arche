"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Result = {
  action: string;
  status: number;
  body?: string;
};

export default function Home() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("change-me");
  const [host, setHost] = useState("u-admin.arche.lvh.me");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("login");
    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const text = await response.text();
      let body = text;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // keep raw text
      }
      setResult({ action: "login", status: response.status, body });
    } catch (error) {
      setResult({ action: "login", status: 0, body: String(error) });
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = async () => {
    setBusy("logout");
    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      const text = await response.text();
      setResult({ action: "logout", status: response.status, body: text || "(empty)" });
    } catch (error) {
      setResult({ action: "logout", status: 0, body: String(error) });
    } finally {
      setBusy(null);
    }
  };

  const handleForwardAuth = async () => {
    setBusy("forwardauth");
    try {
      const response = await fetch("/auth/traefik", {
        headers: { "X-Forwarded-Host": host },
        credentials: "include",
      });
      setResult({ action: "forwardAuth", status: response.status, body: "(no body)" });
    } catch (error) {
      setResult({ action: "forwardAuth", status: 0, body: String(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 organic-background opacity-70" />
      <div className="pointer-events-none absolute -left-24 top-[-6rem] h-[18rem] w-[18rem] rounded-full bg-[hsl(32_85%_90%_/_0.55)] blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-[4rem] h-[22rem] w-[22rem] rounded-full bg-[hsl(24_90%_85%_/_0.5)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-14rem] left-[10%] h-[26rem] w-[26rem] rounded-full bg-[hsl(40_70%_92%_/_0.6)] blur-3xl" />

      <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-16 lg:gap-14">
        <header className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-primary shadow-none">
              Arche Control Room
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full border border-border/70 bg-card/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/70 shadow-none"
            >
              Stack: Traefik + Postgres + Web
            </Badge>
          </div>
          <h1 className="max-w-3xl font-[family:var(--font-fraunces)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Sesiones, routing y verificacion de{" "}
            <span className="text-primary">acceso</span> en un solo panel.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Este entorno esta pensado para validar auth local, cookies httpOnly y el
            flujo de forwardAuth antes de integrar UI completa. Usa el formulario
            para iniciar sesion y comprobar hosts con aislamiento por slug.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-full border border-primary/30 bg-primary/15 px-8 text-[11px] font-semibold uppercase tracking-[0.35em] text-primary shadow-none hover:bg-primary/20 hover:text-primary"
            >
              <a href="#auth-console">Probar login</a>
            </Button>
            <Button
              asChild
              className="h-11 rounded-full bg-primary px-8 text-[11px] font-semibold uppercase tracking-[0.35em] text-primary-foreground shadow-none hover:bg-primary/90"
            >
              <a href="#latest-response">Ver ultima respuesta</a>
            </Button>
          </div>
        </header>

        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-primary/70">
                Checks
              </p>
              <h2 className="text-2xl font-semibold font-[family:var(--font-fraunces)]">
                Quick checks
              </h2>
            </div>
            <Badge
              variant="secondary"
              className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.35em] text-primary/80 shadow-none"
            >
              Local only
            </Badge>
          </div>
          <div className="overflow-hidden rounded-none border border-dashed border-border/70 bg-card/50">
            <div className="flex flex-col divide-y divide-dashed divide-border/70 lg:flex-row lg:divide-y-0 lg:divide-x">
              {[
                {
                  title: "Login local",
                  description: "Email + password con sesion persistida en Postgres.",
                },
                {
                  title: "Cookies",
                  description: "Cookie httpOnly y TTL configurable por entorno.",
                },
                {
                  title: "ForwardAuth",
                  description: "Validacion de host y slug para u-<slug>.",
                },
                {
                  title: "Auditoria",
                  description: "Eventos de auth registrados como audit_events.",
                },
              ].map((item, index) => (
                <div key={item.title} className="flex-1 space-y-4 p-6">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-primary/70">
                    <span>Check</span>
                    {index === 1 ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-primary">
                        Popular
                      </span>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-primary/70" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold font-[family:var(--font-fraunces)] text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card
            id="latest-response"
            className="rounded-lg border border-border/70 bg-card/70 shadow-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-700 [animation-delay:120ms]"
          >
            <CardHeader className="space-y-3 border-b border-border/60 pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em]">
                Ultima respuesta
              </CardTitle>
              <CardDescription>
                Resumen del ultimo request ejecutado.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-md border border-border/60 bg-card/80 p-4">
                {result ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full border border-primary/30 bg-primary/10 text-primary">
                        {result.action}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="rounded-full border border-border/60 bg-card/80 text-muted-foreground"
                      >
                        status {result.status}
                      </Badge>
                    </div>
                    <pre className="whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                      {result.body || "(empty)"}
                    </pre>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No requests yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card
            id="auth-console"
            className="rounded-lg border border-primary/20 bg-accent/40 shadow-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-700 [animation-delay:220ms]"
          >
            <CardHeader className="space-y-3 border-b border-primary/20 pb-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl font-[family:var(--font-fraunces)]">
                  Auth console
                </CardTitle>
                <Badge className="rounded-full border border-primary/30 bg-primary/10 text-primary">
                  Popular
                </Badge>
              </div>
              <CardDescription>
                Usa las credenciales seed para iniciar sesion y revisar el estado
                del endpoint de Traefik.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="rounded-md border border-border/60 bg-card/90 shadow-none"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="rounded-md border border-border/60 bg-card/90 shadow-none"
                    required
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    disabled={busy !== null}
                    className="flex-1 rounded-full shadow-none"
                  >
                    {busy === "login" ? "Logging in..." : "Login"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={handleLogout}
                    className="flex-1 rounded-full border border-primary/30 bg-primary/15 text-primary shadow-none hover:bg-primary/20 hover:text-primary"
                  >
                    {busy === "logout" ? "Logging out..." : "Logout"}
                  </Button>
                </div>
              </form>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="forward-host">ForwardAuth host</Label>
                  <Input
                    id="forward-host"
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                    placeholder="u-admin.arche.lvh.me"
                    className="rounded-md border border-border/60 bg-card/90 shadow-none"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleForwardAuth}
                  disabled={busy !== null}
                  className="w-full rounded-full shadow-none"
                >
                  {busy === "forwardauth" ? "Checking..." : "Check forwardAuth"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Tip: abre <span className="font-semibold">arche.lvh.me</span> para usar
                  la cookie del dominio y probar el routing con Traefik.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
