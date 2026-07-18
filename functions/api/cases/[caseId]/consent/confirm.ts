import { isAccessError, requireSchoolWorkspaceAccess } from '../../../../_lib/requireInstalledAccess'
import { confirmConsent } from '../../../../_lib/consentSheet'
import { CASE_STATUS_CONSENT_PENDING, CASE_STATUS_DIAGNOSIS_PENDING, transitionCaseStatus } from '../../../../_lib/caseSheet'
import { getCaseIdParam, handleConsentSheetError } from '../../../../_lib/consentApiHelpers'
import type { Env } from '../../../../_lib/env'

/**
 * 교사 최종 확인(POST /api/cases/:caseId/consent/confirm). 로그인 필요. 통과하면 케이스를
 * `동의 대기 → 진단 대기`로 자동 전이한다(intake-migration-spec.md 8.5절) — 케이스가 이미
 * 다른 단계로 넘어가 있으면(전이 대상 아님) 조용히 넘어가고, 동의 확인 자체는 그대로
 * 성공 처리한다(caseSheet.ts의 transitionCaseStatus 주석 참고).
 */
export const onRequestPost: PagesFunction<Env, 'caseId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const caseId = getCaseIdParam(params)
  if (!caseId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const result = await confirmConsent(access.accessToken, access.spreadsheetId, caseId, access.session.email)
    if (!result.ok) {
      if (result.error === 'not_found') {
        return Response.json({ error: 'not_found' }, { status: 404 })
      }
      return Response.json(
        { error: 'invalid_transition', currentStatus: result.currentStatus },
        { status: 409 },
      )
    }

    if (!result.alreadyConfirmed) {
      await transitionCaseStatus(
        access.accessToken,
        access.spreadsheetId,
        caseId,
        [CASE_STATUS_CONSENT_PENDING],
        CASE_STATUS_DIAGNOSIS_PENDING,
      )
    }

    return Response.json({ consent: result.consent, alreadyConfirmed: result.alreadyConfirmed })
  } catch (error) {
    return handleConsentSheetError('confirm', error)
  }
}
