import { refreshAccessToken } from './googleOAuth'
import { getSessionStore } from './stores'
import type { SessionRecord } from './sessionStore'
import type { Env } from './env'

const EXPIRY_BUFFER_MS = 60_000

export class ReauthRequiredError extends Error {
  constructor() {
    super('reauth_required')
    this.name = 'ReauthRequiredError'
  }
}

/**
 * 설치 흐름에서 Drive/Sheets 호출 직전에 사용하는 access token을 반환한다.
 * 세션의 access token이 곧 만료되면 refresh token으로 갱신하고 저장소에도 반영한다.
 * refresh token이 없거나 갱신이 거부되면(예: 사용자가 외부에서 연결 해제) 재인증이
 * 필요하다는 의미로 ReauthRequiredError를 던진다 — 이 경우 호출자는 설치 흐름을
 * 점진 동의(consent) 단계로 되돌려야 한다.
 */
export async function ensureFreshAccessToken(env: Env, session: SessionRecord): Promise<string> {
  const now = Date.now()
  if (session.accessTokenExpiresAt > now + EXPIRY_BUFFER_MS) {
    return session.accessToken
  }
  if (!session.refreshToken) {
    throw new ReauthRequiredError()
  }

  try {
    const refreshed = await refreshAccessToken(
      { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
      session.refreshToken,
    )
    const accessTokenExpiresAt = now + refreshed.expires_in * 1000

    await getSessionStore(env).updateAccessToken(session.googleSub, {
      accessToken: refreshed.access_token,
      accessTokenExpiresAt,
      grantedScopes: refreshed.scope,
    })

    session.accessToken = refreshed.access_token
    session.accessTokenExpiresAt = accessTokenExpiresAt
    if (refreshed.scope) session.grantedScopes = refreshed.scope

    return refreshed.access_token
  } catch {
    throw new ReauthRequiredError()
  }
}
