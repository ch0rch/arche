import { firstHeaderValue } from '@/lib/http'

function getConfiguredPublicOrigin(): string | null {
  const configured = process.env.ARCHE_PUBLIC_BASE_URL?.trim()
  if (!configured) {
    return null
  }

  try {
    return new URL(configured).origin
  } catch {
    return null
  }
}

export function validateSameOrigin(request: Request): { ok: true } | { ok: false } {
  const origin = request.headers.get('origin')
  if (!origin || origin === 'null') {
    return { ok: false }
  }

  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    return { ok: false }
  }

  const configuredOrigin = getConfiguredPublicOrigin()
  if (configuredOrigin) {
    return originUrl.origin === configuredOrigin ? { ok: true } : { ok: false }
  }

  let requestUrl: URL
  try {
    requestUrl = new URL(request.url)
  } catch {
    return { ok: false }
  }

  const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto'))
  const expectedProto = forwardedProto || requestUrl.protocol.replace(':', '')
  const expectedHost =
    firstHeaderValue(request.headers.get('x-forwarded-host')) ||
    firstHeaderValue(request.headers.get('host')) ||
    requestUrl.host

  let expectedOrigin: string
  try {
    expectedOrigin = new URL(`${expectedProto}://${expectedHost}`).origin
  } catch {
    return { ok: false }
  }

  if (originUrl.origin !== expectedOrigin) {
    return { ok: false }
  }

  return { ok: true }
}
