import { fetchGrantedScopes, hasDriveScope, refreshAccessToken } from './googleOAuth'
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
 * 세션의 access token이 곧 만료되면 refresh token으로 갱신하고 저장소에도 반영한다.
 * 여기서는 만료 여부만 본다 — 실제로 필요한 scope(예: drive.file)를 갖고 있는지는
 * 확인하지 않는다. Drive/Sheets를 호출할 거라면 `ensureDriveAccessToken`을 대신 써라.
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

/**
 * Drive/Sheets를 실제로 호출하기 직전에 쓴다. 단순히 만료 여부만 보는
 * `ensureFreshAccessToken`과 달리, 반환하는 access token이 **지금 이 순간 실제로
 * drive.file 권한을 갖고 있는지**를 Google에 직접 물어 확인한다.
 *
 * 이게 필요한 이유: 세션에 캐시된 access token은 만료 전이라도 실제 권한과 어긋날
 * 수 있다 — 예를 들어 설치(install) 동의를 마친 뒤 사용자가 별도로 일반 로그인을
 * 한 번 더 하면, 그 로그인 교환이 access token만 새로 내려주고(만료 전이므로 이
 * 함수 기준으로는 "아직 안 만료됨"), 그 access token 자체는 로그인 스코프만 가진
 * 채로 세션에 남을 수 있다. 이 상태로 Drive/Sheets를 호출하면 403(권한 부족)이
 * 나는데, 그 원인을 요청 시점에 미리 걸러내지 않으면 사용자에게는 원인불명의
 * 실패로만 보인다. `functions/_lib/setupOrchestrator.ts`가 설치 흐름에서 쓰던
 * 것과 같은 검증을 학생정보 등 일반 데이터 API에도 동일하게 적용한다.
 */
export async function ensureDriveAccessToken(env: Env, session: SessionRecord): Promise<string> {
  const token = await ensureFreshAccessToken(env, session)

  let scopes: string
  try {
    scopes = await fetchGrantedScopes(token)
  } catch {
    throw new ReauthRequiredError()
  }

  if (hasDriveScope(scopes)) {
    if (scopes !== session.grantedScopes) {
      // 캐시가 낡아 있었을 뿐 실제로는 문제 없음 — 다음 요청부터 정확한 값을 보게 베스트 에포트로 바로잡는다.
      await getSessionStore(env)
        .updateAccessToken(session.googleSub, {
          accessToken: token,
          accessTokenExpiresAt: session.accessTokenExpiresAt,
          grantedScopes: scopes,
        })
        .catch(() => {})
      session.grantedScopes = scopes
    }
    return token
  }

  // 캐시된 access token엔 drive.file이 없다 — refresh token으로 한 번 더 강제 갱신을 시도한다.
  if (!session.refreshToken) {
    throw new ReauthRequiredError()
  }

  let refreshed
  try {
    refreshed = await refreshAccessToken(
      { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
      session.refreshToken,
    )
  } catch {
    throw new ReauthRequiredError()
  }

  if (!hasDriveScope(refreshed.scope ?? '')) {
    throw new ReauthRequiredError()
  }

  const accessTokenExpiresAt = Date.now() + refreshed.expires_in * 1000
  await getSessionStore(env).updateAccessToken(session.googleSub, {
    accessToken: refreshed.access_token,
    accessTokenExpiresAt,
    grantedScopes: refreshed.scope,
  })
  session.accessToken = refreshed.access_token
  session.accessTokenExpiresAt = accessTokenExpiresAt
  session.grantedScopes = refreshed.scope

  return refreshed.access_token
}
