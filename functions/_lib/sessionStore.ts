export interface SessionRecord {
  sessionId: string
  googleSub: string
  email: string
  name: string
  picture: string | null
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: number
  /** 토큰 교환/갱신 시 Google이 내려준 공백 구분 scope 문자열. functions/_lib/googleOAuth.ts의 hasDriveScope 참고. */
  grantedScopes: string
  createdAt: number
}

export interface AccessTokenUpdate {
  accessToken: string
  accessTokenExpiresAt: number
  refreshToken?: string | null
  grantedScopes?: string
}

/** 세션 쿠키/D1 sessions.expires_at에 공통으로 쓰는 세션 유효기간. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * 세션 저장소 인터페이스. 로컬 개발은 `sessionStore.memory.ts`(인메모리)를,
 * 운영은 `sessionStore.d1.ts`(Cloudflare D1)를 `stores.ts`에서 연결해 사용한다.
 * 라우트 핸들러는 `stores.ts`를 통해서만 저장소를 얻고, 구체 구현 파일을 직접
 * import하지 않는다.
 */
export interface AccountTokens {
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: number
  grantedScopes: string
}

export interface SessionStore {
  create(record: SessionRecord): Promise<void>
  get(sessionId: string): Promise<SessionRecord | null>
  delete(sessionId: string): Promise<void>
  /** access token 갱신(및 필요 시 refresh token 교체) 결과를 저장소에 반영한다. userId=Google `sub`. */
  updateAccessToken(userId: string, update: AccessTokenUpdate): Promise<void>
  /**
   * 세션 쿠키 없이 userId만으로 저장된 OAuth 토큰을 읽는다(공개 라우트용,
   * docs/public-intake-auth-design.md 3.2절). 세션이 살아있는지는 확인하지 않는다 —
   * 로그인 세션 만료 여부와 무관하게 계정이 살아있는 한 access token을 재발급할 수
   * 있어야 공개 상담신청이 교사의 세션 만료와 무관하게 항상 동작한다(의도된 설계).
   */
  getTokensByUserId(userId: string): Promise<AccountTokens | null>
}
