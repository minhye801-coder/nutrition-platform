import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import { getCase } from '../../../_lib/caseSheet'
import { findConsentByCaseId } from '../../../_lib/consentSheet'
import { getStudentByUuid } from '../../../_lib/studentSheet'
import { getCaseIdParam, handleConsentSheetError } from '../../../_lib/consentApiHelpers'
import type { Env } from '../../../_lib/env'

/**
 * 상담케이스 상세("상담 이력 보기", GET /api/cases/:caseId). 로그인 필요. legacy
 * `getStudentCounselingOverview`(counseling-manager/code.gs.txt:3190-)는 SOAP/PES 상담회기·
 * 목표 타임라인 전체를 보여주지만, 그건 Milestone 5(상담회기·목표관리) 범위라 이번엔
 * 손대지 않는다 — 케이스/학생/동의 상태까지만 반환한다.
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
    const [student, consent] = await Promise.all([
      getStudentByUuid(access.accessToken, access.spreadsheetId, caseRecord.studentUuid),
      findConsentByCaseId(access.accessToken, access.spreadsheetId, caseId),
    ])

    return Response.json({
      case: caseRecord,
      studentName: student?.name ?? '',
      gradeClass: student ? `${student.grade}학년 ${student.class}반` : '',
      consentStatus: consent?.status ?? '',
    })
  } catch (error) {
    return handleConsentSheetError('get case', error)
  }
}
