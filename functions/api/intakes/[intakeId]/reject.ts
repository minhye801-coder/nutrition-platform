import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import {
  INTAKE_STATUS_NEW,
  INTAKE_STATUS_REJECTED,
  INTAKE_STATUS_REVIEWING,
  transitionIntakeStatus,
} from '../../../_lib/intakeSheet'
import { getIntakeIdParam, handleIntakeSheetError } from '../../../_lib/intakeApiHelpers'
import type { Env } from '../../../_lib/env'

/**
 * 접수 반려(POST /api/intakes/:intakeId/reject) — `신규`/`검토중` → `반려`.
 * legacy에는 명시적 반려 흐름이 없었다(v1 신규, counseling-workflow-v1.md 4.1절).
 * 반려 사유 기록 여부는 아직 미결정(feature-priority-v1.md 1절)이라 이번 범위에서는
 * 상태 전이만 한다.
 */
export const onRequestPost: PagesFunction<Env, 'intakeId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const intakeId = getIntakeIdParam(params)
  if (!intakeId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const result = await transitionIntakeStatus(
      access.accessToken,
      access.identitySpreadsheetId,
      intakeId,
      [INTAKE_STATUS_NEW, INTAKE_STATUS_REVIEWING],
      INTAKE_STATUS_REJECTED,
    )
    if (!result.ok) {
      if (result.error === 'not_found') {
        return Response.json({ error: 'not_found' }, { status: 404 })
      }
      return Response.json(
        { error: 'invalid_transition', currentStatus: result.currentStatus },
        { status: 409 },
      )
    }
    return Response.json({ intake: result.intake })
  } catch (error) {
    return handleIntakeSheetError('reject', error)
  }
}
