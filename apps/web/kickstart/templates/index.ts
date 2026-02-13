import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type {
  KickstartKbSkeletonEntry,
  KickstartTemplateDefinition,
  KickstartTemplateSummary,
} from '@/kickstart/types'

type ParsedTemplateDefinition = {
  definition: KickstartTemplateDefinition
  order: number
}

const TEMPLATE_DEFINITION_KEYS = new Set([
  'id',
  'label',
  'description',
  'kbSkeleton',
  'agentsMdTemplate',
  'recommendedAgentIds',
  'recommendedModels',
  'order',
])

const KB_SKELETON_DIR_KEYS = new Set(['type', 'path'])
const KB_SKELETON_FILE_KEYS = new Set(['type', 'path', 'content'])

const TEMPLATE_DEFINITION_DIR_CANDIDATES = [
  join(process.cwd(), 'kickstart/templates/definitions'),
  join(process.cwd(), 'apps/web/kickstart/templates/definitions'),
]

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseNonEmptyString(value: unknown, fieldName: string, fileName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${fieldName} in kickstart template definition: ${fileName}`)
  }

  return value.trim()
}

function parseTemplateMarkdown(value: unknown, fieldName: string, fileName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${fieldName} in kickstart template definition: ${fileName}`)
  }

  return value
}

function parseOrder(value: unknown, fileName: string): number {
  if (value === undefined) {
    return 1000
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid order in kickstart template definition: ${fileName}`)
  }

  return value
}

function parseKbSkeleton(value: unknown, fileName: string): KickstartKbSkeletonEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid kbSkeleton in kickstart template definition: ${fileName}`)
  }

  const entries: KickstartKbSkeletonEntry[] = []

  for (const entry of value) {
    if (!isRecord(entry)) {
      throw new Error(`Invalid kbSkeleton entry in kickstart template definition: ${fileName}`)
    }

    if (entry.type === 'dir') {
      if (!hasOnlyAllowedKeys(entry, KB_SKELETON_DIR_KEYS)) {
        throw new Error(`Invalid kbSkeleton dir shape in kickstart template definition: ${fileName}`)
      }

      entries.push({
        type: 'dir',
        path: parseNonEmptyString(entry.path, 'kbSkeleton.path', fileName),
      })
      continue
    }

    if (entry.type === 'file') {
      if (!hasOnlyAllowedKeys(entry, KB_SKELETON_FILE_KEYS)) {
        throw new Error(`Invalid kbSkeleton file shape in kickstart template definition: ${fileName}`)
      }

      if (typeof entry.content !== 'string') {
        throw new Error(`Invalid kbSkeleton content in kickstart template definition: ${fileName}`)
      }

      entries.push({
        type: 'file',
        path: parseNonEmptyString(entry.path, 'kbSkeleton.path', fileName),
        content: entry.content,
      })
      continue
    }

    throw new Error(`Invalid kbSkeleton type in kickstart template definition: ${fileName}`)
  }

  return entries
}

function parseRecommendedAgentIds(value: unknown, fileName: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid recommendedAgentIds in kickstart template definition: ${fileName}`)
  }

  const recommendedAgentIds: string[] = []
  const seenIds = new Set<string>()

  for (const agentId of value) {
    const parsedAgentId = parseNonEmptyString(agentId, 'recommendedAgentIds', fileName)
    if (seenIds.has(parsedAgentId)) {
      continue
    }

    seenIds.add(parsedAgentId)
    recommendedAgentIds.push(parsedAgentId)
  }

  return recommendedAgentIds
}

function parseRecommendedModels(
  value: unknown,
  recommendedAgentIds: string[],
  fileName: string
): Record<string, string> {
  if (!isRecord(value)) {
    throw new Error(`Invalid recommendedModels in kickstart template definition: ${fileName}`)
  }

  const recommendedModels: Record<string, string> = {}

  for (const [agentId, model] of Object.entries(value)) {
    recommendedModels[agentId] = parseNonEmptyString(model, 'recommendedModels', fileName)
  }

  for (const recommendedAgentId of recommendedAgentIds) {
    if (!recommendedModels[recommendedAgentId]) {
      throw new Error(
        `Missing recommended model for agent ${recommendedAgentId} in ${fileName}`
      )
    }
  }

  return recommendedModels
}

function parseTemplateDefinition(raw: string, fileName: string): ParsedTemplateDefinition {
  let parsedValue: unknown

  try {
    parsedValue = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid JSON in kickstart template definition: ${fileName}`)
  }

  if (!isRecord(parsedValue) || !hasOnlyAllowedKeys(parsedValue, TEMPLATE_DEFINITION_KEYS)) {
    throw new Error(`Invalid object shape in kickstart template definition: ${fileName}`)
  }

  const recommendedAgentIds = parseRecommendedAgentIds(parsedValue.recommendedAgentIds, fileName)

  const definition: KickstartTemplateDefinition = {
    id: parseNonEmptyString(parsedValue.id, 'id', fileName),
    label: parseNonEmptyString(parsedValue.label, 'label', fileName),
    description: parseNonEmptyString(parsedValue.description, 'description', fileName),
    kbSkeleton: parseKbSkeleton(parsedValue.kbSkeleton, fileName),
    agentsMdTemplate: parseTemplateMarkdown(parsedValue.agentsMdTemplate, 'agentsMdTemplate', fileName),
    recommendedAgentIds,
    recommendedModels: parseRecommendedModels(
      parsedValue.recommendedModels,
      recommendedAgentIds,
      fileName
    ),
  }

  return {
    definition,
    order: parseOrder(parsedValue.order, fileName),
  }
}

function resolveTemplateDefinitionDirectory(): string {
  for (const candidate of TEMPLATE_DEFINITION_DIR_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Kickstart template definitions directory not found. Tried: ${TEMPLATE_DEFINITION_DIR_CANDIDATES.join(', ')}`
  )
}

function loadKickstartTemplates(): KickstartTemplateDefinition[] {
  const definitionsDirectory = resolveTemplateDefinitionDirectory()
  const definitionFiles = readdirSync(definitionsDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))

  if (definitionFiles.length === 0) {
    throw new Error('No kickstart template definitions were found')
  }

  const loadedDefinitions = definitionFiles.map((fileName) => {
    const filePath = join(definitionsDirectory, fileName)
    const parsed = parseTemplateDefinition(readFileSync(filePath, 'utf-8'), fileName)

    if (`${parsed.definition.id}.json` !== fileName) {
      throw new Error(
        `Kickstart template file name must match template id: ${fileName} -> ${parsed.definition.id}`
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
  const templates: KickstartTemplateDefinition[] = []

  for (const { definition } of loadedDefinitions) {
    if (seenIds.has(definition.id)) {
      throw new Error(`Duplicate kickstart template id: ${definition.id}`)
    }

    seenIds.add(definition.id)
    templates.push(definition)
  }

  return templates
}

export const KICKSTART_TEMPLATES: KickstartTemplateDefinition[] = loadKickstartTemplates()

const templateMap = new Map(
  KICKSTART_TEMPLATES.map((template) => [template.id, template])
)

export function getKickstartTemplateById(
  templateId: string
): KickstartTemplateDefinition | null {
  return templateMap.get(templateId) ?? null
}

export function getKickstartTemplateSummaries(): KickstartTemplateSummary[] {
  return KICKSTART_TEMPLATES.map((template) => ({
    id: template.id,
    label: template.label,
    description: template.description,
    recommendedAgentIds: [...template.recommendedAgentIds],
    recommendedModels: { ...template.recommendedModels },
  }))
}
