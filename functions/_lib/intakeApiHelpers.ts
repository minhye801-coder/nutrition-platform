import { GoogleApiError } from './googleApiError'
import { IntakeSheetSchemaError } from './intakeSheet'

export function getIntakeIdParam(params: Record<string, string | string[]>): string | null {
  const value = params.intakeId
  const intakeId = Array.isArray(value) ? value[0] : value
  return intakeId || null
}

export function getSchoolPublicIdParam(params: Record<string, string | string[]>): string | null {
  const value = params.schoolPublicId
  const schoolPublicId = Array.isArray(value) ? value[0] : value
  return schoolPublicId || null
}

/**
 * Google Sheets 호출 실패를 안전한 오류 응답으로 변환한다(studentApiHelpers.ts와
 * 동일한 원칙) — 신청자 원자료(이름·연락처 등)는 어떤 경우에도 로그에 남기지 않는다.
 */
export function handleIntakeSheetError(action: string, error: unknown): Response {
  if (error instanceof IntakeSheetSchemaError) {
    console.error(`[intakes] ${action} schema error`, error.missingHeaders)
    return Response.json(
      { error: 'intake_sheet_missing_headers', missingHeaders: error.missingHeaders },
      { status: 500 },
    )
  }
  if (error instanceof GoogleApiError) {
    console.error(`[intakes] ${action} failed`, error.status, error.detail)
    if (error.status === 400 || error.status === 404) {
      return Response.json({ error: 'intake_sheet_not_found' }, { status: 500 })
    }
    return Response.json({ error: 'sheets_unavailable' }, { status: 502 })
  }
  throw error
}
