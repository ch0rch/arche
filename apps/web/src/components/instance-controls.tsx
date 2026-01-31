'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  startInstanceAction,
  stopInstanceAction,
  getInstanceStatusAction,
} from '@/actions/spawner'

type InstanceState = {
  status: string
  slowStart: boolean
  startedAt?: Date | null
  stoppedAt?: Date | null
  lastActivityAt?: Date | null
}

const STATUS_LABELS: Record<string, string> = {
  stopped: 'Detenido',
  starting: 'Iniciando…',
  running: 'Activo',
  error: 'Error',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  stopped: 'secondary',
  starting: 'outline',
  running: 'default',
  error: 'destructive',
}

export function InstanceControls({ slug }: { slug: string }) {
  const [state, setState] = useState<InstanceState>({ status: 'stopped', slowStart: false })
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const result = await getInstanceStatusAction(slug)
    if (result) setState(result)
  }, [slug])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [refresh])

  function handleStart() {
    setError(null)
    startTransition(async () => {
      const result = await startInstanceAction(slug)
      if (!result.ok) {
        setError(result.error)
      }
      await refresh()
    })
  }

  function handleStop() {
    setError(null)
    startTransition(async () => {
      const result = await stopInstanceAction(slug)
      if (!result.ok) {
        setError(result.error)
      }
      await refresh()
    })
  }

  const isRunning = state.status === 'running'
  const isStarting = state.status === 'starting'
  const isStopped = state.status === 'stopped' || state.status === 'error'

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-medium text-foreground">OpenCode</h3>
          <p className="text-sm text-muted-foreground">Instancia de desarrollo</p>
        </div>
        <Badge variant={STATUS_VARIANTS[state.status] ?? 'secondary'}>
          {STATUS_LABELS[state.status] ?? state.status}
        </Badge>
      </div>

      {state.slowStart && (
        <p className="text-sm text-yellow-600">
          Tardando más de lo esperado…
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive">
          Error: {error}
        </p>
      )}

      <div className="flex gap-3">
        {isStopped && (
          <Button onClick={handleStart} disabled={isPending}>
            {isPending ? 'Iniciando…' : 'Iniciar'}
          </Button>
        )}
        {(isRunning || isStarting) && (
          <Button variant="outline" onClick={handleStop} disabled={isPending}>
            {isPending ? 'Deteniendo…' : 'Detener'}
          </Button>
        )}
      </div>
    </div>
  )
}
