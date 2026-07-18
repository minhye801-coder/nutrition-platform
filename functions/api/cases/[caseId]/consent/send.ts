import { isAccessError, requireSchoolWorkspaceAccess } from '../../../../_lib/requireInstalledAccess'
import { generateAndSendConsentLink } from '../../../../_lib/consentSheet'
import { getCaseIdParam, handleConsentSheetError } from '../../../../_lib/consentApiHelpers'
import type { Env } from '../../../../_lib/env'

/**
 * 동의 링크 생성 + 발송 처리(POST /api/cases/:caseId/consent/send). 로그인 필요.
 * legacy의 `generateConsentLink`+`markConsentSent`를 하나로 합친 v1 확정 설계
 * (feature-priority-v1.md 3절, consentSheet.ts의 generateAndSendConsentLink 참고).
 * 응답의 `consent.consentToken`으로 프런트가 `{origin}/consent/{token}` 링크를 만들어
 * 복사한다(공개 상담신청 링크와 동일한 패턴, IntakesPage.tsx 참고).
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
    const result = await generateAndSendConsentLink(
      access.accessToken,
      access.spreadsheetId,
      caseId,
      access.installation.schoolPublicId,
    )
    if (!result.ok) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return Response.json({ consent: result.consent, alreadySent: result.alreadySent })
  } catch (error) {
    return handleConsentSheetError('send', error)
  }
}
