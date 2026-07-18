import { isAccessError, requireSchoolWorkspaceAccess } from '../../_lib/requireInstalledAccess'
import { listAssessments } from '../../_lib/assessmentSheet'
import { listCases } from '../../_lib/caseSheet'
import { listStudents } from '../../_lib/studentSheet'
import { handleAssessmentSheetError } from '../../_lib/assessmentApiHelpers'
import type { Env } from '../../_lib/env'

/**
 * 진단·검사 관리 목록(GET /api/assessments). 로그인 필요. consents 목록(functions/api/consents/index.ts)과
 * 동일한 패턴 — 시트 3개를 한 번씩 읽어 caseId/studentUuid로 메모리에서 합친다.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  try {
    const [assessments, cases, students] = await Promise.all([
      listAssessments(access.accessToken, access.spreadsheetId),
      listCases(access.accessToken, access.spreadsheetId),
      listStudents(access.accessToken, access.identitySpreadsheetId, { status: 'all' }),
    ])
    const caseByCaseId = new Map(cases.map((c) => [c.caseId, c]))
    const studentByUuid = new Map(students.map((s) => [s.studentUuid, s]))

    const items = assessments
      .map((assessment) => {
        const caseRecord = caseByCaseId.get(assessment.caseId)
        const student = studentByUuid.get(assessment.studentUuid)
        return {
          assessment,
          caseTopic: caseRecord?.topic ?? '',
          caseStatus: caseRecord?.status ?? '',
          studentName: student?.name ?? '',
          grade: student?.grade ?? '',
          studentClass: student?.class ?? '',
          studentNumber: student?.studentNumber ?? '',
        }
      })
      .sort((a, b) => b.assessment.createdAt.localeCompare(a.assessment.createdAt))

    return Response.json({ assessments: items })
  } catch (error) {
    return handleAssessmentSheetError('list', error)
  }
}
