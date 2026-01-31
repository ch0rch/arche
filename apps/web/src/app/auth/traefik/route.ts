import { NextRequest, NextResponse } from 'next/server'
import { auditEvent, getSessionFromToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { authzFromHost, parseForwardedHost } from '@/lib/host'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    return new NextResponse(null, { status: 401 })
  }

  const session = await getSessionFromToken(token)
  if (!session) {
    return new NextResponse(null, { status: 401 })
  }

  const host = parseForwardedHost(request.headers)
  if (!host) {
    await auditEvent({ actorUserId: session.user.id, action: 'auth.traefik.denied', metadata: { reason: 'missing_host' } })
    return new NextResponse(null, { status: 401 })
  }

  const archeDomain = process.env.ARCHE_DOMAIN?.trim().toLowerCase()
  if (!archeDomain) {
    await auditEvent({ actorUserId: session.user.id, action: 'auth.traefik.denied', metadata: { reason: 'missing_arche_domain' } })
    return new NextResponse(null, { status: 500 })
  }

  const decision = authzFromHost({ host, archeDomain, userSlug: session.user.slug })
  if (!decision.allowed) {
    await auditEvent({
      actorUserId: session.user.id,
      action: 'auth.traefik.denied',
      metadata: { reason: decision.reason, host }
    })
    return new NextResponse(null, { status: 403 })
  }

  await auditEvent({ actorUserId: session.user.id, action: 'auth.traefik.allowed', metadata: { host } })
  return new NextResponse(null, { status: 200 })
}
