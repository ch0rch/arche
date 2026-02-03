import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExecResult } from '@/lib/spawner/docker'

// --- Mocks ---

const mockExecInContainer = vi.fn<(...args: unknown[]) => Promise<ExecResult>>()
vi.mock('@/lib/spawner/docker', () => ({
  execInContainer: (...args: unknown[]) => mockExecInContainer(...args),
}))

const mockFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: { instance: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}))

const mockGetSessionFromToken = vi.fn()
vi.mock('@/lib/auth', () => ({
  getSessionFromToken: (...args: unknown[]) => mockGetSessionFromToken(...args),
  SESSION_COOKIE_NAME: 'arche_session',
}))

const mockCookies = vi.fn()
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}))

// --- Helpers ---

function session(slug: string, role = 'USER') {
  return { user: { id: '1', email: 'a@b.com', slug, role }, sessionId: 's1' }
}

function exec(exitCode: number, stdout = '', stderr = ''): ExecResult {
  return { exitCode, stdout, stderr }
}

function instance(status = 'running', containerId = 'ctr-1') {
  return { containerId, status }
}

async function callPOST(slug = 'alice') {
  const { POST } = await import(
    '@/app/api/instances/[slug]/publish-kb/route'
  )
  const req = new Request('http://localhost/api/instances/' + slug + '/publish-kb', {
    method: 'POST',
  })
  const res = await POST(req as never, { params: Promise.resolve({ slug }) })
  return { status: res.status, body: await res.json() }
}

// --- Tests ---

describe('POST /api/instances/[slug]/publish-kb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns 401 without session cookie', async () => {
    mockCookies.mockResolvedValue({ get: () => undefined })
    const { status, body } = await callPOST()
    expect(status).toBe(401)
    expect(body.error).toBe('unauthorized')
  })

  it('returns 403 for wrong user', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('bob'))
    const { status, body } = await callPOST('alice')
    expect(status).toBe(403)
    expect(body.error).toBe('forbidden')
  })

  it('returns 404 when instance not found', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(null)
    const { status, body } = await callPOST('alice')
    expect(status).toBe(404)
    expect(body.error).toBe('not_found')
  })

  it('returns 409 when instance not running', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance('stopped'))
    const { status, body } = await callPOST('alice')
    expect(status).toBe(409)
    expect(body.error).toBe('instance_not_running')
  })

  it('returns no_remote when git remote fails', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer.mockResolvedValue(exec(1, '', 'fatal: no such remote'))
    const { status, body } = await callPOST('alice')
    expect(status).toBe(200)
    expect(body.status).toBe('no_remote')
    expect(body.ok).toBe(false)
  })

  it('returns nothing_to_publish when workspace is clean', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer
      .mockResolvedValueOnce(exec(0, 'git@host:repo.git')) // remote check
      .mockResolvedValueOnce(exec(0, ''))                   // git status --porcelain
    const { status, body } = await callPOST('alice')
    expect(status).toBe(200)
    expect(body.status).toBe('nothing_to_publish')
    expect(body.ok).toBe(true)
  })

  it('returns published with commitHash and files', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer
      .mockResolvedValueOnce(exec(0, 'git@host:repo.git'))           // remote check
      .mockResolvedValueOnce(exec(0, ' M file1.md\n M file2.md\n')) // git status --porcelain
      .mockResolvedValueOnce(exec(0))                                 // git add -A
      .mockResolvedValueOnce(exec(0, ' file1.md | 2 +-\n file2.md | 1 +\n 2 files changed')) // diff --cached --stat
      .mockResolvedValueOnce(exec(0))                                 // git commit
      .mockResolvedValueOnce(exec(0, 'abc1234'))                      // rev-parse
      .mockResolvedValueOnce(exec(0, 'file1.md\nfile2.md\n'))        // diff-tree
      .mockResolvedValueOnce(exec(0, 'main'))                        // rev-parse branch
      .mockResolvedValueOnce(exec(0))                                 // git push
    const { status, body } = await callPOST('alice')
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.status).toBe('published')
    expect(body.commitHash).toBe('abc1234')
    expect(body.files).toEqual(['file1.md', 'file2.md'])
  })

  it('returns push_rejected when push fails with rejected', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer
      .mockResolvedValueOnce(exec(0, 'git@host:repo.git'))
      .mockResolvedValueOnce(exec(0, ' M file1.md\n'))
      .mockResolvedValueOnce(exec(0))                        // git add
      .mockResolvedValueOnce(exec(0, ' file1.md | 1 +\n 1 file changed')) // stat
      .mockResolvedValueOnce(exec(0))                        // commit
      .mockResolvedValueOnce(exec(0, 'def5678'))             // rev-parse
      .mockResolvedValueOnce(exec(0, 'file1.md\n'))          // diff-tree
      .mockResolvedValueOnce(exec(0, 'main'))                // rev-parse branch
      .mockResolvedValueOnce(exec(1, '', '! [rejected]'))    // push rejected
    const { status, body } = await callPOST('alice')
    expect(status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.status).toBe('push_rejected')
    expect(body.message).toBe('Sync KB first')
  })

  it('allows admin to publish for another user', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('admin-user', 'ADMIN'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer
      .mockResolvedValueOnce(exec(0, 'git@host:repo.git'))
      .mockResolvedValueOnce(exec(0, '')) // clean
    const { status, body } = await callPOST('alice')
    expect(status).toBe(200)
    expect(body.status).toBe('nothing_to_publish')
  })

  it('generates commit message with file names for 1-3 files', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer
      .mockResolvedValueOnce(exec(0, 'git@host:repo.git'))
      .mockResolvedValueOnce(exec(0, ' M a.md\n M b.md\n'))
      .mockResolvedValueOnce(exec(0)) // add
      .mockResolvedValueOnce(exec(0, ' a.md | 1 +\n b.md | 2 +-\n 2 files changed'))
      .mockResolvedValueOnce(exec(0)) // commit
      .mockResolvedValueOnce(exec(0, 'aaa1111'))
      .mockResolvedValueOnce(exec(0, 'a.md\nb.md\n'))
      .mockResolvedValueOnce(exec(0, 'main')) // rev-parse branch
      .mockResolvedValueOnce(exec(0)) // push
    await callPOST('alice')
    // The commit call is the 5th invocation (index 4)
    const commitCall = mockExecInContainer.mock.calls[4]
    const commitCmd = commitCall[1] as string[]
    expect(commitCmd).toContain('-m')
    const msg = commitCmd[commitCmd.indexOf('-m') + 1]
    expect(msg).toBe('Update a.md, b.md')
  })

  it('generates commit message with count for >3 files', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer
      .mockResolvedValueOnce(exec(0, 'git@host:repo.git'))
      .mockResolvedValueOnce(exec(0, ' M a\n M b\n M c\n M d\n'))
      .mockResolvedValueOnce(exec(0)) // add
      .mockResolvedValueOnce(exec(0, ' a | 1 +\n b | 1 +\n c | 1 +\n d | 1 +\n 4 files changed'))
      .mockResolvedValueOnce(exec(0)) // commit
      .mockResolvedValueOnce(exec(0, 'bbb2222'))
      .mockResolvedValueOnce(exec(0, 'a\nb\nc\nd\n'))
      .mockResolvedValueOnce(exec(0, 'main')) // rev-parse branch
      .mockResolvedValueOnce(exec(0)) // push
    await callPOST('alice')
    const commitCall = mockExecInContainer.mock.calls[4]
    const commitCmd = commitCall[1] as string[]
    const msg = commitCmd[commitCmd.indexOf('-m') + 1]
    expect(msg).toBe('Update 4 files')
  })

  it('returns error when git add fails', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer
      .mockResolvedValueOnce(exec(0, 'git@host:repo.git'))       // remote check
      .mockResolvedValueOnce(exec(0, ' M file1.md\n'))           // git status
      .mockResolvedValueOnce(exec(1, '', 'fatal: index locked')) // git add fails
    const { status, body } = await callPOST('alice')
    expect(status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.status).toBe('error')
    expect(body.message).toContain('git add failed')
  })

  it('returns error when git commit fails', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer
      .mockResolvedValueOnce(exec(0, 'git@host:repo.git'))       // remote check
      .mockResolvedValueOnce(exec(0, ' M file1.md\n'))           // git status
      .mockResolvedValueOnce(exec(0))                             // git add ok
      .mockResolvedValueOnce(exec(0, ' file1.md | 1 +\n 1 file changed')) // stat
      .mockResolvedValueOnce(exec(1, '', 'error: hook failed'))  // git commit fails
    const { status, body } = await callPOST('alice')
    expect(status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.status).toBe('error')
    expect(body.message).toContain('git commit failed')
  })

  it('returns error when execInContainer throws', async () => {
    mockCookies.mockResolvedValue({ get: () => ({ value: 'tok' }) })
    mockGetSessionFromToken.mockResolvedValue(session('alice'))
    mockFindUnique.mockResolvedValue(instance())
    mockExecInContainer.mockRejectedValue(new Error('container crashed'))
    const { status, body } = await callPOST('alice')
    expect(status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.status).toBe('error')
    expect(body.message).toBe('container crashed')
  })
})
