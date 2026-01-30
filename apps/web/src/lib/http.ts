export function firstHeaderValue(value: string | null): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim()
  return first || null
}

export function stripPort(host: string): string {
  return host.replace(/:\d+$/, '')
}

export function getClientIp(headers: Headers): string | null {
  const xff = firstHeaderValue(headers.get('x-forwarded-for'))
  if (xff) return xff
  const realIp = firstHeaderValue(headers.get('x-real-ip'))
  return realIp
}
