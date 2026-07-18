import { requireSession } from '../../_lib/requireSession'
import { getSessionStore } from '../../_lib/stores'
import type { Env } from '../../_lib/env'

/**
 * "학교용 기능 활성화"(POST /api/account/confirm-school-use). 최초 로그인 안내 화면
 * (요구사항 2절)에서 4개 필수 확인 항목을 모두 체크한 뒤에만 프런트가 호출한다.
 * 서버가 다시 한번 accountMode === SCHOOL_WORKSPACE인지 확인한 뒤에만 실제로
 * school_use_confirmed를 갱신한다 — 브라우저 devtools에서 mode 값을 조작해도 이
 * 검증을 통과할 수 없다(요구사항 13절 "mode 값을 수정해도 권한이 상승하지 않음").
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (session.accountMode !== 'SCHOOL_WORKSPACE') {
    return Response.json({ error: 'school_workspace_required' }, { status: 403 })
  }

  await getSessionStore(env).confirmSchoolUse(session.googleSub)
  return Response.json({ ok: true })
}
