import { randomString, sha256Base64Url } from '../../../_lib/crypto'
import { signPayload } from '../../../_lib/signedPayload'
import { serializeCookie } from '../../../_lib/cookies'
import { buildAuthorizationUrl } from '../../../_lib/googleOAuth'
import { hasOAuthConfig, type Env } from '../../../_lib/env'

const OAUTH_TRANSACTION_COOKIE = 'oauth_transaction'
const TRANSACTION_TTL_SECONDS = 600

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!hasOAuthConfig(env)) {
    return Response.json({ error: 'oauth_not_configured' }, { status: 500 })
  }

  const state = randomString(24)
  const codeVerifier = randomString(48)
  const codeChallenge = await sha256Base64Url(codeVerifier)

  const transactionToken = await signPayload(env.SESSION_SECRET, {
    state,
    codeVerifier,
    createdAt: Date.now(),
  })

  const authorizeUrl = buildAuthorizationUrl({
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    state,
    codeChallenge,
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
