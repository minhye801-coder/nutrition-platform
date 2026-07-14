export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!header) return cookies

  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) continue
    const key = part.slice(0, separatorIndex).trim()
    const value = part.slice(separatorIndex + 1).trim()
    if (key) {
      cookies[key] = decodeURIComponent(value)
    }
  }

  return cookies
}

interface CookieOptions {
  maxAge?: number
  path?: string
  sameSite?: 'Strict' | 'Lax' | 'None'
}

/** HttpOnly + Secure + SameSite=Lax(기본)를 강제하는 쿠키 직렬화. 세션/OAuth 토큰류는 항상 이 헬퍼로만 내려보낸다. */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? '/'}`,
    'HttpOnly',
    'Secure',
    `SameSite=${options.sameSite ?? 'Lax'}`,
  ]
  if (options.maxAge !== undefined) {
    attributes.push(`Max-Age=${options.maxAge}`)
  }
  return attributes.join('; ')
}

export function expireCookie(name: string, path = '/'): string {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}
