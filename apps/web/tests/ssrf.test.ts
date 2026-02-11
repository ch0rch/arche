import { describe, expect, it, vi } from 'vitest'

import { validateConnectorTestEndpoint } from '@/lib/security/ssrf'

describe('validateConnectorTestEndpoint', () => {
  it('accepts a public https endpoint', async () => {
    const lookupHost = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }])

    const result = await validateConnectorTestEndpoint('https://api.example.com/mcp', { lookupHost })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.url.toString()).toBe('https://api.example.com/mcp')
    }
    expect(lookupHost).toHaveBeenCalledWith('api.example.com')
  })

  it('rejects invalid endpoint urls', async () => {
    const lookupHost = vi.fn()

    const result = await validateConnectorTestEndpoint('not-a-url', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'invalid_endpoint' })
    expect(lookupHost).not.toHaveBeenCalled()
  })

  it('rejects non-https protocols', async () => {
    const lookupHost = vi.fn()

    const result = await validateConnectorTestEndpoint('http://api.example.com/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'invalid_endpoint' })
    expect(lookupHost).not.toHaveBeenCalled()
  })

  it('rejects localhost endpoints', async () => {
    const lookupHost = vi.fn()

    const result = await validateConnectorTestEndpoint('https://localhost/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'blocked_endpoint' })
    expect(lookupHost).not.toHaveBeenCalled()
  })

  it('rejects private ipv4 literal endpoints', async () => {
    const lookupHost = vi.fn()

    const result = await validateConnectorTestEndpoint('https://127.0.0.1/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'blocked_endpoint' })
    expect(lookupHost).not.toHaveBeenCalled()
  })

  it('rejects unspecified ipv4 literal endpoints', async () => {
    const lookupHost = vi.fn()

    const result = await validateConnectorTestEndpoint('https://0.0.0.0/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'blocked_endpoint' })
    expect(lookupHost).not.toHaveBeenCalled()
  })

  it('rejects loopback ipv6 literal endpoints', async () => {
    const lookupHost = vi.fn()

    const result = await validateConnectorTestEndpoint('https://[::1]/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'blocked_endpoint' })
    expect(lookupHost).not.toHaveBeenCalled()
  })

  it('rejects unspecified ipv6 literal endpoints', async () => {
    const lookupHost = vi.fn()

    const result = await validateConnectorTestEndpoint('https://[::]/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'blocked_endpoint' })
    expect(lookupHost).not.toHaveBeenCalled()
  })

  it('rejects ipv4-mapped ipv6 private endpoints', async () => {
    const lookupHost = vi.fn()

    const result = await validateConnectorTestEndpoint('https://[::ffff:7f00:1]/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'blocked_endpoint' })
    expect(lookupHost).not.toHaveBeenCalled()
  })

  it('rejects hostnames that resolve to private addresses', async () => {
    const lookupHost = vi.fn().mockResolvedValue([{ address: '10.0.0.5', family: 4 }])

    const result = await validateConnectorTestEndpoint('https://internal.example/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'blocked_endpoint' })
  })

  it('rejects hostnames that resolve to private ipv6 addresses', async () => {
    const lookupHost = vi.fn().mockResolvedValue([{ address: 'fd00::1', family: 6 }])

    const result = await validateConnectorTestEndpoint('https://internal-v6.example/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'blocked_endpoint' })
  })

  it('rejects hostnames with mixed public and private dns answers', async () => {
    const lookupHost = vi.fn().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '192.168.1.10', family: 4 },
    ])

    const result = await validateConnectorTestEndpoint('https://mixed.example/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'blocked_endpoint' })
  })

  it('rejects endpoints when dns lookup fails', async () => {
    const lookupHost = vi.fn().mockRejectedValue(new Error('ENOTFOUND'))

    const result = await validateConnectorTestEndpoint('https://unknown.example/mcp', { lookupHost })

    expect(result).toEqual({ ok: false, error: 'invalid_endpoint' })
  })
})
