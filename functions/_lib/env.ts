export interface Env {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string
  SESSION_SECRET: string
  /** 운영(D1) 세션/설치 저장소 바인딩. 로컬에 바인딩이 없으면 인메모리 저장소로 대체된다. */
  AUTH_DB?: D1Database
  /**
   * 학교 업무용 계정 최초 확인 화면(functions/api/account/confirm-school-use.ts)의
   * 안내문 버전을 코드 배포 없이 올리고 싶을 때 덮어쓴다. 비어 있으면
   * accountMode.ts의 DEFAULT_CONFIRMATION_VERSION을 쓴다.
   */
  PRIVACY_CONFIRMATION_VERSION?: string
}

export function hasOAuthConfig(env: Partial<Env>): env is Env {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REDIRECT_URI &&
      env.SESSION_SECRET,
  )
}
