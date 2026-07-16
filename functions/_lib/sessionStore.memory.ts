import type { SessionRecord, SessionStore } from './sessionStore'

/**
 * 임시 개발용 구현. Cloudflare Pages Functions의 단일 isolate 메모리에만 저장되므로,
 * 실제 배포 환경(분산 엣지)에서는 요청이 다른 isolate로 라우팅되면 세션이 유실될 수 있다.
 * D1 연동 전까지 로컬 개발과 단일 세션 흐름 확인 용도로만 사용한다.
 */
const sessions = new Map<string, SessionRecord>()

export const memorySessionStore: SessionStore = {
  async create(record) {
    sessions.set(record.sessionId, record)
  },
  async get(sessionId) {
    return sessions.get(sessionId) ?? null
  },
  async delete(sessionId) {
    sessions.delete(sessionId)
  },
  async getTokensByUserId(userId) {
    for (const record of sessions.values()) {
      if (record.googleSub !== userId) continue
      return {
        accessToken: record.accessToken,
        refreshToken: record.refreshToken,
        accessTokenExpiresAt: record.accessTokenExpiresAt,
        grantedScopes: record.grantedScopes,
      }
    }
    return null
  },
  async updateAccessToken(userId, update) {
    for (const [sessionId, record] of sessions) {
      if (record.googleSub !== userId) continue
      sessions.set(sessionId, {
        ...record,
        accessToken: update.accessToken,
        accessTokenExpiresAt: update.accessTokenExpiresAt,
        refreshToken: update.refreshToken !== undefined ? update.refreshToken : record.refreshToken,
        grantedScopes: update.grantedScopes ?? record.grantedScopes,
      })
    }
  },
}
