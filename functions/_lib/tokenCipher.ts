import { fromBase64Url, toBase64Url } from './crypto'

export interface EncryptedSecret {
  ciphertext: string
  iv: string
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/**
 * SESSION_SECRET에서 유도한 키로 OAuth access/refresh token을 AES-GCM 암호화한다.
 * D1의 oauth_tokens 테이블에는 평문 토큰을 저장하지 않고 이 결과(ciphertext+iv)만 저장한다.
 * 키를 별도 보관하지 않으므로, D1 테이블만 유출되어서는 토큰을 복호화할 수 없다.
 */
export async function encryptToken(secret: string, plaintext: string): Promise<EncryptedSecret> {
  const key = await deriveKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
    iv: toBase64Url(iv),
  }
}

export async function decryptToken(secret: string, encrypted: EncryptedSecret): Promise<string> {
  const key = await deriveKey(secret)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(encrypted.iv) },
    key,
    fromBase64Url(encrypted.ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}
