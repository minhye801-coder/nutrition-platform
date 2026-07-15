import { GoogleApiError } from './googleApiError'
import { StudentSheetSchemaError } from './studentSheet'

export function getStudentUuidParam(params: Record<string, string | string[]>): string | null {
  const value = params.studentUuid
  const studentUuid = Array.isArray(value) ? value[0] : value
  return studentUuid || null
}

/**
 * Google Sheets 호출 실패를 안전한 오류 응답으로 변환한다. 학생 원자료(이름 등)는
 * 어떤 경우에도 로그에 남기지 않는다 — 여기서 로깅하는 값은 상태 코드/오류 원문뿐이다.
 */
export function handleStudentSheetError(action: string, error: unknown): Response {
  if (error instanceof StudentSheetSchemaError) {
    console.error(`[students] ${action} schema error`, error.missingHeaders)
    return Response.json(
      { error: 'student_sheet_missing_headers', missingHeaders: error.missingHeaders },
      { status: 500 },
    )
  }
  if (error instanceof GoogleApiError) {
    console.error(`[students] ${action} failed`, error.status, error.detail)
    if (error.status === 400 || error.status === 404) {
      return Response.json({ error: 'student_sheet_not_found' }, { status: 500 })
    }
    return Response.json({ error: 'sheets_unavailable' }, { status: 502 })
  }
  throw error
}
