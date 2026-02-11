import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetAuthenticatedUser = vi.fn()
vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}))

const mockValidateSameOrigin = vi.fn()
vi.mock('@/lib/csrf', () => ({
  validateSameOrigin: (...args: unknown[]) => mockValidateSameOrigin(...args),
}))

const mockUserFindUnique = vi.fn()
const mockConnectorFindFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    connector: {
      findFirst: (...args: unknown[]) => mockConnectorFindFirst(...args),
    },
  },
}))

const mockDecryptConfig = vi.fn()
vi.mock('@/lib/connectors/crypto', () => ({
  decryptConfig: (...args: unknown[]) => mockDecryptConfig(...args),
}))

const mockValidateConnectorTestEndpoint = vi.fn()
vi.mock('@/lib/security/ssrf', () => ({
  validateConnectorTestEndpoint: (...args: unknown[]) => mockValidateConnectorTestEndpoint(...args),
}))

function session(slug: string) {
  return { user: { id: 'user-1', email: 'alice@example.com', slug, role: 'USER' }, sessionId: 'session-1' }
}

async function callTestRoute(slug = 'alice', id = 'conn-1') {
  const { POST } = await import('@/app/api/u/[slug]/connectors/[id]/test/route')

  const request = new Request(`http://localhost/api/u/${slug}/connectors/${id}/test`, {
    method: 'POST',
    headers: {
      host: 'localhost',
      origin: 'http://localhost',
    },
  })

  const response = await POST(request as never, { params: Promise.resolve({ slug, id }) })
  return { status: response.status, body: await response.json() }
}

describe('POST /api/u/[slug]/connectors/[id]/test SSRF hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    mockGetAuthenticatedUser.mockResolvedValue(session('alice'))
    mockValidateSameOrigin.mockReturnValue({ ok: true })
    mockUserFindUnique.mockResolvedValue({ id: 'user-1' })
    mockConnectorFindFirst.mockResolvedValue({
      id: 'conn-1',
      userId: 'user-1',
      type: 'custom',
      enabled: true,
      config: 'encrypted-config',
    })
    mockDecryptConfig.mockReturnValue({ endpoint: 'https://api.example.com/mcp' })
    mockValidateConnectorTestEndpoint.mockResolvedValue({ ok: true, url: new URL('https://api.example.com/mcp') })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 400 for blocked custom endpoints without issuing outbound fetch', async () => {
    mockValidateConnectorTestEndpoint.mockResolvedValueOnce({ ok: false, error: 'blocked_endpoint' })

    const { status, body } = await callTestRoute('alice', 'conn-1')

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'blocked_endpoint' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid custom endpoints', async () => {
    mockValidateConnectorTestEndpoint.mockResolvedValueOnce({ ok: false, error: 'invalid_endpoint' })

    const { status, body } = await callTestRoute('alice', 'conn-1')

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'invalid_endpoint' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('uses redirect manual when testing allowed custom endpoints', async () => {
    const { status, body } = await callTestRoute('alice', 'conn-1')

    expect(status).toBe(200)
    expect(body).toMatchObject({ ok: true, tested: true })
    expect(mockValidateConnectorTestEndpoint).toHaveBeenCalledWith('https://api.example.com/mcp')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      new URL('https://api.example.com/mcp'),
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
      })
    )
  })
})
