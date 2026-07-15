import { randomString, sha256Base64Url } from '../../../_lib/crypto'
import { signPayload } from '../../../_lib/signedPayload'
import { serializeCookie } from '../../../_lib/cookies'
import {
  buildAuthorizationUrl,
  GOOGLE_INSTALL_SCOPES,
  GOOGLE_LOGIN_SCOPES,
} from '../../../_lib/googleOAuth'
import { hasOAuthConfig, type Env } from '../../../_lib/env'

const OAUTH_TRANSACTION_COOKIE = 'oauth_transaction'
const TRANSACTION_TTL_SECONDS = 600

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!hasOAuthConfig(env)) {
    return Response.json({ error: 'oauth_not_configured' }, { status: 500 })
  }

  const url = new URL(request.url)
  // /setup에서 Drive/Sheets 권한이 부족할 때만 ?purpose=install로 진입한다.
  // 그 외(기본값)는 로그인 전용 최소 스코프만 요청한다(9절 "로그인 권한과 Drive/Sheets 권한 분리").
  const purpose = url.searchParams.get('purpose') === 'install' ? 'install' : 'login'

  const state = randomString(24)
  const codeVerifier = randomString(48)
  const codeChallenge = await sha256Base64Url(codeVerifier)

  const transactionToken = await signPayload(env.SESSION_SECRET, {
    state,
    codeVerifier,
    purpose,
    createdAt: Date.now(),
  })

  const authorizeUrl = buildAuthorizationUrl({
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    state,
    codeChallenge,
    scopes: purpose === 'install' ? GOOGLE_INSTALL_SCOPES : GOOGLE_LOGIN_SCOPES,
    forceConsent: purpose === 'install',
  })

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': serializeCookie(OAUTH_TRANSACTION_COOKIE, transactionToken, {
        maxAge: TRANSACTION_TTL_SECONDS,
        path: '/api/auth',
      }),
    },
  })
}
