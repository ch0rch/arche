import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from "next/link";

import { getSessionFromToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { listRecentKbFileUpdates, readCommonWorkspaceConfig } from '@/lib/common-workspace-config-store'
import { getAgentSummaries, parseCommonWorkspaceConfig } from '@/lib/workspace-config'
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navigation = (slug: string) => [
  { label: "Overview", href: `/u/${slug}`, active: true },
  { label: "Agents", href: `/u/${slug}/agents` },
  { label: "Connectors", href: `/u/${slug}/connectors` },
  { label: "Team", href: `/u/${slug}/team` },
  { label: "Settings", href: "/settings/security" },
];

const connectors = [
  { name: "HubSpot", status: "Daily sync" },
  { name: "Linear", status: "Real-time" },
  { name: "Notion", status: "Daily sync" },
  { name: "Slack", status: "Real-time" },
];

function formatCommitTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Verificar autenticación
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  
  if (!token) {
    redirect('/login')
  }

  const session = await getSessionFromToken(token)
  if (!session) {
    redirect('/login')
  }

  // Verificar autorización
  if (session.user.slug !== slug && session.user.role !== 'ADMIN') {
    redirect(`/u/${session.user.slug}`)
  }

  const configResult = await readCommonWorkspaceConfig()
  const parsedConfig = configResult.ok ? parseCommonWorkspaceConfig(configResult.content) : null
  const agents = parsedConfig?.ok
    ? getAgentSummaries(parsedConfig.config)
      .sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1
        if (!a.isPrimary && b.isPrimary) return 1
        return a.displayName.localeCompare(b.displayName)
      })
      .slice(0, 4)
    : []

  const recentUpdatesResult = await listRecentKbFileUpdates(10)
  const recentUpdates = recentUpdatesResult.ok ? recentUpdatesResult.updates : []

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 organic-background" />

      {/* Header */}
      <header className="relative border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-lg font-semibold"
            >
              Arche
            </Link>
            <span className="text-sm text-muted-foreground">{slug}</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {navigation(slug).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  item.active
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-10">
        {/* Page header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <div className="flex gap-3">
            <Button asChild>
              <Link href={`/w/${slug}`}>Open workspace</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/u/${slug}/connectors`}>Add connector</Link>
            </Button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Recent Activity
              </h2>
              <span className="text-xs text-muted-foreground">Last 10 file updates</span>
            </div>

            <div className="rounded-xl border border-border/60 bg-card/50">
              {recentUpdates.length === 0 ? (
                <div className="px-5 py-8 text-sm text-muted-foreground">
                  No file activity available yet.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentUpdates.map((item) => (
                    <div key={`${item.filePath}-${item.committedAt}`} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.fileName}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.filePath}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-foreground">{item.author}</p>
                          <p className="text-xs text-muted-foreground">{formatCommitTime(item.committedAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-8">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">Agents</h2>
                <Link
                  href={`/u/${slug}/agents`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {agents.length === 0 ? (
                  <div className="rounded-lg border border-border/60 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
                    No agents configured.
                  </div>
                ) : (
                  agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 px-4 py-3"
                    >
                      <span className="text-sm text-foreground">{agent.displayName}</span>
                      <Badge variant={agent.isPrimary ? "default" : "secondary"}>
                        {agent.isPrimary ? 'Primary' : 'Secondary'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">Connectors</h2>
                <Link
                  href={`/u/${slug}/connectors`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {connectors.map((connector) => (
                  <div
                    key={connector.name}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 px-4 py-3"
                  >
                    <span className="text-sm text-foreground">{connector.name}</span>
                    <span className="text-xs text-muted-foreground">{connector.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
