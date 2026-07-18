/**
 * 서버가 로그인 세션에 대해 내려주는 값. functions/_lib/accountMode.ts의 AccountMode와
 * 동일하다(src/와 functions/는 별도 tsconfig 프로젝트라 타입을 import하지 않고 그대로
 * 옮겨 적는다 — functions 쪽이 source of truth).
 */
export type AccountMode = 'SCHOOL_WORKSPACE' | 'PERSONAL_ACCOUNT_BLOCKED' | 'WORKSPACE_CONFIRMATION_REQUIRED'

/**
 * 로그인하지 않고 "로그인 없이 체험하기"를 선택한 사용자. 서버 세션이 전혀 없으므로
 * (functions/_lib/accountMode.ts의 AccountMode에는 포함되지 않음) 프런트엔드에서만
 * 쓰는 값이다 — useSession()이 sessionStorage 플래그(src/lib/demoAck.ts)를 보고
 * 이 값을 가진 합성 SessionUser를 만들어 준다. 실제 데이터 API는 세션 쿠키 자체가
 * 없으므로 이 값과 무관하게 항상 401로 거부된다(functions/_lib/requireSession.ts).
 */
export type ClientAccountMode = AccountMode | 'DEMO_GUEST'

export interface SessionUser {
  email: string
  name: string
  picture: string | null
  accountMode: ClientAccountMode
  hostedDomain: string | null
  schoolUseConfirmed: boolean
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'
