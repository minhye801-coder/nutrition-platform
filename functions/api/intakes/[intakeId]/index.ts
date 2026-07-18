import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import { getIntake } from '../../../_lib/intakeSheet'
import { getIntakeIdParam, handleIntakeSheetError } from '../../../_lib/intakeApiHelpers'
import type { Env } from '../../../_lib/env'

/** 상담접수 상세 조회(GET /api/intakes/:intakeId). 로그인 필요. */
export const onRequestGet: PagesFunction<Env, 'intakeId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const intakeId = getIntakeIdParam(params)
  if (!intakeId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const intake = await getIntake(access.accessToken, access.spreadsheetId, intakeId)
    if (!intake) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return Response.json({ intake })
  } catch (error) {
    return handleIntakeSheetError('get', error)
  }
}
