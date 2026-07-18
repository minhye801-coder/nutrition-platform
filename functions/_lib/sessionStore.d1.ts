import { SESSION_TTL_SECONDS, type AccountTokens, type SessionRecord, type SessionStore } from './sessionStore'
import { sha256Base64Url } from './crypto'
import { decryptToken, encryptToken } from './tokenCipher'
import { computeAccountMode } from './accountMode'

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
  hosted_domain: string | null
  school_use_confirmed: number
  confirmation_version: string | null
  confirmed_at: number | null
}

/**
 * 운영용 D1 기반 세션 저장소. SessionRecord 하나를 users/oauth_tokens/sessions
 * 세 테이블에 나눠 저장한다 — 학생 데이터를 다루는 테이블과는 완전히 분리되어 있고,
 * 이 세 테이블에는 로그인/세션 유지에 필요한 최소 메타데이터만 들어간다.
 *
 * 쿠키에는 원본 세션 ID를 담아 내려보내지만, D1에는 그 SHA-256 해시(session_id_hash)만
 * 저장한다 — sessions 테이블만 유출되어도 쿠키 값을 재구성할 수 없다.
 * access/refresh token은 SESSION_SECRET으로 유도한 키로 AES-GCM 암호화한 뒤 저장한다.
 *
 * confirmationVersion은 env.PRIVACY_CONFIRMATION_VERSION을 그대로 전달받아, get()이
 * 매 요청마다 accountMode를 정확히(현재 버전 기준으로) 다시 계산할 수 있게 한다
 * (functions/_lib/stores.ts에서 넘겨준다).
 */
export function createD1SessionStore(
  db: D1Database,
  sessionSecret: string,
  confirmationVersion: string,
): SessionStore {
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
            `INSERT INTO users (
               id, email, name, picture,
               hosted_domain, account_mode, domain_approval_status, school_use_confirmed,
               confirmation_version, confirmed_at,
               created_at, updated_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'not_applicable', ?7, ?8, ?9, ?10, ?10)
             ON CONFLICT(id) DO UPDATE SET
               email = excluded.email,
               name = excluded.name,
               picture = excluded.picture,
               hosted_domain = excluded.hosted_domain,
               account_mode = excluded.account_mode,
               updated_at = excluded.updated_at`,
            // school_use_confirmed/confirmation_version/confirmed_at은 의도적으로
            // UPDATE SET에서 뺐다 — 기존 사용자가 이미 확인을 완료했다면 재로그인해도
            // 그 값을 그대로 유지해야 한다(매 로그인마다 재확인 화면을 다시 보게 하지
            // 않기 위함, confirmationVersion이 바뀐 경우만 get()이 다시 계산해 예외
            // 처리한다). 신규 사용자에게만 아래 바인딩 값(보통 미확인 상태)이 초기값으로
            // 들어간다.
          )
          .bind(
            record.googleSub,
            record.email,
            record.name,
            record.picture,
            record.hostedDomain,
            record.accountMode,
            record.schoolUseConfirmed ? 1 : 0,
            record.confirmationVersion,
            record.confirmedAt,
            record.createdAt,
          ),

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
             u.hosted_domain, u.school_use_confirmed, u.confirmation_version, u.confirmed_at,
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

      const schoolUseConfirmed = row.school_use_confirmed === 1
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
        // 저장된 문자열을 그대로 믿지 않고 매 요청마다 다시 계산한다 — 이래야
        // confirmationVersion이 바뀌면 재로그인 없이도 바로 재확인 화면으로 돌아간다.
        accountMode: computeAccountMode(
          row.hosted_domain,
          { confirmed: schoolUseConfirmed, confirmedVersion: row.confirmation_version },
          confirmationVersion,
        ),
        hostedDomain: row.hosted_domain,
        schoolUseConfirmed,
        confirmationVersion: row.confirmation_version ?? '',
        confirmedAt: row.confirmed_at,
      }
      return record
    },

    async delete(sessionId) {
      const sessionIdHash = await sha256Base64Url(sessionId)
      await db.prepare(`DELETE FROM sessions WHERE session_id_hash = ?1`).bind(sessionIdHash).run()
    },

    async getTokensByUserId(userId): Promise<AccountTokens | null> {
      const row = await db
        .prepare(
          `SELECT access_token_ciphertext, access_token_iv,
                  refresh_token_ciphertext, refresh_token_iv,
                  access_token_expires_at, granted_scopes
           FROM oauth_tokens WHERE user_id = ?1`,
        )
        .bind(userId)
        .first<Pick<
          SessionRow,
          | 'access_token_ciphertext'
          | 'access_token_iv'
          | 'refresh_token_ciphertext'
          | 'refresh_token_iv'
          | 'access_token_expires_at'
          | 'granted_scopes'
        >>()

      if (!row || !row.access_token_ciphertext || !row.access_token_iv) return null

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

      return {
        accessToken,
        refreshToken,
        accessTokenExpiresAt: row.access_token_expires_at ?? 0,
        grantedScopes: row.granted_scopes ?? '',
      }
    },

    async confirmSchoolUse(userId, version, confirmedAt) {
      await db
        .prepare(
          `UPDATE users
           SET school_use_confirmed = 1, confirmation_version = ?2, confirmed_at = ?3, updated_at = ?3
           WHERE id = ?1`,
        )
        .bind(userId, version, confirmedAt)
        .run()
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
