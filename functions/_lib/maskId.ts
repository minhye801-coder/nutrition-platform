/**
 * 로그(Cloudflare Pages Functions 로그, console.error 등)에 StudentID 전체 값을
 * 남기지 않는다 — 요구사항 6절 "StudentID도 로그에서는 전체 값을 표시하지 말고
 * 필요한 경우 일부만 마스킹한다". `STU-K7P4-Q9XM-2R8D` → `STU-K7P4-****-****`처럼
 * 접두 그룹 하나만 남기고 나머지는 가린다. 형식을 알 수 없는 값(레거시 UUID 등)은
 * 앞 8자만 남기고 나머지를 가린다.
 */
export function maskStudentId(studentUuid: string): string {
  if (!studentUuid) return ''
  const match = studentUuid.match(/^STU-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/)
  if (match) {
    return `STU-${match[1]}-****-****`
  }
  return studentUuid.length <= 8 ? '****' : `${studentUuid.slice(0, 8)}****`
}
