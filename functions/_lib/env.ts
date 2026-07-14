export interface Env {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string
  SESSION_SECRET: string
  /** 운영(D1) 세션/설치 저장소 바인딩. 로컬에 바인딩이 없으면 인메모리 저장소로 대체된다. */
  AUTH_DB?: D1Database
}

export function hasOAuthConfig(env: Partial<Env>): env is Env {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REDIRECT_URI &&
      env.SESSION_SECRET,
  )
}
