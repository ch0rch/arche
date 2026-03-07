import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetAuthenticatedUser = vi.fn()
vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}))

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    instance: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

function session(slug: string, role: 'USER' | 'ADMIN' = 'USER') {
  return {
    user: { id: 'user-1', email: `${slug}@example.com`, slug, role },
    sessionId: 'session-1',
  }
}

async function callPatch(
  slug = 'alice',
  options?: { origin?: string; authorization?: string }
) {
  const { PATCH } = await import('@/app/api/instances/[slug]/activity/route')

  const headers: Record<string, string> = {
    host: 'localhost',
  }

  if (options?.origin) headers.origin = options.origin
  if (options?.authorization) headers.authorization = options.authorization

  const req = new Request(`http://localhost/api/instances/${slug}/activity`, {
    method: 'PATCH',
    headers,
  })

  const res = await PATCH(req as never, { params: Promise.resolve({ slug }) })
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  }
}

describe('PATCH /api/instances/[slug]/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    process.env.ARCHE_INTERNAL_TOKEN = 'internal-token'

    mockGetAuthenticatedUser.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue({
      slug: 'alice',
      lastActivityAt: new Date(Date.now() - 60_000),
    })
    mockUpdate.mockResolvedValue({})
  })

  it('accepts same-origin authenticated users and updates activity', async () => {
    const { status, body } = await callPatch('alice', { origin: 'http://localhost' })

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockGetAuthenticatedUser).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { slug: 'alice' },
      data: { lastActivityAt: expect.any(Date) },
    })
  })

  it('returns 403 when origin is missing for session auth flow', async () => {
    const { status, body } = await callPatch('alice')

    expect(status).toBe(403)
    expect(body.error).toBe('forbidden')
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null)

    const { status, body } = await callPatch('alice', { origin: 'http://localhost' })

    expect(status).toBe(401)
    expect(body.error).toBe('unauthorized')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 403 when authenticated user is not authorized', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(session('bob'))

    const { status, body } = await callPatch('alice', { origin: 'http://localhost' })

    expect(status).toBe(403)
    expect(body.error).toBe('forbidden')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('accepts valid internal token without origin/session headers', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null)

    const { status, body } = await callPatch('alice', {
      authorization: 'Bearer internal-token',
    })

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockGetAuthenticatedUser).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('returns debounced=true when activity was updated recently', async () => {
    mockFindUnique.mockResolvedValue({
      slug: 'alice',
      lastActivityAt: new Date(Date.now() - 5_000),
    })

    const { status, body } = await callPatch('alice', { origin: 'http://localhost' })

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true, debounced: true })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 when instance does not exist', async () => {
    mockFindUnique.mockResolvedValue(null)

    const { status, body } = await callPatch('alice', { origin: 'http://localhost' })

    expect(status).toBe(404)
    expect(body.error).toBe('not_found')
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
