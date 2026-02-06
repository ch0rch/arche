import Link from "next/link";

import { ConnectorsWidget } from '@/components/dashboard/connectors-widget'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { listRecentKbFileUpdates, readCommonWorkspaceConfig } from '@/lib/common-workspace-config-store'
import { getAgentSummaries, parseCommonWorkspaceConfig } from '@/lib/workspace-config'
import { Badge } from "@/components/ui/badge";

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
    <main className="relative mx-auto max-w-6xl px-6 py-6">
      {/* Hero */}
      <DashboardHero slug={slug} />

      {/* Sections grid */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* Recent Activity */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Recent Activity
            </h2>
          </div>

          <div className="glass-panel rounded-xl">
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

        {/* Agents & Connectors */}
        <div className="space-y-8">
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
                <div className="glass-panel rounded-lg px-4 py-3 text-sm text-muted-foreground">
                  No agents configured.
                </div>
              ) : (
                agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="glass-panel flex items-center justify-between rounded-lg px-4 py-3"
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
            <ConnectorsWidget slug={slug} />
          </section>
        </div>
      </div>
    </main>
  );
}
