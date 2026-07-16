import { getInstallationStore } from '../../../../_lib/stores'
import { getSchoolPublicIdParam } from '../../../../_lib/intakeApiHelpers'
import type { Env } from '../../../../_lib/env'

/**
 * 공개 상담신청 폼이 학교명만 보여주기 위해 쓰는 최소 정보 조회(GET
 * /api/public/intakes/:schoolPublicId/config). D1의 `installations.school_name`만
 * 읽는다 — Drive/Sheets access token이 필요 없으므로 `ensurePublicSpreadsheetAccess`를
 * 쓰지 않는다(학교 소유자의 refresh token이 죽어 있어도 폼 자체는 뜰 수 있어야
 * 한다 — 제출 시점에만 그 문제가 드러나면 된다). 학교 존재 여부를 신청자에게
 * 노출하지 않기 위해 실패 시에도 항상 같은 응답을 준다(docs/public-intake-auth-design.md 3.5절).
 */
export const onRequestGet: PagesFunction<Env, 'schoolPublicId'> = async ({ env, params }) => {
  const schoolPublicId = getSchoolPublicIdParam(params)
  if (!schoolPublicId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const installation = await getInstallationStore(env).getBySchoolPublicId(schoolPublicId)
  if (!installation) {
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }

  return Response.json({ schoolName: installation.schoolName })
}
