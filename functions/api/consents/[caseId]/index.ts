import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import { findConsentByCaseId } from '../../../_lib/consentSheet'
import { getCase } from '../../../_lib/caseSheet'
import { getStudentByUuid } from '../../../_lib/studentSheet'
import { getCaseIdParam, handleConsentSheetError } from '../../../_lib/consentApiHelpers'
import type { Env } from '../../../_lib/env'

/**
 * 보호자동의 상세(GET /api/consents/:caseId) — legacy `getConsentDetail`(counseling-manager/
 * code.gs.txt:3441-3454)와 동일한 구성: 학생/케이스 컨텍스트 + 보호자동의 레코드.
 */
export const onRequestGet: PagesFunction<Env, 'caseId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const caseId = getCaseIdParam(params)
  if (!caseId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const caseRecord = await getCase(access.accessToken, access.spreadsheetId, caseId)
    if (!caseRecord) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    const consent = await findConsentByCaseId(access.accessToken, access.spreadsheetId, caseId)
    if (!consent) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    const student = await getStudentByUuid(access.accessToken, access.identitySpreadsheetId, caseRecord.studentUuid)

    return Response.json({
      caseId,
      studentName: student?.name ?? '',
      gradeClass: student ? `${student.grade}학년 ${student.class}반` : '',
      topic: caseRecord.topic,
      caseStatus: caseRecord.status,
      consent,
    })
  } catch (error) {
    return handleConsentSheetError('get detail', error)
  }
}
