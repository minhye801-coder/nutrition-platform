import { SESSION_TTL_SECONDS, type SessionRecord, type SessionStore } from './sessionStore'
import { sha256Base64Url } from './crypto'
import { decryptToken, encryptToken } from './tokenCipher'

interface SessionRow {
  session_created_at: number
  expires_at: number
  user_id: string
  email: string
  name: string
  picture: string | null
  access_token_ciphertext: string | null
  access_token_iv: string | null
  refresh_token_ciphertext: string | null
  refresh_token_iv: string | null
  access_token_expires_at: number | null
  granted_scopes: string | null
}

/**
 * 운영용 D1 기반 세션 저장소. SessionRecord 하나를 users/oauth_tokens/sessions
 * 세 테이블에 나눠 저장한다 — 학생 데이터를 다루는 테이블과는 완전히 분리되어 있고,
 * 이 세 테이블에는 로그인/세션 유지에 필요한 최소 메타데이터만 들어간다.
 *
 * 쿠키에는 원본 세션 ID를 담아 내려보내지만, D1에는 그 SHA-256 해시(session_id_hash)만
 * 저장한다 — sessions 테이블만 유출되어도 쿠키 값을 재구성할 수 없다.
 * access/refresh token은 SESSION_SECRET으로 유도한 키로 AES-GCM 암호화한 뒤 저장한다.
 */
export function createD1SessionStore(db: D1Database, sessionSecret: string): SessionStore {
  return {
    async create(record) {
      const sessionIdHash = await sha256Base64Url(record.sessionId)
      const accessToken = await encryptToken(sessionSecret, record.accessToken)
      const refreshToken = record.refreshToken
        ? await encryptToken(sessionSecret, record.refreshToken)
        : null
      const expiresAt = record.createdAt + SESSION_TTL_SECONDS * 1000

      await db.batch([
        db
          .prepare(
            `INSERT INTO users (id, email, name, picture, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)
             ON CONFLICT(id) DO UPDATE SET
               email = excluded.email,
               name = excluded.name,
               picture = excluded.picture,
               updated_at = excluded.updated_at`,
          )
          .bind(record.googleSub, record.email, record.name, record.picture, record.createdAt),

        db
          .prepare(
            `INSERT INTO oauth_tokens (
               user_id, access_token_ciphertext, access_token_iv,
               refresh_token_ciphertext, refresh_token_iv,
               access_token_expires_at, granted_scopes, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
             ON CONFLICT(user_id) DO UPDATE SET
               access_token_ciphertext = excluded.access_token_ciphertext,
               access_token_iv = excluded.access_token_iv,
               refresh_token_ciphertext = COALESCE(excluded.refresh_token_ciphertext, refresh_token_ciphertext),
               refresh_token_iv = COALESCE(excluded.refresh_token_iv, refresh_token_iv),
               access_token_expires_at = excluded.access_token_expires_at,
               granted_scopes = excluded.granted_scopes,
               updated_at = excluded.updated_at`,
          )
          .bind(
            record.googleSub,
            accessToken.ciphertext,
            accessToken.iv,
            refreshToken?.ciphertext ?? null,
            refreshToken?.iv ?? null,
            record.accessTokenExpiresAt,
            record.grantedScopes,
            record.createdAt,
          ),

        db
          .prepare(
            `INSERT INTO sessions (session_id_hash, user_id, expires_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(session_id_hash) DO UPDATE SET
               expires_at = excluded.expires_at,
               updated_at = excluded.updated_at`,
          )
          .bind(sessionIdHash, record.googleSub, expiresAt, record.createdAt),
      ])
    },

    async get(sessionId) {
      const sessionIdHash = await sha256Base64Url(sessionId)

      const row = await db
        .prepare(
          `SELECT
             s.created_at AS session_created_at,
             s.expires_at AS expires_at,
             u.id AS user_id, u.email AS email, u.name AS name, u.picture AS picture,
             t.access_token_ciphertext, t.access_token_iv,
             t.refresh_token_ciphertext, t.refresh_token_iv,
             t.access_token_expires_at, t.granted_scopes
           FROM sessions s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN oauth_tokens t ON t.user_id = u.id
           WHERE s.session_id_hash = ?1`,
        )
        .bind(sessionIdHash)
        .first<SessionRow>()

      if (!row || !row.access_token_ciphertext || !row.access_token_iv) return null

      if (row.expires_at <= Date.now()) {
        await db.prepare(`DELETE FROM sessions WHERE session_id_hash = ?1`).bind(sessionIdHash).run()
        return null
      }

      const accessToken = await decryptToken(sessionSecret, {
        ciphertext: row.access_token_ciphertext,
        iv: row.access_token_iv,
      })
      const refreshToken =
        row.refresh_token_ciphertext && row.refresh_token_iv
          ? await decryptToken(sessionSecret, {
              ciphertext: row.refresh_token_ciphertext,
              iv: row.refresh_token_iv,
            })
          : null

      const record: SessionRecord = {
        sessionId,
        googleSub: row.user_id,
        email: row.email,
        name: row.name,
        picture: row.picture,
        accessToken,
        refreshToken,
        accessTokenExpiresAt: row.access_token_expires_at ?? 0,
        grantedScopes: row.granted_scopes ?? '',
        createdAt: row.session_created_at,
      }
      return record
    },

    async delete(sessionId) {
      const sessionIdHash = await sha256Base64Url(sessionId)
      await db.prepare(`DELETE FROM sessions WHERE session_id_hash = ?1`).bind(sessionIdHash).run()
    },

    async updateAccessToken(userId, update) {
      const accessToken = await encryptToken(sessionSecret, update.accessToken)
      const now = Date.now()

      if (update.refreshToken !== undefined) {
        const refreshToken = update.refreshToken ? await encryptToken(sessionSecret, update.refreshToken) : null
        await db
          .prepare(
            `UPDATE oauth_tokens SET
               access_token_ciphertext = ?2, access_token_iv = ?3,
               refresh_token_ciphertext = ?4, refresh_token_iv = ?5,
               access_token_expires_at = ?6, granted_scopes = COALESCE(?7, granted_scopes),
               updated_at = ?8
             WHERE user_id = ?1`,
          )
          .bind(
            userId,
            accessToken.ciphertext,
            accessToken.iv,
            refreshToken?.ciphertext ?? null,
            refreshToken?.iv ?? null,
            update.accessTokenExpiresAt,
            update.grantedScopes ?? null,
            now,
          )
          .run()
        return
      }

      await db
        .prepare(
          `UPDATE oauth_tokens SET
             access_token_ciphertext = ?2, access_token_iv = ?3,
             access_token_expires_at = ?4, granted_scopes = COALESCE(?5, granted_scopes),
             updated_at = ?6
           WHERE user_id = ?1`,
        )
        .bind(userId, accessToken.ciphertext, accessToken.iv, update.accessTokenExpiresAt, update.grantedScopes ?? null, now)
        .run()
    },
  }
}
