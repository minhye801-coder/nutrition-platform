import { requireSession } from '../../_lib/requireSession'
import { runSetup, SetupInputError } from '../../_lib/setupOrchestrator'
import type { Env } from '../../_lib/env'

/**
 * 실패했거나 중단된 설치를 이어서 재시도한다. 이미 D1에 저장된 학교명/담당자명/
 * schoolPublicId와 지금까지 만든 리소스 ID를 그대로 사용하므로 body가 필요 없다.
 * 진행 중인 설치가 아예 없으면(= 최초 시작을 한 적이 없으면) 400을 반환한다.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const result = await runSetup(env, session, undefined)
    return Response.json(result)
  } catch (error) {
    if (error instanceof SetupInputError) {
      return Response.json({ error: 'not_started' }, { status: 400 })
    }
    console.error('[setup/retry] unexpected error', error)
    return Response.json({ error: 'setup_failed' }, { status: 500 })
  }
}
