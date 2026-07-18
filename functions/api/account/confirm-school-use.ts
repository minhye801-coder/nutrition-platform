import { requireSession } from '../../_lib/requireSession'
import { getSessionStore } from '../../_lib/stores'
import { getConfirmationVersion } from '../../_lib/accountMode'
import type { Env } from '../../_lib/env'

/**
 * "확인하고 학교용 기능 사용"(POST /api/account/confirm-school-use). 최초 확인 화면
 * (8개 필수 확인 항목)을 모두 체크한 뒤에만 프런트가 호출한다. 서버는 클라이언트가
 * 보낸 accountMode를 전혀 신뢰하지 않고, 세션에 저장된 hostedDomain(ID Token의 hd
 * 클레임에서 서버가 직접 검증해 저장한 값)이 있는 계정인지만 다시 확인한 뒤에만
 * school_use_confirmed/confirmation_version/confirmed_at을 갱신한다 — 브라우저
 * devtools에서 어떤 값을 조작해도 이 검증을 통과할 수 없다(개인 계정은 hostedDomain
 * 자체가 없으므로 이 라우트를 직접 호출해도 항상 거부된다).
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!session.hostedDomain) {
    return Response.json({ error: 'personal_account_blocked' }, { status: 403 })
  }

  const confirmedAt = Date.now()
  await getSessionStore(env).confirmSchoolUse(session.googleSub, getConfirmationVersion(env), confirmedAt)
  return Response.json({ ok: true })
}
