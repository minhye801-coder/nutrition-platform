import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import { INTAKE_STATUS_NEW, INTAKE_STATUS_REVIEWING, transitionIntakeStatus } from '../../../_lib/intakeSheet'
import { getIntakeIdParam, handleIntakeSheetError } from '../../../_lib/intakeApiHelpers'
import type { Env } from '../../../_lib/env'

/**
 * 접수 검토 시작(POST /api/intakes/:intakeId/review) — `신규` → `검토중`.
 * counseling-workflow-v1.md 7절이 "열람만 해도 자동전이할지 별도 버튼이 필요한지"를
 * 미결정으로 남겨서, 우선은 명시적 액션(버튼)으로 구현한다 — 자동 전이보다 되돌리기
 * 쉽다.
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
      [INTAKE_STATUS_NEW],
      INTAKE_STATUS_REVIEWING,
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
    return handleIntakeSheetError('review', error)
  }
}
