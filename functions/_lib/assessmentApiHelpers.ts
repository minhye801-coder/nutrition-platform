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
 * 원본 진단검사 PDF는 학교 PC 로컬에만 두고 Cloudflare Worker로 전송하지 않는다(개인정보
 * 보호 구조 확정 사항). 이 함수는 요청의 Content-Type만 보고 순수하게 판정하므로(본문을
 * 읽지 않음) 인증 이전에도, 유닛 테스트에서도 그대로 재사용할 수 있다 — 라우트는 이 값이
 * true면 본문을 아예 파싱하지 않고 즉시 명확한 오류로 거부해야 한다.
 */
export function isRawFileUploadRequest(request: Request): boolean {
  const contentType = request.headers.get('content-type') ?? ''
  return contentType.includes('multipart/form-data') || contentType.includes('application/pdf')
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
