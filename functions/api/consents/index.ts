import { isAccessError, requireInstalledAccess } from '../../_lib/requireInstalledAccess'
import { listConsents } from '../../_lib/consentSheet'
import { listCases } from '../../_lib/caseSheet'
import { listStudents } from '../../_lib/studentSheet'
import { handleConsentSheetError } from '../../_lib/consentApiHelpers'
import type { Env } from '../../_lib/env'

/**
 * 보호자동의 관리 목록(GET /api/consents). 로그인 필요. `상담케이스`/`학생정보`를
 * 시트 3개에서 한 번씩 읽어 caseId/studentUuid로 메모리에서 합친다 — Sheets API에
 * JOIN이 없으므로 이 화면 하나를 위해 매번 세 번 읽는 것 자체가 v1의 정상 비용이다
 * (studentSheet.ts findStudentForCaseApproval과 같은 패턴).
 *
 * legacy `listConsentCases`(counseling-manager/code.gs.txt:3409-3439)와 동일하게 케이스가
 * `종결`이면 목록에서 뺀다(이미 끝난 상담까지 계속 관리 화면에 남겨둘 이유가 없다).
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireInstalledAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  try {
    const [consents, cases, students] = await Promise.all([
      listConsents(access.accessToken, access.spreadsheetId),
      listCases(access.accessToken, access.spreadsheetId),
      listStudents(access.accessToken, access.spreadsheetId, { status: 'all' }),
    ])
    const caseByCaseId = new Map(cases.map((c) => [c.caseId, c]))
    const studentByUuid = new Map(students.map((s) => [s.studentUuid, s]))

    const items = consents
      .map((consent) => {
        const caseRecord = caseByCaseId.get(consent.caseId)
        const student = studentByUuid.get(consent.studentUuid)
        return {
          consent,
          caseTopic: caseRecord?.topic ?? '',
          caseStatus: caseRecord?.status ?? '',
          studentName: student?.name ?? '',
          gradeClass: student ? `${student.grade}학년 ${student.class}반` : '',
        }
      })
      .filter((item) => item.caseStatus !== '종결')
      .sort((a, b) => b.consent.createdAt.localeCompare(a.consent.createdAt))

    return Response.json({ consents: items })
  } catch (error) {
    return handleConsentSheetError('list', error)
  }
}
