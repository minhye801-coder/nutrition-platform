const GUEST_SESSION_KEY = 'nutrition-ai-plus:guest-session'

/**
 * 로그인하지 않고 "로그인 없이 체험하기"를 누른 사실을 기억한다(요구사항 7절
 * DEMO_GUEST). 서버 상태는 전혀 바꾸지 않는다 — 게스트는 로그인 세션 쿠키 자체가
 * 없으므로 서버에 남길 것이 없다. 그래서 세션 스토리지에만 저장하고, 새 탭이나
 * 브라우저 종료 후에는 다시 첫 화면부터 시작한다(요구사항 "체험 종료 또는 브라우저
 * 종료 시 삭제"). 이 값 자체는 어떤 권한도 부여하지 않는다 — 실제 데이터 API는
 * 세션 쿠키가 없으면 무조건 401을 반환하므로(functions/_lib/requireSession.ts),
 * 이 플래그를 조작해도 실제 저장 API가 열리지 않는다.
 */
export function isGuestSession(): boolean {
  try {
    return sessionStorage.getItem(GUEST_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function startGuestSession(): void {
  try {
    sessionStorage.setItem(GUEST_SESSION_KEY, '1')
  } catch {
    // 세션 스토리지를 쓸 수 없는 환경(예: 프라이버시 모드)이면 게스트 상태를 기억하지
    // 못하고 매번 첫 화면으로 돌아가는 것으로 안전하게 대체한다.
  }
}

export function endGuestSession(): void {
  try {
    sessionStorage.removeItem(GUEST_SESSION_KEY)
  } catch {
    // 위와 동일한 이유로 무시한다.
  }
}
