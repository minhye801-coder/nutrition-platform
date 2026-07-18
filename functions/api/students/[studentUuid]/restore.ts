import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import { restoreStudent } from '../../../_lib/studentSheet'
import { getStudentUuidParam, handleStudentSheetError } from '../../../_lib/studentApiHelpers'
import type { Env } from '../../../_lib/env'

/** 비활성 처리를 되돌린다(POST /api/students/:studentUuid/restore). */
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
    const updated = await restoreStudent(access.accessToken, access.spreadsheetId, studentUuid)
    if (!updated) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return Response.json({ student: updated })
  } catch (error) {
    return handleStudentSheetError('restore', error)
  }
}
