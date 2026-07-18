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
  // "다른 계정으로 로그인"(체험 모드 안내 화면) 전용 — 다른 파라미터와 조합되지 않는다.
  const promptSelectAccount = url.searchParams.get('account') === 'choose'

  const state = randomString(24)
  const codeVerifier = randomString(48)
  const codeChallenge = await sha256Base64Url(codeVerifier)

  const transactionToken = await signPayload(env.SESSION_SECRET, {
    state,
    codeVerifier,
    purpose,
    createdAt: Date.now(),
  })

  const scopes = purpose === 'install' ? GOOGLE_INSTALL_SCOPES : GOOGLE_LOGIN_SCOPES

  const authorizeUrl = buildAuthorizationUrl({
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    state,
    codeChallenge,
    scopes,
    // offline access(=refresh token 발급)와 강제 재동의는 설치(Drive) 흐름에만 필요하다.
    // 일반 로그인에 이 둘을 걸면 이미 로그인한 적 있는 사용자에게도 동의 화면이
    // 다시 뜰 수 있다 — 세션 유지 자체는 Google 토큰이 아니라 세션 쿠키가 담당한다.
    offlineAccess: purpose === 'install',
    forceConsent: purpose === 'install',
    promptSelectAccount,
  })

  // 비밀값(client_secret, code_verifier, access/refresh token)은 절대 포함하지 않는다.
  // scope 목록과 purpose만 남겨, 운영 배포에서 실제로 어떤 scope를 요청하는지
  // Cloudflare Pages Functions 로그(대시보드 Logs 또는 `wrangler pages deployment tail`)로
  // 바로 확인할 수 있게 한다.
  console.log('[oauth] authorize request', {
    purpose,
    scopes,
    offlineAccess: purpose === 'install',
    forceConsent: purpose === 'install',
    promptSelectAccount,
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
