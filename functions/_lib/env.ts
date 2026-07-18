export interface Env {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string
  SESSION_SECRET: string
  /** 운영(D1) 세션/설치 저장소 바인딩. 로컬에 바인딩이 없으면 인메모리 저장소로 대체된다. */
  AUTH_DB?: D1Database
  /**
   * 승인된 학교/교육청 Workspace 도메인 콤마 구분 목록(예: "school1.go.kr,school2.hs.kr").
   * 관리자 UI가 아직 없는 이번 범위에서 approved_school_domains D1 테이블을 보완하는
   * 용도다(functions/_lib/accountMode.ts). 둘 중 하나라도 일치하면 승인된 것으로 본다.
   */
  APPROVED_SCHOOL_DOMAINS?: string
}

export function hasOAuthConfig(env: Partial<Env>): env is Env {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REDIRECT_URI &&
      env.SESSION_SECRET,
  )
}
