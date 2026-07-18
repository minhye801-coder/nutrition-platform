const BASE64URL_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function toBase64Url(bytes: Uint8Array): string {
  let result = ''
  let i = 0
  for (; i + 3 <= bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    result += BASE64URL_CHARS[(chunk >> 18) & 63]
    result += BASE64URL_CHARS[(chunk >> 12) & 63]
    result += BASE64URL_CHARS[(chunk >> 6) & 63]
    result += BASE64URL_CHARS[chunk & 63]
  }
  const remaining = bytes.length - i
  if (remaining === 1) {
    const chunk = bytes[i] << 16
    result += BASE64URL_CHARS[(chunk >> 18) & 63]
    result += BASE64URL_CHARS[(chunk >> 12) & 63]
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8)
    result += BASE64URL_CHARS[(chunk >> 18) & 63]
    result += BASE64URL_CHARS[(chunk >> 12) & 63]
    result += BASE64URL_CHARS[(chunk >> 6) & 63]
  }
  return result
}

export function fromBase64Url(value: string): Uint8Array {
  const lookup = new Map(BASE64URL_CHARS.split('').map((char, index) => [char, index]))
  const bytes: number[] = []
  let buffer = 0
  let bits = 0

  for (const char of value) {
    const charValue = lookup.get(char)
    if (charValue === undefined) continue
    buffer = (buffer << 6) | charValue
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }

  return new Uint8Array(bytes)
}

export function randomString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
}

const PUBLIC_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 0/O, 1/I 등 혼동되는 문자는 제외

/** schoolPublicId처럼 사람이 손으로 옮겨 적을 수 있어야 하는 공개 식별자용 랜덤 문자열. */
export function randomPublicId(length = 6): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let result = ''
  for (let i = 0; i < length; i += 1) {
    result += PUBLIC_ID_CHARS[bytes[i] % PUBLIC_ID_CHARS.length]
  }
  return result
}

/**
 * 학생 영구 식별자(StudentID) 생성. 요구사항: 예측 불가능한 암호학적 난수, 순번/학년/반/
 * 이름 해시 등 어떤 형태로도 원문을 유추할 수 없는 값, 12자 이상의 충분한 난수성.
 * `STU-XXXX-XXXX-XXXX` 형식(구분자 제외 12자, PUBLIC_ID_CHARS 32종 알파벳 기준 60비트
 * 엔트로피)으로 `STU-K7P4-Q9XM-2R8D`처럼 사람이 손으로 옮겨 적을 수 있게 한다.
 * 충돌 검사는 호출부(functions/_lib/studentSheet.ts의 createStudent)가 기존 학생
 * 시트를 조회해 재시도하는 방식으로 수행한다(이 함수 자체는 순수 난수 생성만 담당).
 */
export function generateStudentId(): string {
  const groups = [randomPublicId(4), randomPublicId(4), randomPublicId(4)]
  return `STU-${groups.join('-')}`
}

export async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64Url(new Uint8Array(digest))
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await importHmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toBase64Url(new Uint8Array(signature))
}

export async function hmacVerify(
  secret: string,
  message: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSign(secret, message)
  if (expected.length !== signature.length) return false

  let diff = 0
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}
