import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditEvent, createSession, getCookieDomain, SESSION_COOKIE_NAME, verifyPassword } from '@/lib/auth'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    await auditEvent({ action: 'auth.login.failed', metadata: { email } })
    return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 })
  }

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    await auditEvent({ actorUserId: user.id, action: 'auth.login.failed' })
    return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 })
  }

  const { token, expiresAt } = await createSession({ userId: user.id, headers: request.headers })
  await auditEvent({ actorUserId: user.id, action: 'auth.login.succeeded' })

  const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, slug: user.slug, role: user.role } })
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    domain: getCookieDomain(),
    expires: expiresAt
  })

  return res
}
