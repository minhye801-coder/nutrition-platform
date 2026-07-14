const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

/** 로그인 전용 최소 스코프. Drive/Sheets 스코프는 설치 흐름(Milestone 후속 단계)에서 별도로 요청한다. */
export const GOOGLE_LOGIN_SCOPES = ['openid', 'email', 'profile']

interface AuthorizeUrlParams {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}

export function buildAuthorizationUrl(params: AuthorizeUrlParams): string {
  const url = new URL(AUTH_ENDPOINT)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_LOGIN_SCOPES.join(' '))
  url.searchParams.set('state', params.state)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  // 지금은 로그인 스코프만 요청하지만, 최초 동의 시점에 refresh token을 확보해 두면
  // 이후 Drive/Sheets 스코프를 점진 동의(incremental authorization)로 추가하기 쉬워진다.
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('include_granted_scopes', 'true')
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
