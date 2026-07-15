import { requireSession } from '../../_lib/requireSession'
import { readSetupStatus } from '../../_lib/setupOrchestrator'
import type { Env } from '../../_lib/env'

/** 현재 설치 진행 상태를 조회한다. Google API를 호출하지 않고 D1 상태만 읽는다. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const result = await readSetupStatus(env, session)
  return Response.json(result)
}
