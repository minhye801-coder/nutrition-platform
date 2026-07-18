const DEMO_ACK_KEY = 'nutrition-ai-plus:demo-mode-ack'

/**
 * 개인 Google 계정(PERSONAL_DEMO/WORKSPACE_PENDING)이 "체험 모드로 계속"을 누른
 * 사실을 기억한다. 서버 상태는 바꾸지 않는다(요구사항 3절 — 데모 계정은 실제 Drive/
 * Sheets를 절대 만들지 않으므로 서버에 남길 것이 없다) — 그래서 세션 스토리지에만
 * 저장하고, 새 탭/재로그인 시에는 안내 화면을 다시 보여준다. 이 값 자체는 어떤
 * 권한도 부여하지 않는다 — 실제 데이터 API는 accountMode를 서버가 매번 다시
 * 검증하므로(functions/_lib/requireInstalledAccess.ts), 이 플래그를 조작해도
 * SCHOOL_WORKSPACE 기능이 열리지 않는다.
 */
export function hasAcknowledgedDemoMode(): boolean {
  try {
    return sessionStorage.getItem(DEMO_ACK_KEY) === '1'
  } catch {
    return false
  }
}

export function acknowledgeDemoMode(): void {
  try {
    sessionStorage.setItem(DEMO_ACK_KEY, '1')
  } catch {
    // 세션 스토리지를 쓸 수 없는 환경(예: 프라이버시 모드)이면 매번 안내를 다시
    // 보여주는 것으로 안전하게 대체한다.
  }
}
