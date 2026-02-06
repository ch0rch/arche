import type { ConnectorType } from '@/lib/connectors/types'

export type ConnectorListItem = {
  id: string
  type: ConnectorType
  name: string
  enabled: boolean
  createdAt: string
}

export type ConnectorDetail = {
  id: string
  type: ConnectorType
  name: string
  config: Record<string, unknown>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type ConnectorTestResult = {
  ok: boolean
  tested: boolean
  message?: string
}

export type ConnectorTestState = {
  status: 'success' | 'error'
  message: string
}
