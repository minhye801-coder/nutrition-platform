import { GoogleApiError } from './googleApiError'
import { ConsentSheetSchemaError } from './consentSheet'
import { CaseSheetSchemaError } from './caseSheet'

export function getCaseIdParam(params: Record<string, string | string[]>): string | null {
  const value = params.caseId
  const caseId = Array.isArray(value) ? value[0] : value
  return caseId || null
}

export function getConsentTokenParam(params: Record<string, string | string[]>): string | null {
  const value = params.token
  const token = Array.isArray(value) ? value[0] : value
  return token || null
}

/**
 * `consentSheet.ts`의 `buildConsentToken`이 만든 `{schoolPublicId}.{랜덤}` 토큰에서
 * schoolPublicId를 다시 분리한다 — `/consent/:token` 라우트에는 schoolPublicId가 없으므로
 * (route-and-menu-plan.md 확정), 공개 동의 API는 이 값으로 먼저 학교 스프레드시트를 찾은
 * 뒤에야 토큰 전체 문자열로 실제 레코드를 조회할 수 있다.
 */
export function parseConsentToken(token: string): { schoolPublicId: string } | null {
  const separatorIndex = token.indexOf('.')
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) return null
  return { schoolPublicId: token.slice(0, separatorIndex) }
}

/**
 * Google Sheets 호출 실패를 안전한 오류 응답으로 변환한다(intakeApiHelpers.ts와 동일한
 * 원칙) — 보호자 원자료(이름·연락처 등)는 어떤 경우에도 로그에 남기지 않는다.
 */
export function handleConsentSheetError(action: string, error: unknown): Response {
  if (error instanceof ConsentSheetSchemaError) {
    console.error(`[consents] ${action} schema error`, error.missingHeaders)
    return Response.json(
      { error: 'consent_sheet_missing_headers', missingHeaders: error.missingHeaders },
      { status: 500 },
    )
  }
  if (error instanceof CaseSheetSchemaError) {
    console.error(`[consents] ${action} schema error`, error.missingHeaders)
    return Response.json(
      { error: 'case_sheet_missing_headers', missingHeaders: error.missingHeaders },
      { status: 500 },
    )
  }
  if (error instanceof GoogleApiError) {
    console.error(`[consents] ${action} failed`, error.status, error.detail)
    if (error.status === 400 || error.status === 404) {
      return Response.json({ error: 'consent_sheet_not_found' }, { status: 500 })
    }
    return Response.json({ error: 'sheets_unavailable' }, { status: 502 })
  }
  throw error
}
