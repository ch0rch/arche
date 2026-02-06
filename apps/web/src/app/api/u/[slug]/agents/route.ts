import { NextRequest, NextResponse } from 'next/server'

import { auditEvent, getAuthenticatedUser } from '@/lib/auth'
import { readCommonWorkspaceConfig, writeCommonWorkspaceConfig } from '@/lib/common-workspace-config-store'
import {
  type CommonAgentConfig,
  type CommonWorkspaceConfig,
  createDefaultCommonWorkspaceConfig,
  ensurePrimaryAgent,
  generateAgentId,
  getAgentSummaries,
  parseCommonWorkspaceConfig,
  validateCommonWorkspaceConfig
} from '@/lib/workspace-config'

export type AgentListItem = {
  id: string
  displayName: string
  description?: string
  model?: string
  temperature?: number
  isPrimary: boolean
}

type AgentsListResponse = {
  agents: AgentListItem[]
  hash?: string
}

type CreateAgentRequest = {
  id?: string
  displayName?: string
  name?: string
  description?: string
  model?: string
  temperature?: number
  prompt?: string
  isPrimary?: boolean
  expectedHash?: string
}

async function loadCommonConfig() {
  const result = await readCommonWorkspaceConfig()
  if (!result.ok) {
    return { ok: false as const, error: result.error }
  }

  const parsed = parseCommonWorkspaceConfig(result.content)
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error }
  }

  const validation = validateCommonWorkspaceConfig(parsed.config)
  if (!validation.ok) {
    return { ok: false as const, error: validation.error ?? 'invalid_config' }
  }

  return {
    ok: true as const,
    config: parsed.config,
    hash: result.hash
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse<AgentsListResponse | { error: string }>> {
  const session = await getAuthenticatedUser()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  if (session.user.slug !== slug && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const configResult = await loadCommonConfig()
  if (!configResult.ok) {
    if (configResult.error === 'not_found') {
      return NextResponse.json({ agents: [] })
    }
    const status = configResult.error === 'kb_unavailable'
        ? 503
        : 500
    return NextResponse.json({ error: configResult.error }, { status })
  }

  const agents = getAgentSummaries(configResult.config)
    .map((agent) => ({
      id: agent.id,
      displayName: agent.displayName,
      description: agent.description,
      model: agent.model,
      temperature: agent.temperature,
      isPrimary: agent.isPrimary
    }))
    .sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1
      if (!a.isPrimary && b.isPrimary) return 1
      return a.displayName.localeCompare(b.displayName)
    })

  return NextResponse.json({ agents, hash: configResult.hash })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse<{ agent: AgentListItem; hash?: string } | { error: string; message?: string }>> {
  const session = await getAuthenticatedUser()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { slug } = await params

  let body: CreateAgentRequest
  try {
    body = await request.json()
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
    throw err
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const displayNameRaw = typeof body.displayName === 'string'
    ? body.displayName.trim()
    : typeof body.name === 'string'
      ? body.name.trim()
      : ''
  if (!displayNameRaw) {
    return NextResponse.json({ error: 'missing_display_name' }, { status: 400 })
  }

  const loadedConfig = await loadCommonConfig()
  const configResult = loadedConfig.ok
    ? loadedConfig
    : loadedConfig.error === 'not_found'
      ? {
          ok: true as const,
          config: createDefaultCommonWorkspaceConfig(),
          hash: undefined
        }
      : loadedConfig

  if (!configResult.ok) {
    const status = configResult.error === 'kb_unavailable' ? 503 : 500
    return NextResponse.json({ error: configResult.error }, { status })
  }

  const existingIds = Object.keys(configResult.config.agent ?? {})
  const explicitId = typeof body.id === 'string' ? body.id.trim() : ''
  const id = explicitId || generateAgentId(displayNameRaw, existingIds)

  if (id.includes('/') || /\s/.test(id)) {
    return NextResponse.json({ error: 'invalid_id', message: 'Agent id must not include spaces or slashes.' }, { status: 400 })
  }
  if (configResult.config.agent?.[id]) {
    return NextResponse.json({ error: 'agent_exists' }, { status: 409 })
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt : ''
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined
  const description = typeof body.description === 'string' && body.description.trim()
    ? body.description.trim()
    : undefined
  const temperature = typeof body.temperature === 'number' && Number.isFinite(body.temperature)
    ? body.temperature
    : undefined

  const newAgent: CommonAgentConfig = {
    display_name: displayNameRaw,
    description,
    mode: 'subagent',
    model,
    temperature,
    prompt,
    tools: {
      write: false,
      edit: false,
      bash: false
    }
  }

  const nextConfig: CommonWorkspaceConfig = {
    ...configResult.config,
    agent: {
      ...configResult.config.agent,
      [id]: newAgent
    }
  }

  const withPrimary = body.isPrimary ? ensurePrimaryAgent(nextConfig, id) : nextConfig
  const validation = validateCommonWorkspaceConfig(withPrimary)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error ?? 'invalid_config' }, { status: 400 })
  }

  const content = JSON.stringify(withPrimary, null, 2)
  const expectedHash = typeof body.expectedHash === 'string' && body.expectedHash
    ? body.expectedHash
    : configResult.hash

  const writeResult = await writeCommonWorkspaceConfig(content, expectedHash)
  if (!writeResult.ok) {
    const status = writeResult.error === 'conflict' ? 409 : 500
    return NextResponse.json({ error: writeResult.error ?? 'write_failed' }, { status })
  }

  await auditEvent({
    actorUserId: session.user.id,
    action: 'agent.created',
    metadata: { slug, agentId: id }
  })

  const createdAgent = getAgentSummaries(withPrimary).find((agent) => agent.id === id)
  if (!createdAgent) {
    return NextResponse.json({ error: 'agent_create_failed' }, { status: 500 })
  }

  return NextResponse.json({
    agent: {
      id: createdAgent.id,
      displayName: createdAgent.displayName,
      description: createdAgent.description,
      model: createdAgent.model,
      temperature: createdAgent.temperature,
      isPrimary: createdAgent.isPrimary
    },
    hash: writeResult.hash
  }, { status: 201 })
}
