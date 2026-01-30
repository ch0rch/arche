import crypto from 'node:crypto'

export function getSessionPepper(): string {
  const pepper = process.env.ARCHE_SESSION_PEPPER
  if (pepper) return pepper
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ARCHE_SESSION_PEPPER is required in production')
  }
  return 'dev-insecure-pepper'
}

export function hashSessionToken(token: string): string {
  const pepper = getSessionPepper()
  return crypto.createHash('sha256').update(`${token}.${pepper}`).digest('hex')
}

export function newSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}
