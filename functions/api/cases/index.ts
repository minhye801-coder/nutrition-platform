import { isAccessError, requireInstalledAccess } from '../../_lib/requireInstalledAccess'
import { listCases } from '../../_lib/caseSheet'
import { listStudents } from '../../_lib/studentSheet'
import { handleConsentSheetError } from '../../_lib/consentApiHelpers'
import type { Env } from '../../_lib/env'

/**
 * 학생·상담 검색(GET /api/cases?keyword=&status=). 로그인 필요. legacy `listCases(filters)`
 * (counseling-manager/code.gs.txt:3106-3164)와 동일한 데이터 단위 — `학생정보`가 아니라
 * `상담케이스`가 기준이다(케이스가 없는 학생은 여기 나오지 않는다).
 *
 * `상담회기`/`목표` 시트는 아직 CRUD가 없다(Milestone 5 범위) — sessionCount/lastSessionDate/
 * latestGoal은 지금은 항상 0/'-'다. 가짜 값을 넣지 않는다(사용자 확인 9절).
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireInstalledAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const url = new URL(request.url)
  const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase()
  const status = url.searchParams.get('status') ?? ''

  try {
    const [cases, students] = await Promise.all([
      listCases(access.accessToken, access.spreadsheetId),
      listStudents(access.accessToken, access.spreadsheetId, { status: 'all' }),
    ])
    const studentByUuid = new Map(students.map((s) => [s.studentUuid, s]))

    let items = cases.map((c) => {
      const student = studentByUuid.get(c.studentUuid)
      const gradeClass = student ? `${student.grade}학년 ${student.class}반` : ''
      return {
        caseId: c.caseId,
        studentUuid: c.studentUuid,
        gradeClass,
        studentName: student?.name ?? '',
        topic: c.topic,
        status: c.status,
        sessionCount: 0,
        lastSessionDate: '',
        nextDate: c.nextScheduledAt,
        latestGoal: '',
      }
    })

    if (status) items = items.filter((item) => item.status === status)
    if (keyword) {
      items = items.filter((item) =>
        `${item.gradeClass}${item.studentName}${item.topic}`.toLowerCase().includes(keyword),
      )
    }

    items.reverse()

    return Response.json({ cases: items })
  } catch (error) {
    return handleConsentSheetError('list cases', error)
  }
}
