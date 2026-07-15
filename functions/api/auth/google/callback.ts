import { verifyPayload } from '../../../_lib/signedPayload'
import { randomString } from '../../../_lib/crypto'
import { parseCookies, serializeCookie, expireCookie } from '../../../_lib/cookies'
import { exchangeCodeForTokens, fetchGoogleUserInfo } from '../../../_lib/googleOAuth'
import { getSessionStore, getInstallationStore } from '../../../_lib/stores'
import { SESSION_TTL_SECONDS } from '../../../_lib/sessionStore'
import { hasOAuthConfig, type Env } from '../../../_lib/env'

const OAUTH_TRANSACTION_COOKIE = 'oauth_transaction'
const SESSION_COOKIE = 'session'
const TRANSACTION_TTL_MS = 10 * 60 * 1000

interface TransactionPayload {
  state: string
  codeVerifier: string
  purpose: 'login' | 'install'
  createdAt: number
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasOAuthConfig(env)) {
    return Response.json({ error: 'oauth_not_configured' }, { status: 500 })
  }

  const url = new URL(request.url)
  const cookies = parseCookies(request.headers.get('Cookie'))
  const transactionToken = cookies[OAUTH_TRANSACTION_COOKIE]
  // 서명 검증까지 먼저 끝내 둔다 — 아래 오류 분기들이 purpose를 안전하게(위조 불가능하게)
  // 참고해 install 흐름은 /setup으로, login 흐름은 /login으로 되돌릴 수 있게 하기 위함이다.
  const transaction = transactionToken
    ? await verifyPayload<TransactionPayload>(env.SESSION_SECRET, transactionToken)
    : null

  function redirectBack(reason: string): Response {
    const destination =
      transaction?.purpose === 'install'
        ? `/setup?consent=${encodeURIComponent(reason)}`
        : `/login?error=${encodeURIComponent(reason)}`
    return new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        'Set-Cookie': expireCookie(OAUTH_TRANSACTION_COOKIE, '/api/auth'),
      },
    })
  }

  // 사용자가 Google 동의 화면에서 거부했을 때: install 목적이면 /setup으로 돌려보내
  // 명확한 안내와 재시도 버튼을 보여주고, login 목적이면 기존처럼 /login으로 보낸다.
  if (url.searchParams.get('error')) {
    return redirectBack('access_denied')
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return redirectBack('missing_code_or_state')
  }

  if (!transactionToken) {
    return redirectBack('missing_transaction')
  }

  if (!transaction) {
    return redirectBack('invalid_transaction')
  }

  if (Date.now() - transaction.createdAt > TRANSACTION_TTL_MS) {
    return redirectBack('transaction_expired')
  }

  if (transaction.state !== state) {
    return redirectBack('state_mismatch')
  }

  try {
    const tokens = await exchangeCodeForTokens(
      {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: env.GOOGLE_REDIRECT_URI,
      },
      code,
      transaction.codeVerifier,
    )

    const profile = await fetchGoogleUserInfo(tokens.access_token)

    const sessionId = randomString(32)
    await getSessionStore(env).create({
      sessionId,
      googleSub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      grantedScopes: tokens.scope ?? '',
      createdAt: Date.now(),
    })

    // install 목적 동의는 설치 흐름 중간에 발생하므로, 완료 여부와 무관하게 항상
    // /setup으로 돌아가 설치를 이어간다(진행 상태는 installation_progress에 남아있다).
    let destination = '/setup'
    if (transaction.purpose !== 'install') {
      const installation = await getInstallationStore(env).get(profile.sub)
      destination = installation ? '/app' : '/setup'
    }

    const headers = new Headers()
    headers.append('Location', destination)
    headers.append(
      'Set-Cookie',
      serializeCookie(SESSION_COOKIE, sessionId, { maxAge: SESSION_TTL_SECONDS, path: '/' }),
    )
    headers.append('Set-Cookie', expireCookie(OAUTH_TRANSACTION_COOKIE, '/api/auth'))

    return new Response(null, { status: 302, headers })
  } catch (error) {
    console.error('Google OAuth callback failed', error)
    return redirectBack('token_exchange_failed')
  }
}
