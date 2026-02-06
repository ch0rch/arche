'use client'

import { useCallback, useEffect, useState } from 'react'

import { AddConnectorModal } from '@/components/connectors/add-connector-modal'
import { ConnectorList } from '@/components/connectors/connector-list'
import type {
  ConnectorListItem,
  ConnectorTestResult,
  ConnectorTestState,
} from '@/components/connectors/types'
import { Button } from '@/components/ui/button'

type ConnectorsPageClientProps = {
  slug: string
}

function toConnectorListItemArray(value: unknown): ConnectorListItem[] {
  if (!value || typeof value !== 'object' || !('connectors' in value)) return []
  const data = value as { connectors?: ConnectorListItem[] }
  return Array.isArray(data.connectors) ? data.connectors : []
}

function getResponseError(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object') return fallback
  if ('message' in value && typeof value.message === 'string') return value.message
  if ('error' in value && typeof value.error === 'string') return value.error
  return fallback
}

function formatTestResult(result: ConnectorTestResult): ConnectorTestState {
  if (result.ok) {
    return { status: 'success', message: result.message ?? 'Conexión correcta.' }
  }

  if (!result.tested) {
    return {
      status: 'error',
      message: result.message ?? 'Verificación real no implementada para este conector.',
    }
  }

  return { status: 'error', message: result.message ?? 'Test fallido.' }
}

export function ConnectorsPageClient({ slug }: ConnectorsPageClientProps) {
  const [connectors, setConnectors] = useState<ConnectorListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyConnectorIds, setBusyConnectorIds] = useState<Record<string, boolean>>({})
  const [testStates, setTestStates] = useState<Record<string, ConnectorTestState>>({})

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null)

  const markConnectorBusy = useCallback((id: string, busy: boolean) => {
    setBusyConnectorIds((current) => {
      if (!busy) {
        const next = { ...current }
        delete next[id]
        return next
      }
      return { ...current, [id]: true }
    })
  }, [])

  const loadConnectors = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const response = await fetch(`/api/u/${slug}/connectors`, { cache: 'no-store' })
      const data = (await response.json().catch(() => null)) as unknown

      if (!response.ok) {
        setLoadError(getResponseError(data, 'load_failed'))
        return
      }

      setConnectors(toConnectorListItemArray(data))
      setActionError(null)
    } catch {
      setLoadError('network_error')
    } finally {
      setIsLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void loadConnectors()
  }, [loadConnectors])

  const handleCreate = useCallback(() => {
    setEditingConnectorId(null)
    setIsModalOpen(true)
  }, [])

  const handleEdit = useCallback((id: string) => {
    setEditingConnectorId(id)
    setIsModalOpen(true)
  }, [])

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      const confirmed = window.confirm(`¿Eliminar el conector "${name}"?`)
      if (!confirmed) return

      markConnectorBusy(id, true)
      setActionError(null)

      try {
        const response = await fetch(`/api/u/${slug}/connectors/${id}`, {
          method: 'DELETE',
        })
        const data = (await response.json().catch(() => null)) as unknown

        if (!response.ok) {
          setActionError(getResponseError(data, 'delete_failed'))
          return
        }

        setConnectors((current) => current.filter((connector) => connector.id !== id))
        setTestStates((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
      } catch {
        setActionError('network_error')
      } finally {
        markConnectorBusy(id, false)
      }
    },
    [markConnectorBusy, slug]
  )

  const handleToggleEnabled = useCallback(
    async (id: string, currentEnabled: boolean) => {
      markConnectorBusy(id, true)
      setActionError(null)

      try {
        const response = await fetch(`/api/u/${slug}/connectors/${id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: !currentEnabled }),
        })
        const data = (await response.json().catch(() => null)) as
          | { enabled?: boolean; error?: string; message?: string }
          | null

        if (!response.ok) {
          setActionError(getResponseError(data, 'update_failed'))
          return
        }

        setConnectors((current) =>
          current.map((connector) =>
            connector.id === id
              ? { ...connector, enabled: data?.enabled ?? !currentEnabled }
              : connector
          )
        )
      } catch {
        setActionError('network_error')
      } finally {
        markConnectorBusy(id, false)
      }
    },
    [markConnectorBusy, slug]
  )

  const handleTestConnection = useCallback(
    async (id: string) => {
      markConnectorBusy(id, true)

      try {
        const response = await fetch(`/api/u/${slug}/connectors/${id}/test`, {
          method: 'POST',
        })
        const data = (await response.json().catch(() => null)) as
          | (ConnectorTestResult & { error?: string; message?: string })
          | null

        if (!response.ok || !data) {
          setTestStates((current) => ({
            ...current,
            [id]: {
              status: 'error',
              message: getResponseError(data, 'test_failed'),
            },
          }))
          return
        }

        setTestStates((current) => ({ ...current, [id]: formatTestResult(data) }))
      } catch {
        setTestStates((current) => ({
          ...current,
          [id]: { status: 'error', message: 'network_error' },
        }))
      } finally {
        markConnectorBusy(id, false)
      }
    },
    [markConnectorBusy, slug]
  )

  return (
    <main className="relative mx-auto max-w-6xl px-6 py-10">
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
              Conectores
            </h1>
            <p className="text-muted-foreground">Configura las integraciones para tu workspace.</p>
          </div>
          <Button onClick={handleCreate}>Añadir conector</Button>
        </div>

        {actionError ? (
          <div className="rounded-lg border border-border/60 bg-card/50 p-4 text-sm text-destructive">
            La acción no se pudo completar: {actionError}
          </div>
        ) : null}

        <ConnectorList
          connectors={connectors}
          loadError={loadError}
          isLoading={isLoading}
          busyConnectorIds={busyConnectorIds}
          testStates={testStates}
          onRetry={loadConnectors}
          onCreateFirst={handleCreate}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleEnabled={handleToggleEnabled}
          onTestConnection={handleTestConnection}
        />
      </div>

      <AddConnectorModal
        slug={slug}
        open={isModalOpen}
        connectorId={editingConnectorId}
        onOpenChange={setIsModalOpen}
        onSaved={loadConnectors}
      />
    </main>
  )
}
