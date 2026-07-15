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

function redirectToLogin(reason: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `/login?error=${encodeURIComponent(reason)}`,
      'Set-Cookie': expireCookie(OAUTH_TRANSACTION_COOKIE, '/api/auth'),
    },
  })
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasOAuthConfig(env)) {
    return Response.json({ error: 'oauth_not_configured' }, { status: 500 })
  }

  const url = new URL(request.url)

  if (url.searchParams.get('error')) {
    return redirectToLogin('access_denied')
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return redirectToLogin('missing_code_or_state')
  }

  const cookies = parseCookies(request.headers.get('Cookie'))
  const transactionToken = cookies[OAUTH_TRANSACTION_COOKIE]
  if (!transactionToken) {
    return redirectToLogin('missing_transaction')
  }

  const transaction = await verifyPayload<TransactionPayload>(env.SESSION_SECRET, transactionToken)
  if (!transaction) {
    return redirectToLogin('invalid_transaction')
  }

  if (Date.now() - transaction.createdAt > TRANSACTION_TTL_MS) {
    return redirectToLogin('transaction_expired')
  }

  if (transaction.state !== state) {
    return redirectToLogin('state_mismatch')
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
    return redirectToLogin('token_exchange_failed')
  }
}
