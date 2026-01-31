import { firstHeaderValue, stripPort } from '@/lib/http'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseForwardedHost(headers: Headers): string | null {
  const forwarded = firstHeaderValue(headers.get('x-forwarded-host'))
  const fallback = firstHeaderValue(headers.get('host'))
  const raw = forwarded ?? fallback
  if (!raw) return null
  return stripPort(raw.toLowerCase())
}

export function authzFromHost(params: {
  host: string
  archeDomain: string
  userSlug: string
}): { allowed: boolean; reason: 'ok' | 'host_not_supported' | 'slug_mismatch' } {
  const base = params.archeDomain.toLowerCase()
  const host = params.host.toLowerCase()
  const userSlug = params.userSlug.toLowerCase()

  if (host === base) return { allowed: true, reason: 'ok' }

  const re = new RegExp(`^u-([a-z0-9-]+)\\.${escapeRegex(base)}$`)
  const m = host.match(re)
  if (!m) return { allowed: false, reason: 'host_not_supported' }
  const hostSlug = m[1] || ''
  if (hostSlug !== userSlug) return { allowed: false, reason: 'slug_mismatch' }
  return { allowed: true, reason: 'ok' }
}
