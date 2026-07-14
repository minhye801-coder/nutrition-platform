export interface SessionRecord {
  sessionId: string
  googleSub: string
  email: string
  name: string
  picture: string | null
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: number
  createdAt: number
}

/** 세션 쿠키/D1 sessions.expires_at에 공통으로 쓰는 세션 유효기간. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * 세션 저장소 인터페이스. 로컬 개발은 `sessionStore.memory.ts`(인메모리)를,
 * 운영은 `sessionStore.d1.ts`(Cloudflare D1)를 `stores.ts`에서 연결해 사용한다.
 * 라우트 핸들러는 `stores.ts`를 통해서만 저장소를 얻고, 구체 구현 파일을 직접
 * import하지 않는다.
 */
export interface SessionStore {
  create(record: SessionRecord): Promise<void>
  get(sessionId: string): Promise<SessionRecord | null>
  delete(sessionId: string): Promise<void>
}
