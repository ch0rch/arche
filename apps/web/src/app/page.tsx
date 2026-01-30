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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-16">
        <header className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Arche Control Room</Badge>
            <Badge variant="outline">Stack: Traefik + Postgres + Web</Badge>
          </div>
          <h1 className="max-w-3xl font-[family:var(--font-fraunces)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Sesiones, routing y verificacion de acceso en un solo panel.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Este entorno esta pensado para validar auth local, cookies httpOnly y el
            flujo de forwardAuth antes de integrar UI completa. Usa el formulario
            para iniciar sesion y comprobar hosts con aislamiento por slug.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em]">
                  Quick checks
                </CardTitle>
                <CardDescription>
                  Validaciones clave para el BFF y el edge en local.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
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
                ].map((item) => (
                  <div key={item.title} className="rounded-lg border bg-muted/50 p-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em]">
                  Ultima respuesta
                </CardTitle>
                <CardDescription>
                  Resumen del ultimo request ejecutado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-background/80 p-4">
                  {result ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{result.action}</Badge>
                        <Badge variant="secondary">status {result.status}</Badge>
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {result.body || "(empty)"}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No requests yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Auth console</CardTitle>
              <CardDescription>
                Usa las credenciales seed para iniciar sesion y revisar el estado
                del endpoint de Traefik.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                    required
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" disabled={busy !== null} className="flex-1">
                    {busy === "login" ? "Logging in..." : "Login"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={handleLogout}
                    className="flex-1"
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
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleForwardAuth}
                  disabled={busy !== null}
                  className="w-full"
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
