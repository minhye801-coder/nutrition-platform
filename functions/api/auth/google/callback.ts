import { verifyPayload } from '../../../_lib/signedPayload'
import { randomString } from '../../../_lib/crypto'
import { parseCookies, serializeCookie, expireCookie } from '../../../_lib/cookies'
import { exchangeCodeForTokens, fetchGoogleUserInfo } from '../../../_lib/googleOAuth'
import { verifyGoogleIdToken, IdTokenVerificationError } from '../../../_lib/googleIdToken'
import { resolveAccountMode } from '../../../_lib/accountMode'
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

    // 비밀값은 포함하지 않는다 — Google이 실제로 부여한 scope 문자열만 남겨,
    // 요청한 scope(index.ts 로그)와 실제 부여된 scope가 다른지 바로 대조할 수 있게 한다.
    console.log('[oauth] token exchange result', {
      purpose: transaction.purpose,
      grantedScopes: tokens.scope ?? '',
      hasRefreshToken: Boolean(tokens.refresh_token),
    })

    const profile = await fetchGoogleUserInfo(tokens.access_token)

    // hosted domain(hd) 클레임은 userinfo 엔드포인트가 아니라 ID Token에만 있다 —
    // 학교 Workspace 계정 여부는 반드시 서버가 이 서명 검증을 거쳐 판정한다
    // (클라이언트가 accountMode를 자칭할 수 없게 하는 핵심 방어선, 요구사항 1절).
    if (!tokens.id_token) {
      console.error('[oauth] id_token missing from token exchange response')
      return redirectBack('token_exchange_failed')
    }
    let verifiedIdToken
    try {
      verifiedIdToken = await verifyGoogleIdToken(tokens.id_token, env.GOOGLE_CLIENT_ID)
    } catch (error) {
      console.error('[oauth] id_token verification failed', error instanceof IdTokenVerificationError ? error.message : error)
      return redirectBack('token_exchange_failed')
    }
    // userinfo(access token 기반)와 id_token(서명 검증됨)의 계정이 다르면 위조 시도로
    // 간주하고 로그인을 거부한다 — 둘 다 같은 토큰 교환에서 나왔으므로 정상 흐름이면
    // 항상 일치해야 한다.
    if (verifiedIdToken.sub !== profile.sub || verifiedIdToken.email !== profile.email) {
      console.error('[oauth] id_token/userinfo account mismatch')
      return redirectBack('token_exchange_failed')
    }

    const { accountMode, domainApprovalStatus } = await resolveAccountMode(env, verifiedIdToken.hostedDomain)

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
      accountMode,
      hostedDomain: verifiedIdToken.hostedDomain ?? null,
      domainApprovalStatus,
      schoolUseConfirmed: false,
    })

    // school_use_confirmed는 create()가 신규 사용자에게만 초기값을 넣고 기존 사용자는
    // 손대지 않으므로(위 참고), 방금 만든 세션을 다시 읽어 진짜 현재 값을 확인한다.
    const freshSession = await getSessionStore(env).get(sessionId)
    const schoolUseConfirmed = freshSession?.schoolUseConfirmed ?? false

    // 학교 업무용 계정 확인(SCHOOL_WORKSPACE) 또는 체험 모드 안내(그 외)를 아직 보지
    // 않은 사용자는 /setup·/app보다 먼저 /account/confirm을 거쳐야 한다 — 클라이언트
    // AccountModeGate도 같은 규칙으로 한 번 더 막지만(요구사항 8절 "버튼 숨김만으로
    // 끝내지 않음"), 리다이렉트 목적지 자체도 여기서 맞춰 준다.
    let destination = '/account/confirm'
    if (accountMode === 'SCHOOL_WORKSPACE' && schoolUseConfirmed) {
      // install 목적 동의는 설치 흐름 중간에 발생하므로, 완료 여부와 무관하게 항상
      // /setup으로 돌아가 설치를 이어간다(진행 상태는 installation_progress에 남아있다).
      destination = '/setup'
      if (transaction.purpose !== 'install') {
        const installation = await getInstallationStore(env).get(profile.sub)
        destination = installation ? '/app' : '/setup'
      }
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
