import { isAccessError, requireSchoolWorkspaceAccess } from '../../../../_lib/requireInstalledAccess'
import { saveStudentAssent, STUDENT_ASSENT_VALUES } from '../../../../_lib/consentSheet'
import { getCaseIdParam, handleConsentSheetError } from '../../../../_lib/consentApiHelpers'
import type { Env } from '../../../../_lib/env'

interface SaveAssentBody {
  studentAssent?: string
}

/**
 * 학생 참여 의사 저장(POST /api/cases/:caseId/consent/assent). 로그인 필요. legacy
 * `saveStudentAssent`(counseling-manager/code.gs.txt:3682-3702)와 동일하게 보호자 제출/
 * 교사 확인과 완전히 독립적인 액션이다.
 */
export const onRequestPost: PagesFunction<Env, 'caseId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const caseId = getCaseIdParam(params)
  if (!caseId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  let body: SaveAssentBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!body || !(STUDENT_ASSENT_VALUES as readonly string[]).includes(body.studentAssent ?? '')) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const result = await saveStudentAssent(access.accessToken, access.spreadsheetId, caseId, body.studentAssent!)
    if (!result.ok) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return Response.json({ consent: result.consent })
  } catch (error) {
    return handleConsentSheetError('save assent', error)
  }
}
