import { fromBase64Url } from './crypto'

const JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs'
const ALLOWED_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']

/**
 * Google ID Token(JWT)의 RS256 서명을 Google 공개키(JWKS)로 직접 검증한다. 이 앱은
 * 지금까지 외부 JWT 라이브러리를 쓰지 않고 crypto.subtle을 직접 호출하는 스타일을
 * 유지해 왔으므로(functions/_lib/crypto.ts의 HMAC 구현 참고) 여기서도 같은 방식을
 * 따른다. hosted domain(`hd`) 클레임은 이 토큰 안에만 있고 userinfo 엔드포인트
 * (fetchGoogleUserInfo)는 내려주지 않으므로, 학교 Workspace 계정 판정은 반드시 이
 * 함수를 거쳐야 한다.
 */

interface JsonWebKey {
  kid: string
  n: string
  e: string
  alg: string
  kty: string
}

let cachedKeys: { keys: JsonWebKey[]; fetchedAt: number } | null = null
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000

async function fetchJwks(): Promise<JsonWebKey[]> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cachedKeys.keys
  }
  const response = await fetch(JWKS_ENDPOINT)
  if (!response.ok) {
    throw new Error(`Google JWKS fetch failed: ${response.status}`)
  }
  const data = (await response.json()) as { keys: JsonWebKey[] }
  cachedKeys = { keys: data.keys, fetchedAt: Date.now() }
  return data.keys
}

function base64UrlJsonParse(segment: string): Record<string, unknown> {
  const bytes = fromBase64Url(segment)
  const text = new TextDecoder().decode(bytes)
  return JSON.parse(text)
}

export class IdTokenVerificationError extends Error {
  constructor(reason: string) {
    super(`id_token verification failed: ${reason}`)
    this.name = 'IdTokenVerificationError'
  }
}

export interface VerifiedIdToken {
  sub: string
  email: string
  emailVerified: boolean
  /** Google Workspace 계정에서만 존재. 개인 Gmail 계정은 undefined. */
  hostedDomain: string | undefined
}

/**
 * ID Token의 서명·발급자·수신자(aud)·만료를 전부 검증한 뒤에만 클레임을 반환한다.
 * 하나라도 실패하면 IdTokenVerificationError를 던진다 — 호출부는 이 경우 로그인
 * 자체를 실패 처리해야 한다(검증 실패한 토큰의 클레임을 신뢰해서는 안 됨).
 */
export async function verifyGoogleIdToken(idToken: string, expectedAudience: string): Promise<VerifiedIdToken> {
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    throw new IdTokenVerificationError('malformed_token')
  }
  const [headerB64, payloadB64, signatureB64] = parts

  const header = base64UrlJsonParse(headerB64) as { kid?: string; alg?: string }
  if (header.alg !== 'RS256' || !header.kid) {
    throw new IdTokenVerificationError('unsupported_alg')
  }

  let keys = await fetchJwks()
  let jwk = keys.find((key) => key.kid === header.kid)
  if (!jwk) {
    // 키 로테이션 직후일 수 있으니 캐시를 무시하고 한 번 더 시도한다.
    cachedKeys = null
    keys = await fetchJwks()
    jwk = keys.find((key) => key.kid === header.kid)
  }
  if (!jwk) {
    throw new IdTokenVerificationError('unknown_kid')
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg, ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature = fromBase64Url(signatureB64)
  const validSignature = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData)
  if (!validSignature) {
    throw new IdTokenVerificationError('invalid_signature')
  }

  const payload = base64UrlJsonParse(payloadB64) as {
    iss?: string
    aud?: string
    exp?: number
    sub?: string
    email?: string
    email_verified?: boolean
    hd?: string
  }

  if (!payload.iss || !ALLOWED_ISSUERS.includes(payload.iss)) {
    throw new IdTokenVerificationError('invalid_issuer')
  }
  if (payload.aud !== expectedAudience) {
    throw new IdTokenVerificationError('invalid_audience')
  }
  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new IdTokenVerificationError('expired')
  }
  if (!payload.sub || !payload.email) {
    throw new IdTokenVerificationError('missing_claims')
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    hostedDomain: payload.hd,
  }
}
