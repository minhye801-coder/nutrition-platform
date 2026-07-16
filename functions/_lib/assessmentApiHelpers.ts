import { GoogleApiError } from './googleApiError'
import { AssessmentSheetSchemaError } from './assessmentSheet'
import { CaseSheetSchemaError } from './caseSheet'

export function getCaseIdParam(params: Record<string, string | string[]>): string | null {
  const value = params.caseId
  const caseId = Array.isArray(value) ? value[0] : value
  return caseId || null
}

export function getAssessmentIdParam(params: Record<string, string | string[]>): string | null {
  const value = params.assessmentId
  const assessmentId = Array.isArray(value) ? value[0] : value
  return assessmentId || null
}

/**
 * Google Sheets 호출 실패를 안전한 오류 응답으로 변환한다(consentApiHelpers.ts와 동일한
 * 원칙) — 검사결과 원자료는 어떤 경우에도 로그에 남기지 않는다.
 */
export function handleAssessmentSheetError(action: string, error: unknown): Response {
  if (error instanceof AssessmentSheetSchemaError) {
    console.error(`[assessments] ${action} schema error`, error.missingHeaders)
    return Response.json(
      { error: 'assessment_sheet_missing_headers', missingHeaders: error.missingHeaders },
      { status: 500 },
    )
  }
  if (error instanceof CaseSheetSchemaError) {
    console.error(`[assessments] ${action} schema error`, error.missingHeaders)
    return Response.json(
      { error: 'case_sheet_missing_headers', missingHeaders: error.missingHeaders },
      { status: 500 },
    )
  }
  if (error instanceof GoogleApiError) {
    console.error(`[assessments] ${action} failed`, error.status, error.detail)
    if (error.status === 400 || error.status === 404) {
      return Response.json({ error: 'assessment_sheet_not_found' }, { status: 500 })
    }
    return Response.json({ error: 'sheets_unavailable' }, { status: 502 })
  }
  throw error
}
