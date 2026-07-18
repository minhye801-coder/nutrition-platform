import { maskStudentId } from './maskId'

export { maskStudentId } from './maskId'

/**
 * 로그에 절대 원문으로 남으면 안 되는 키들 — 요구사항 6절 "상담내용, 진단 결과 전문,
 * 보호자 정보, PDF 추출 텍스트는 로그에 남기지 않는다". sanitizeLogContext()가 로그
 * 직전에 구조화된 컨텍스트 객체에서 이 키들을 통째로 제거한다(방어적 처리 — 호출부가
 * 실수로 넣어도 걸러진다).
 */
const FORBIDDEN_LOG_KEYS = new Set([
  'studentName',
  'name',
  'guardianName',
  'applicantName',
  'phoneNumber',
  'contactInfo',
  'address',
  'birthDate',
  'schoolName',
  'rawText',
  'pdfBytes',
  'fileBytes',
  'deidentifiedText',
  'extractedRawJson',
  'content',
  'note',
  'reviewNote',
  'responseHighlights',
])

/** 키 이름에 studentUuid/studentId가 들어가면 값을 통으로 남기지 않고 마스킹한다. */
const STUDENT_ID_KEY_PATTERN = /studentUuid|studentId/i

/**
 * console.error/warn/log에 구조화된 컨텍스트를 넘기기 전에 거치는 공용 필터.
 * - FORBIDDEN_LOG_KEYS에 있는 키는 통째로 제거한다.
 * - StudentID로 보이는 키는 원문 대신 maskStudentId() 결과로 바꾼다.
 * - 나머지 값은 그대로 남긴다(상태 코드, caseId 같은 비민감 식별자 등).
 */
export function sanitizeLogContext(context: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_LOG_KEYS.has(key)) continue
    if (STUDENT_ID_KEY_PATTERN.test(key) && typeof value === 'string') {
      safe[key] = maskStudentId(value)
      continue
    }
    safe[key] = value
  }
  return safe
}

/**
 * 임의의 에러 값에서 로그에 남겨도 안전한 최소 정보만 뽑는다 — 에러 객체 전체(요청
 * 본문이 에코백되어 있을 수 있는 detail 등)를 그대로 넘기지 않는다. Error 인스턴스는
 * message만, 그 외에는 문자열로만 남긴다.
 */
export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'unknown_error'
}
