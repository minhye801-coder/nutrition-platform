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
