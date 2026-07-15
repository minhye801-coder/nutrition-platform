const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

/** 로그인 전용 최소 스코프. */
export const GOOGLE_LOGIN_SCOPES = ['openid', 'email', 'profile']

/**
 * Drive/Sheets 최소 권한 스코프. `drive.file`은 "이 앱이 만들었거나 사용자가 이 앱과
 * 명시적으로 공유한 파일"에만 접근을 허용하므로, 토큰이 유출되거나 서버가 침해되어도
 * 사용자 Drive의 다른 개인 파일에는 접근할 수 없다. Google Sheets API v4의 스프레드시트
 * 생성/편집(`spreadsheets.create`, `values.batchUpdate` 등)도 이 스코프로 만든 파일에
 * 한해 동일하게 허용되므로, Drive/Sheets 양쪽 모두 별도 스코프를 추가하지 않는다.
 */
export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

/** 설치 흐름(/setup) 진입 시 점진 동의로 추가 요청하는 전체 스코프. */
export const GOOGLE_INSTALL_SCOPES = [...GOOGLE_LOGIN_SCOPES, GOOGLE_DRIVE_FILE_SCOPE]

/** 세션에 저장된 공백 구분 scope 문자열에 Drive 최소 권한이 포함돼 있는지 확인한다. */
export function hasDriveScope(grantedScopes: string): boolean {
  return grantedScopes.split(' ').includes(GOOGLE_DRIVE_FILE_SCOPE)
}

interface AuthorizeUrlParams {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scopes: string[]
  /** 이미 부여된 스코프가 있어도 다시 동의 화면을 보여줘 refresh token 재발급을 보장한다. */
  forceConsent?: boolean
}

export function buildAuthorizationUrl(params: AuthorizeUrlParams): string {
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', params.scopes.join(' '))
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  // 최초 동의 시점에 refresh token을 확보해 두면 이후 Drive/Sheets 스코프를
  // 점진 동의(incremental authorization)로 추가하기 쉬워진다.
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('include_granted_scopes', 'true')
  if (params.forceConsent) {
    // 이미 로그인 스코프에 동의한 사용자에게도 동의 화면을 다시 띄워 새 refresh
    // token을 받는다 — Google은 재동의 없이는 refresh token을 다시 내려주지 않는다.
    url.searchParams.set('prompt', 'consent')
  }
  return url.toString()
}

interface GoogleTokenExchangeConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  id_token?: string
  scope: string
  token_type: string
}

export async function exchangeCodeForTokens(
  config: GoogleTokenExchangeConfig,
  code: string,
  codeVerifier: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

interface GoogleRefreshResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
}

/** refresh token으로 access token을 갱신한다. 응답에 새 refresh token은 포함되지 않는다. */
export async function refreshAccessToken(
  config: Pick<GoogleTokenExchangeConfig, 'clientId' | 'clientSecret'>,
  refreshToken: string,
): Promise<GoogleRefreshResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

export interface GoogleUserInfo {
  sub: string
  email: string
  name: string
  picture: string | null
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Google userinfo fetch failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    sub: string
    email: string
    name: string
    picture?: string
  }

  return { sub: data.sub, email: data.email, name: data.name, picture: data.picture ?? null }
}

/** 최선형(best-effort) 토큰 폐기. 실패해도 로그아웃 자체는 계속 진행되어야 한다. */
export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: 'POST' })
  } catch {
    // best-effort: 네트워크 오류가 로그아웃을 막지 않도록 무시한다.
  }
}
