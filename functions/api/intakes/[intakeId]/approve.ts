import { isAccessError, requireInstalledAccess } from '../../../_lib/requireInstalledAccess'
import {
  INTAKE_STATUS_APPROVED,
  INTAKE_STATUS_NEW,
  INTAKE_STATUS_REVIEWING,
  transitionIntakeStatus,
} from '../../../_lib/intakeSheet'
import { getIntakeIdParam, handleIntakeSheetError } from '../../../_lib/intakeApiHelpers'
import type { Env } from '../../../_lib/env'

/**
 * 접수 승인(POST /api/intakes/:intakeId/approve) — `신규`/`검토중` → `승인`.
 * Milestone 2A 범위에서는 상태 전이만 한다 — 학생 매칭/생성, 상담케이스·보호자동의
 * 자동 생성(counseling-workflow-v1.md 5절)은 Milestone 2B에서 이 핸들러에 이어붙인다
 * (feature-priority-v1.md 2절). 이미 `승인`/`반려`된 접수를 다시 승인하면 409 —
 * 승인 처리는 멱등이어야 한다는 5절 규칙5를 상태 전이 수준에서 우선 적용한다.
 */
export const onRequestPost: PagesFunction<Env, 'intakeId'> = async ({ request, env, params }) => {
  const access = await requireInstalledAccess(request, env)
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
      access.spreadsheetId,
      intakeId,
      [INTAKE_STATUS_NEW, INTAKE_STATUS_REVIEWING],
      INTAKE_STATUS_APPROVED,
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
    return handleIntakeSheetError('approve', error)
  }
}
