import { fromBase64Url, hmacSign, hmacVerify, toBase64Url } from './crypto'

/**
 * SESSION_SECRET으로 서명한 JSON 페이로드를 "base64url(payload).signature" 형태의
 * 문자열로 직렬화한다. OAuth state/PKCE verifier처럼 서버 저장소 없이 쿠키에만
 * 담아 왕복시켜야 하는 단기 데이터에 사용한다.
 */
export async function signPayload(secret: string, payload: unknown): Promise<string> {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await hmacSign(secret, encoded)
  return `${encoded}.${signature}`
}

export async function verifyPayload<T>(secret: string, token: string): Promise<T | null> {
  const separatorIndex = token.indexOf('.')
  if (separatorIndex === -1) return null

  const encoded = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
  if (!encoded || !signature) return null

  const valid = await hmacVerify(secret, encoded, signature)
  if (!valid) return null

  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded))
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
