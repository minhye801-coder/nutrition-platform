import { parseCookies, expireCookie } from '../../_lib/cookies'
import { getSessionStore } from '../../_lib/stores'
import { revokeGoogleToken } from '../../_lib/googleOAuth'
import type { Env } from '../../_lib/env'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cookies = parseCookies(request.headers.get('Cookie'))
  const sessionId = cookies['session']

  if (sessionId) {
    const store = getSessionStore(env)
    const session = await store.get(sessionId)
    if (session) {
      // 사용자 Drive/Sheets 데이터는 건드리지 않는다 — 세션과 Google 토큰만 폐기한다.
      const revokeTarget = session.refreshToken ?? session.accessToken
      if (revokeTarget) {
        await revokeGoogleToken(revokeTarget)
      }
      await store.delete(sessionId)
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': expireCookie('session', '/'),
    },
  })
}
