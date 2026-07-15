import { parseCookies } from './cookies'
import { getSessionStore } from './stores'
import type { SessionRecord } from './sessionStore'
import type { Env } from './env'

/** 쿠키의 세션 ID로 로그인 세션을 조회한다. 없으면 null(호출자가 401을 내려준다). */
export async function requireSession(request: Request, env: Env): Promise<SessionRecord | null> {
  const cookies = parseCookies(request.headers.get('Cookie'))
  const sessionId = cookies['session']
  if (!sessionId) return null
  return getSessionStore(env).get(sessionId)
}
