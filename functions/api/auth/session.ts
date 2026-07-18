import { parseCookies } from '../../_lib/cookies'
import { getSessionStore } from '../../_lib/stores'
import type { Env } from '../../_lib/env'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const cookies = parseCookies(request.headers.get('Cookie'))
  const sessionId = cookies['session']
  if (!sessionId) {
    return Response.json({ authenticated: false })
  }

  const session = await getSessionStore(env).get(sessionId)
  if (!session) {
    return Response.json({ authenticated: false })
  }

  return Response.json({
    authenticated: true,
    user: {
      email: session.email,
      name: session.name,
      picture: session.picture,
      accountMode: session.accountMode,
      hostedDomain: session.hostedDomain,
      schoolUseConfirmed: session.schoolUseConfirmed,
    },
  })
}
