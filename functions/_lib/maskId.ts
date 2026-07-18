/**
 * 로그(Cloudflare Pages Functions 로그, console.error 등)에 StudentID 전체 값을
 * 남기지 않는다 — 요구사항 6절 "StudentID도 로그에서는 전체 값을 표시하지 말고
 * 필요한 경우 일부만 마스킹한다". `STU-K7P4-Q9XM-2R8D` → `STU-K7P4-****-****`처럼
 * 접두 그룹 하나만 남기고 나머지는 가린다. 형식을 알 수 없는 값(레거시 UUID 등)은
 * 앞 8자만 남기고 나머지를 가린다.
 */
/** functions/_lib/crypto.ts generateStudentId()가 만드는 정식 형식. 마이그레이션 검증
 * (migrationOrchestrator.ts)에서 "잘못된 형식의 StudentID"를 판정할 때도 재사용한다. */
export const STUDENT_ID_PATTERN = /^STU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

export function isValidStudentIdFormat(studentUuid: string): boolean {
  return STUDENT_ID_PATTERN.test(studentUuid)
}

export function maskStudentId(studentUuid: string): string {
  if (!studentUuid) return ''
  const match = studentUuid.match(/^STU-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/)
  if (match) {
    return `STU-${match[1]}-****-****`
  }
  return studentUuid.length <= 8 ? '****' : `${studentUuid.slice(0, 8)}****`
}

/**
 * 마스킹된 이름 미리보기 — 성만 남기고 나머지는 별표로 가린다(예: "김민수" → "김**").
 * 마이그레이션 오류 목록 등 "이름 일부"만 보여줘야 하는 화면에서 쓴다(요구사항 12절).
 * 한 글자 이름은 전부 가린다.
 */
export function maskNamePartial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 1) return '*'
  return `${trimmed[0]}${'*'.repeat(trimmed.length - 1)}`
}
