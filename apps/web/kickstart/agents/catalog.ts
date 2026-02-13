import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  OPENCODE_AGENT_TOOLS,
  type OpenCodeAgentToolId,
} from '@/lib/agent-capabilities'
import type {
  KickstartAgentDefinition,
  KickstartAgentSummary,
} from '@/kickstart/types'

type ParsedAgentDefinition = {
  definition: KickstartAgentDefinition
  order: number
}

const AGENT_DEFINITION_KEYS = new Set([
  'id',
  'displayName',
  'description',
  'systemPrompt',
  'recommendedModel',
  'temperature',
  'tools',
  'order',
])

const AGENT_DEFINITION_DIR_CANDIDATES = [
  join(process.cwd(), 'kickstart/agents/definitions'),
  join(process.cwd(), 'apps/web/kickstart/agents/definitions'),
]

const AGENT_TOOL_SET = new Set<string>(OPENCODE_AGENT_TOOLS)

function hasOnlyAllowedKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => AGENT_DEFINITION_KEYS.has(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isOpenCodeAgentToolId(value: string): value is OpenCodeAgentToolId {
  return AGENT_TOOL_SET.has(value)
}

function parseNonEmptyString(value: unknown, fieldName: string, fileName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${fieldName} in kickstart agent definition: ${fileName}`)
  }

  return value.trim()
}

function parseSystemPrompt(value: unknown, fileName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid systemPrompt in kickstart agent definition: ${fileName}`)
  }

  return value
}

function parseTemperature(value: unknown, fileName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 2) {
    throw new Error(`Invalid temperature in kickstart agent definition: ${fileName}`)
  }

  return value
}

function parseOrder(value: unknown, fileName: string): number {
  if (value === undefined) {
    return 1000
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid order in kickstart agent definition: ${fileName}`)
  }

  return value
}

function parseTools(value: unknown, fileName: string): OpenCodeAgentToolId[] {
  if (value === 'all') {
    return [...OPENCODE_AGENT_TOOLS]
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid tools in kickstart agent definition: ${fileName}`)
  }

  const tools: OpenCodeAgentToolId[] = []
  const seen = new Set<OpenCodeAgentToolId>()

  for (const item of value) {
    if (typeof item !== 'string' || !isOpenCodeAgentToolId(item)) {
      throw new Error(`Unknown tool in kickstart agent definition: ${fileName}`)
    }

    if (seen.has(item)) {
      continue
    }

    seen.add(item)
    tools.push(item)
  }

  return tools
}

function parseAgentDefinition(raw: string, fileName: string): ParsedAgentDefinition {
  let parsedValue: unknown

  try {
    parsedValue = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid JSON in kickstart agent definition: ${fileName}`)
  }

  if (!isRecord(parsedValue) || !hasOnlyAllowedKeys(parsedValue)) {
    throw new Error(`Invalid object shape in kickstart agent definition: ${fileName}`)
  }

  const definition: KickstartAgentDefinition = {
    id: parseNonEmptyString(parsedValue.id, 'id', fileName),
    displayName: parseNonEmptyString(parsedValue.displayName, 'displayName', fileName),
    description: parseNonEmptyString(parsedValue.description, 'description', fileName),
    systemPrompt: parseSystemPrompt(parsedValue.systemPrompt, fileName),
    recommendedModel: parseNonEmptyString(parsedValue.recommendedModel, 'recommendedModel', fileName),
    temperature: parseTemperature(parsedValue.temperature, fileName),
    tools: parseTools(parsedValue.tools, fileName),
  }

  return {
    definition,
    order: parseOrder(parsedValue.order, fileName),
  }
}

function resolveAgentDefinitionDirectory(): string {
  for (const candidate of AGENT_DEFINITION_DIR_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Kickstart agent definitions directory not found. Tried: ${AGENT_DEFINITION_DIR_CANDIDATES.join(', ')}`
  )
}

function loadKickstartAgentCatalog(): KickstartAgentDefinition[] {
  const definitionsDirectory = resolveAgentDefinitionDirectory()
  const definitionFiles = readdirSync(definitionsDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))

  if (definitionFiles.length === 0) {
    throw new Error('No kickstart agent definitions were found')
  }

  const loadedDefinitions = definitionFiles.map((fileName) => {
    const filePath = join(definitionsDirectory, fileName)
    const parsed = parseAgentDefinition(readFileSync(filePath, 'utf-8'), fileName)

    if (`${parsed.definition.id}.json` !== fileName) {
      throw new Error(
        `Kickstart agent file name must match agent id: ${fileName} -> ${parsed.definition.id}`
      )
    }

    return parsed
  })

  loadedDefinitions.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }

    return left.definition.id.localeCompare(right.definition.id)
  })

  const seenIds = new Set<string>()
  const catalog: KickstartAgentDefinition[] = []

  for (const { definition } of loadedDefinitions) {
    if (seenIds.has(definition.id)) {
      throw new Error(`Duplicate kickstart agent id: ${definition.id}`)
    }

    seenIds.add(definition.id)
    catalog.push(definition)
  }

  return catalog
}

export const KICKSTART_AGENT_CATALOG: KickstartAgentDefinition[] =
  loadKickstartAgentCatalog()

export const KICKSTART_AGENT_BY_ID = new Map(
  KICKSTART_AGENT_CATALOG.map((agent) => [agent.id, agent])
)

export function getKickstartAgentById(id: string): KickstartAgentDefinition | null {
  return KICKSTART_AGENT_BY_ID.get(id) ?? null
}

export function getKickstartAgentSummaries(): KickstartAgentSummary[] {
  return KICKSTART_AGENT_CATALOG.map((agent) => ({
    id: agent.id,
    displayName: agent.displayName,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    recommendedModel: agent.recommendedModel,
    temperature: agent.temperature,
    tools: [...agent.tools],
  }))
}
