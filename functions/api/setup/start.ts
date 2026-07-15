import { requireSession } from '../../_lib/requireSession'
import { runSetup, SetupInputError } from '../../_lib/setupOrchestrator'
import type { Env } from '../../_lib/env'

interface StartBody {
  schoolName?: string
  managerName?: string
}

/**
 * 최초 설치 시작(및 최초 1회 재시도 겸용). 로그인된 사용자만 호출 가능하다.
 * 학교명/담당자명은 이 요청 최초 1회에만 필요하고, 이후 재시도는 body 없이
 * POST /api/setup/retry(또는 이 라우트를 다시 호출)로 이어간다.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: StartBody = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text) as StartBody
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const result = await runSetup(env, session, body)
    return Response.json(result)
  } catch (error) {
    if (error instanceof SetupInputError) {
      return Response.json({ error: 'invalid_input' }, { status: 400 })
    }
    console.error('[setup/start] unexpected error', error)
    return Response.json({ error: 'setup_failed' }, { status: 500 })
  }
}
