import { NextRequest } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { validateSameOrigin } from '@/lib/csrf'
import {
  ensureUniqueAttachmentFilename,
  inferAttachmentMimeType,
  isWorkspaceAttachmentPath,
  MAX_ATTACHMENTS_PER_UPLOAD,
  MAX_ATTACHMENT_UPLOAD_BYTES,
  normalizeAttachmentPath,
  sanitizeAttachmentFilename,
  WORKSPACE_ATTACHMENTS_DIR,
} from '@/lib/workspace-attachments'
import { createWorkspaceAgentClient } from '@/lib/workspace-agent/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type WorkspaceAgentListEntry = {
  path: string
  name: string
  type: 'file' | 'directory'
  size: number
  modifiedAt: number
}

type WorkspaceAgentListResponse = {
  ok: boolean
  entries?: WorkspaceAgentListEntry[]
  error?: string
}

type WorkspaceAgentWriteResponse = {
  ok: boolean
  hash?: string
  error?: string
}

type WorkspaceAgentRenameResponse = {
  ok: boolean
  path?: string
  newPath?: string
  error?: string
}

type WorkspaceAttachment = {
  id: string
  path: string
  name: string
  mime: string
  size: number
  uploadedAt: number
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function normalizeAndValidateAttachmentPath(path: unknown): string | null {
  if (typeof path !== 'string') return null
  const normalized = normalizeAttachmentPath(path)
  if (!isWorkspaceAttachmentPath(normalized)) return null
  return normalized
}

async function getAuthorizedWorkspaceAgent(slug: string) {
  const session = await getAuthenticatedUser()
  if (!session) {
    return { ok: false as const, response: jsonResponse(401, { error: 'unauthorized' }) }
  }

  if (session.user.slug !== slug && session.user.role !== 'ADMIN') {
    return { ok: false as const, response: jsonResponse(403, { error: 'forbidden' }) }
  }

  const agent = await createWorkspaceAgentClient(slug)
  if (!agent) {
    return {
      ok: false as const,
      response: jsonResponse(503, { error: 'instance_unavailable' }),
    }
  }

  return { ok: true as const, agent }
}

async function listWorkspaceAttachments(agent: {
  baseUrl: string
  authHeader: string
}): Promise<{ ok: true; attachments: WorkspaceAttachment[] } | { ok: false; error: string }> {
  const response = await fetch(`${agent.baseUrl}/files/list`, {
    method: 'POST',
    headers: {
      Authorization: agent.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ path: WORKSPACE_ATTACHMENTS_DIR, recursive: false }),
    cache: 'no-store',
  })

  if (response.status === 404) {
    return { ok: true, attachments: [] }
  }

  const data = (await response.json().catch(() => null)) as WorkspaceAgentListResponse | null
  if (!response.ok) {
    return { ok: false, error: data?.error ?? `workspace_agent_http_${response.status}` }
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error ?? 'workspace_agent_error' }
  }

  const attachments = (data.entries ?? [])
    .filter((entry) => entry.type === 'file')
    .map((entry) => ({
      id: entry.path,
      path: entry.path,
      name: entry.name,
      mime: inferAttachmentMimeType(entry.name),
      size: entry.size,
      uploadedAt: entry.modifiedAt,
    }))
    .sort((a, b) => b.uploadedAt - a.uploadedAt)

  return { ok: true, attachments }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const auth = await getAuthorizedWorkspaceAgent(slug)
  if (!auth.ok) return auth.response

  try {
    const listed = await listWorkspaceAttachments(auth.agent)
    if (!listed.ok) {
      return jsonResponse(502, { error: listed.error })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = Number(searchParams.get('limit'))
    const hasLimit = Number.isFinite(limitParam) && limitParam > 0
    const limited = hasLimit
      ? listed.attachments.slice(0, Math.min(limitParam, 50))
      : listed.attachments

    return jsonResponse(200, { attachments: limited })
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'attachments_list_failed',
    })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const auth = await getAuthorizedWorkspaceAgent(slug)
  if (!auth.ok) return auth.response

  const originValidation = validateSameOrigin(request)
  if (!originValidation.ok) {
    return jsonResponse(403, { error: 'forbidden' })
  }

  const formData = await request.formData()
  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File)

  if (files.length === 0) {
    return jsonResponse(400, { error: 'missing_files' })
  }

  if (files.length > MAX_ATTACHMENTS_PER_UPLOAD) {
    return jsonResponse(400, { error: 'too_many_files' })
  }

  if (files.some((file) => file.size > MAX_ATTACHMENT_UPLOAD_BYTES)) {
    return jsonResponse(413, { error: 'file_too_large' })
  }

  const existing = await listWorkspaceAttachments(auth.agent)
  if (!existing.ok) {
    return jsonResponse(502, { error: existing.error })
  }

  const usedNames = new Set(existing.attachments.map((attachment) => attachment.name))
  const uploaded: WorkspaceAttachment[] = []

  for (const file of files) {
    const safeName = sanitizeAttachmentFilename(file.name)
    const uniqueName = ensureUniqueAttachmentFilename(safeName, usedNames)
    usedNames.add(uniqueName)

    const path = `${WORKSPACE_ATTACHMENTS_DIR}/${uniqueName}`
    const bytes = Buffer.from(await file.arrayBuffer())
    const fileType = file.type.trim()
    const mime =
      fileType.length > 0 && fileType !== 'application/octet-stream'
        ? fileType
        : inferAttachmentMimeType(uniqueName)
    const uploadedAt = Date.now()

    const response = await fetch(`${auth.agent.baseUrl}/files/write`, {
      method: 'POST',
      headers: {
        Authorization: auth.agent.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        path,
        content: bytes.toString('base64'),
        encoding: 'base64',
      }),
      cache: 'no-store',
    })

    const data = (await response
      .json()
      .catch(() => null)) as WorkspaceAgentWriteResponse | null

    if (!response.ok) {
      return jsonResponse(502, {
        error: data?.error ?? `workspace_agent_http_${response.status}`,
      })
    }
    if (!data?.ok) {
      return jsonResponse(502, { error: data?.error ?? 'workspace_agent_error' })
    }

    uploaded.push({
      id: path,
      path,
      name: uniqueName,
      mime,
      size: bytes.length,
      uploadedAt,
    })
  }

  return jsonResponse(201, { uploaded })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const auth = await getAuthorizedWorkspaceAgent(slug)
  if (!auth.ok) return auth.response

  const originValidation = validateSameOrigin(request)
  if (!originValidation.ok) {
    return jsonResponse(403, { error: 'forbidden' })
  }

  const body = (await request
    .json()
    .catch(() => null)) as { path?: unknown; name?: unknown } | null
  const path = normalizeAndValidateAttachmentPath(body?.path)
  if (!path) {
    return jsonResponse(400, { error: 'invalid_path' })
  }

  if (typeof body?.name !== 'string') {
    return jsonResponse(400, { error: 'invalid_name' })
  }

  const sanitizedName = sanitizeAttachmentFilename(body.name)
  if (sanitizedName.length === 0) {
    return jsonResponse(400, { error: 'invalid_name' })
  }

  const newPath = `${WORKSPACE_ATTACHMENTS_DIR}/${sanitizedName}`

  const response = await fetch(`${auth.agent.baseUrl}/files/rename`, {
    method: 'POST',
    headers: {
      Authorization: auth.agent.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ path, newPath }),
    cache: 'no-store',
  })

  const data = (await response
    .json()
    .catch(() => null)) as WorkspaceAgentRenameResponse | null

  if (!response.ok) {
    return jsonResponse(response.status === 409 ? 409 : 502, {
      error: data?.error ?? `workspace_agent_http_${response.status}`,
    })
  }
  if (!data?.ok) {
    return jsonResponse(502, { error: data?.error ?? 'workspace_agent_error' })
  }

  const listed = await listWorkspaceAttachments(auth.agent)
  if (!listed.ok) {
    return jsonResponse(502, { error: listed.error })
  }

  const updatedAttachment = listed.attachments.find(
    (attachment) => attachment.path === newPath,
  )
  if (!updatedAttachment) {
    return jsonResponse(404, { error: 'not_found' })
  }

  return jsonResponse(200, { attachment: updatedAttachment })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const auth = await getAuthorizedWorkspaceAgent(slug)
  if (!auth.ok) return auth.response

  const originValidation = validateSameOrigin(request)
  if (!originValidation.ok) {
    return jsonResponse(403, { error: 'forbidden' })
  }

  const body = (await request
    .json()
    .catch(() => null)) as { path?: unknown } | null
  const path = normalizeAndValidateAttachmentPath(body?.path)
  if (!path) {
    return jsonResponse(400, { error: 'invalid_path' })
  }

  const response = await fetch(`${auth.agent.baseUrl}/files/delete`, {
    method: 'POST',
    headers: {
      Authorization: auth.agent.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ path }),
    cache: 'no-store',
  })

  const data = (await response
    .json()
    .catch(() => null)) as WorkspaceAgentWriteResponse | null

  if (!response.ok) {
    return jsonResponse(response.status === 404 ? 404 : 502, {
      error: data?.error ?? `workspace_agent_http_${response.status}`,
    })
  }
  if (!data?.ok) {
    return jsonResponse(502, { error: data?.error ?? 'workspace_agent_error' })
  }

  return jsonResponse(200, { ok: true })
}
