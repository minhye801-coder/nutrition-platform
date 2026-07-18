import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import { deactivateStudent } from '../../../_lib/studentSheet'
import { getStudentUuidParam, handleStudentSheetError } from '../../../_lib/studentApiHelpers'
import type { Env } from '../../../_lib/env'

/** 학생 비활성 처리(POST /api/students/:studentUuid/deactivate). 행을 지우지 않고 enrollmentStatus만 바꾼다 — 다른 탭의 상담기록 참조는 그대로 보존된다. */
export const onRequestPost: PagesFunction<Env, 'studentUuid'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const studentUuid = getStudentUuidParam(params)
  if (!studentUuid) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const updated = await deactivateStudent(access.accessToken, access.spreadsheetId, studentUuid)
    if (!updated) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return Response.json({ student: updated })
  } catch (error) {
    return handleStudentSheetError('deactivate', error)
  }
}
