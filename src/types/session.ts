/**
 * functions/_lib/accountMode.ts의 AccountMode와 동일한 값. src/와 functions/는 별도
 * tsconfig 프로젝트라 타입을 import하지 않고 그대로 옮겨 적는다(functions 쪽이
 * source of truth — 서버가 ID Token으로 검증해 내려주는 값을 그대로 표시만 한다).
 */
export type AccountMode = 'SCHOOL_WORKSPACE' | 'PERSONAL_DEMO' | 'WORKSPACE_PENDING'

export interface SessionUser {
  email: string
  name: string
  picture: string | null
  accountMode: AccountMode
  hostedDomain: string | null
  schoolUseConfirmed: boolean
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'
