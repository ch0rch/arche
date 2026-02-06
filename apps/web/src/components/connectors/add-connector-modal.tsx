'use client'

import { useEffect, useState } from 'react'

import type { ConnectorDetail, ConnectorTestResult } from '@/components/connectors/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CONNECTOR_TYPES, type ConnectorType } from '@/lib/connectors/types'

type AddConnectorModalProps = {
  slug: string
  open: boolean
  connectorId: string | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

type Step = 1 | 2 | 3

type TestStatus = {
  tone: 'success' | 'error'
  message: string
}

const CONNECTOR_TYPE_OPTIONS: { type: ConnectorType; label: string; description: string }[] = [
  { type: 'linear', label: 'Linear', description: 'Sincroniza tareas y proyectos de Linear.' },
  { type: 'notion', label: 'Notion', description: 'Conecta páginas y bases de conocimiento de Notion.' },
  { type: 'slack', label: 'Slack', description: 'Interopera con canales y mensajes de Slack.' },
  { type: 'github', label: 'GitHub', description: 'Accede a repositorios, issues y pull requests.' },
  { type: 'custom', label: 'Custom', description: 'Conector remoto configurable por endpoint HTTP.' },
]

const DEFAULT_TYPE: ConnectorType = CONNECTOR_TYPES[0]

function buildDefaultName(type: ConnectorType): string {
  switch (type) {
    case 'linear':
      return 'Linear'
    case 'notion':
      return 'Notion'
    case 'slack':
      return 'Slack'
    case 'github':
      return 'GitHub'
    case 'custom':
      return 'Custom Connector'
    default:
      return 'Connector'
  }
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  for (const entry of Object.values(value)) {
    if (typeof entry !== 'string') return false
  }
  return true
}

function formatTestMessage(result: ConnectorTestResult): TestStatus {
  if (result.ok) {
    return { tone: 'success', message: result.message ?? 'Conexión verificada correctamente.' }
  }

  if (!result.tested) {
    return {
      tone: 'error',
      message: result.message ?? 'La verificación real aún no está implementada para este conector.',
    }
  }

  return { tone: 'error', message: result.message ?? 'La prueba de conexión falló.' }
}

function hasValidHeaders(headersText: string): boolean {
  if (!headersText.trim()) return true
  try {
    const parsed = JSON.parse(headersText) as unknown
    return isStringRecord(parsed)
  } catch {
    return false
  }
}

export function AddConnectorModal({
  slug,
  open,
  connectorId,
  onOpenChange,
  onSaved,
}: AddConnectorModalProps) {
  const isEditMode = Boolean(connectorId)
  const [step, setStep] = useState<Step>(1)
  const [selectedType, setSelectedType] = useState<ConnectorType>(DEFAULT_TYPE)
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)

  const [apiKey, setApiKey] = useState('')
  const [botToken, setBotToken] = useState('')
  const [teamId, setTeamId] = useState('')
  const [appToken, setAppToken] = useState('')
  const [token, setToken] = useState('')
  const [org, setOrg] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [auth, setAuth] = useState('')
  const [headersText, setHeadersText] = useState('')

  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<TestStatus | null>(null)

  function resetState(): void {
    setStep(1)
    setSelectedType(DEFAULT_TYPE)
    setName('')
    setEnabled(true)
    setApiKey('')
    setBotToken('')
    setTeamId('')
    setAppToken('')
    setToken('')
    setOrg('')
    setEndpoint('')
    setAuth('')
    setHeadersText('')
    setIsLoadingDetail(false)
    setIsSaving(false)
    setIsTesting(false)
    setError(null)
    setTestStatus(null)
  }

  useEffect(() => {
    if (!open) {
      resetState()
      return
    }

    if (!connectorId) {
      setStep(1)
      setName(buildDefaultName(DEFAULT_TYPE))
      return
    }

    setStep(2)
    setError(null)
    setTestStatus(null)
    setIsLoadingDetail(true)

    fetch(`/api/u/${slug}/connectors/${connectorId}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | (ConnectorDetail & { error?: string; message?: string })
          | null

        if (!response.ok || !data) {
          setError(data?.message ?? data?.error ?? 'load_failed')
          return
        }

        setSelectedType(data.type)
        setName(data.name)
        setEnabled(data.enabled)

        const config = data.config

        switch (data.type) {
          case 'linear':
          case 'notion':
            setApiKey(getString(config.apiKey))
            break
          case 'slack':
            setBotToken(getString(config.botToken))
            setTeamId(getString(config.teamId))
            setAppToken(getString(config.appToken))
            break
          case 'github':
            setToken(getString(config.token))
            setOrg(getString(config.org))
            break
          case 'custom':
            setEndpoint(getString(config.endpoint))
            setAuth(getString(config.auth))
            if (isStringRecord(config.headers)) {
              setHeadersText(JSON.stringify(config.headers, null, 2))
            }
            break
          default:
            break
        }
      })
      .catch(() => {
        setError('network_error')
      })
      .finally(() => {
        setIsLoadingDetail(false)
      })
  }, [connectorId, open, slug])

  useEffect(() => {
    if (!open || isEditMode) return
    setName((currentName) => (currentName.trim() ? currentName : buildDefaultName(selectedType)))
  }, [isEditMode, open, selectedType])

  function buildConfig(): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
    switch (selectedType) {
      case 'linear':
      case 'notion': {
        if (!apiKey.trim()) {
          return { ok: false, message: 'API Key es obligatorio.' }
        }
        return { ok: true, value: { apiKey: apiKey.trim() } }
      }
      case 'slack': {
        if (!botToken.trim() || !teamId.trim()) {
          return { ok: false, message: 'Bot Token y Team ID son obligatorios.' }
        }
        return {
          ok: true,
          value: {
            botToken: botToken.trim(),
            teamId: teamId.trim(),
            appToken: appToken.trim() || undefined,
          },
        }
      }
      case 'github': {
        if (!token.trim()) {
          return { ok: false, message: 'Token es obligatorio.' }
        }
        return {
          ok: true,
          value: {
            token: token.trim(),
            org: org.trim() || undefined,
          },
        }
      }
      case 'custom': {
        if (!endpoint.trim()) {
          return { ok: false, message: 'Endpoint es obligatorio.' }
        }

        if (!headersText.trim()) {
          return {
            ok: true,
            value: {
              endpoint: endpoint.trim(),
              auth: auth.trim() || undefined,
            },
          }
        }

        try {
          const parsed = JSON.parse(headersText) as unknown
          if (!isStringRecord(parsed)) {
            return {
              ok: false,
              message: 'Headers debe ser un objeto JSON con valores string.',
            }
          }

          return {
            ok: true,
            value: {
              endpoint: endpoint.trim(),
              auth: auth.trim() || undefined,
              headers: parsed,
            },
          }
        } catch {
          return { ok: false, message: 'Headers no es un JSON válido.' }
        }
      }
      default:
        return { ok: false, message: 'Tipo de conector no soportado.' }
    }
  }

  async function handleTestConnection() {
    if (!connectorId) {
      setTestStatus({
        tone: 'error',
        message: 'Guarda primero el conector para poder probar la conexión.',
      })
      return
    }

    setIsTesting(true)
    setError(null)
    setTestStatus(null)

    try {
      const response = await fetch(`/api/u/${slug}/connectors/${connectorId}/test`, {
        method: 'POST',
      })
      const data = (await response.json().catch(() => null)) as
        | (ConnectorTestResult & { error?: string; message?: string })
        | null

      if (!response.ok || !data) {
        setTestStatus({
          tone: 'error',
          message: data?.message ?? data?.error ?? 'test_failed',
        })
        return
      }

      setTestStatus(formatTestMessage(data))
    } catch {
      setTestStatus({ tone: 'error', message: 'network_error' })
    } finally {
      setIsTesting(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    const configResult = buildConfig()
    if (!configResult.ok) {
      setError(configResult.message)
      return
    }

    setIsSaving(true)
    setError(null)

    const payload = isEditMode
      ? {
          name: name.trim(),
          enabled,
          config: configResult.value,
        }
      : {
          type: selectedType,
          name: name.trim(),
          config: configResult.value,
        }

    try {
      const response = await fetch(
        isEditMode
          ? `/api/u/${slug}/connectors/${connectorId}`
          : `/api/u/${slug}/connectors`,
        {
          method: isEditMode ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null

      if (!response.ok) {
        setError(data?.message ?? data?.error ?? 'save_failed')
        return
      }

      onSaved()
      onOpenChange(false)
    } catch {
      setError('network_error')
    } finally {
      setIsSaving(false)
    }
  }

  function handleBackStep() {
    if (step === 3) {
      setStep(2)
      return
    }

    if (step === 2 && !isEditMode) {
      setStep(1)
    }
  }

  function isConfigurationComplete(): boolean {
    if (!name.trim()) return false

    switch (selectedType) {
      case 'linear':
      case 'notion':
        return Boolean(apiKey.trim())
      case 'slack':
        return Boolean(botToken.trim() && teamId.trim())
      case 'github':
        return Boolean(token.trim())
      case 'custom':
        return Boolean(endpoint.trim() && hasValidHeaders(headersText))
      default:
        return false
    }
  }

  const totalSteps = isEditMode ? 2 : 3
  const currentStepNumber = isEditMode ? step - 1 : step

  function renderTypeStep() {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {CONNECTOR_TYPE_OPTIONS.map((option) => {
          const isSelected = option.type === selectedType
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => {
                setSelectedType(option.type)
                setError(null)
              }}
              className={`rounded-lg border p-4 text-left transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border/60 bg-card/40 hover:border-border'
              }`}
            >
              <p className="font-medium">{option.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
            </button>
          )
        })}
      </div>
    )
  }

  function renderConfigurationStep() {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="connector-name">Nombre</Label>
          <Input
            id="connector-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del conector"
          />
          <p className="text-xs text-muted-foreground">Se mostrará en la lista de conectores de tu workspace.</p>
        </div>

        {isEditMode ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Habilitado
          </label>
        ) : null}

        {(selectedType === 'linear' || selectedType === 'notion') && (
          <div className="space-y-2">
            <Label htmlFor="connector-api-key">API Key</Label>
            <Input
              id="connector-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">Campo obligatorio.</p>
          </div>
        )}

        {selectedType === 'slack' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="connector-bot-token">Bot Token</Label>
              <Input
                id="connector-bot-token"
                type="password"
                value={botToken}
                onChange={(event) => setBotToken(event.target.value)}
                placeholder="xoxb-..."
              />
              <p className="text-xs text-muted-foreground">Campo obligatorio.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="connector-team-id">Team ID</Label>
              <Input
                id="connector-team-id"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                placeholder="T123..."
              />
              <p className="text-xs text-muted-foreground">Campo obligatorio.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="connector-app-token">App Token (opcional)</Label>
              <Input
                id="connector-app-token"
                type="password"
                value={appToken}
                onChange={(event) => setAppToken(event.target.value)}
                placeholder="xapp-..."
              />
            </div>
          </>
        )}

        {selectedType === 'github' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="connector-token">Token</Label>
              <Input
                id="connector-token"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="ghp_..."
              />
              <p className="text-xs text-muted-foreground">Campo obligatorio.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="connector-org">Organization (opcional)</Label>
              <Input
                id="connector-org"
                value={org}
                onChange={(event) => setOrg(event.target.value)}
                placeholder="peaberry-studio"
              />
            </div>
          </>
        )}

        {selectedType === 'custom' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="connector-endpoint">Endpoint</Label>
              <Input
                id="connector-endpoint"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="https://example.com/mcp"
              />
              <p className="text-xs text-muted-foreground">Campo obligatorio.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="connector-auth">Auth token (opcional)</Label>
              <Input
                id="connector-auth"
                type="password"
                value={auth}
                onChange={(event) => setAuth(event.target.value)}
                placeholder="token"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="connector-headers">Headers JSON (opcional)</Label>
              <textarea
                id="connector-headers"
                className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
                value={headersText}
                onChange={(event) => setHeadersText(event.target.value)}
                placeholder={'{\n  "x-api-key": "value"\n}'}
              />
            </div>
          </>
        )}
      </div>
    )
  }

  function renderTestStep() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Puedes validar la conexión antes de cerrar el modal.
        </p>

        {isEditMode ? (
          <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? 'Probando...' : 'Probar conexión'}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            La prueba de conexión está disponible tras guardar el conector.
          </p>
        )}

        {testStatus ? (
          <p className={testStatus.tone === 'success' ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>
            {testStatus.message}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar conector' : 'Añadir conector'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Actualiza la configuración de este conector.'
              : 'Configura un nuevo conector para tu workspace.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            Paso {currentStepNumber} de {totalSteps}
          </span>
          {!isEditMode ? (
            <div className="flex items-center gap-2">
              <span className={step === 1 ? 'font-semibold text-foreground' : ''}>1. Tipo</span>
              <span>•</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className={step === 2 ? 'font-semibold text-foreground' : ''}>2. Configuración</span>
            <span>•</span>
            <span className={step === 3 ? 'font-semibold text-foreground' : ''}>3. Test y guardado</span>
          </div>
        </div>

        {isLoadingDetail ? <p className="text-sm text-muted-foreground">Cargando conector...</p> : null}
        {!isLoadingDetail && step === 1 ? renderTypeStep() : null}
        {!isLoadingDetail && step === 2 ? renderConfigurationStep() : null}
        {!isLoadingDetail && step === 3 ? renderTestStep() : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          {step > 1 && (!isEditMode || step > 2) ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBackStep}
              disabled={isSaving || isTesting || isLoadingDetail}
            >
              Atrás
            </Button>
          ) : null}

          {step === 1 ? (
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={isLoadingDetail}
            >
              Continuar
            </Button>
          ) : null}

          {step === 2 ? (
            <Button
              type="button"
              onClick={() => {
                setError(null)
                setStep(3)
              }}
              disabled={isLoadingDetail || !isConfigurationComplete()}
            >
              Continuar
            </Button>
          ) : null}

          {step === 3 ? (
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoadingDetail || isTesting || !isConfigurationComplete()}
            >
              {isSaving ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Guardar'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
