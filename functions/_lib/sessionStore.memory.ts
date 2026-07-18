import type { SessionRecord, SessionStore } from './sessionStore'
import { computeAccountMode, getConfirmationVersion } from './accountMode'
import type { Env } from './env'

/**
 * 임시 개발용 구현. Cloudflare Pages Functions의 단일 isolate 메모리에만 저장되므로,
 * 실제 배포 환경(분산 엣지)에서는 요청이 다른 isolate로 라우팅되면 세션이 유실될 수 있다.
 * D1 연동 전까지 로컬 개발과 단일 세션 흐름 확인 용도로만 사용한다.
 */
const sessions = new Map<string, SessionRecord>()

/** D1 저장소와 동일하게 accountMode를 저장된 문자열이 아니라 매번 다시 계산한다. */
function recompute(record: SessionRecord, currentVersion: string): SessionRecord {
  return {
    ...record,
    accountMode: computeAccountMode(
      record.hostedDomain,
      { confirmed: record.schoolUseConfirmed, confirmedVersion: record.confirmationVersion || null },
      currentVersion,
    ),
  }
}

export function createMemorySessionStore(env: Pick<Env, 'PRIVACY_CONFIRMATION_VERSION'>): SessionStore {
  const currentVersion = getConfirmationVersion(env)
  return {
    async create(record) {
      // D1 저장소와 동일한 규칙: school_use_confirmed/confirmationVersion/confirmedAt은
      // 같은 googleSub의 기존 세션이 있으면 그 값을 유지한다(재로그인마다 재확인
      // 화면을 다시 보여주지 않기 위함).
      const existing = [...sessions.values()].find((session) => session.googleSub === record.googleSub)
      sessions.set(
        record.sessionId,
        recompute(
          {
            ...record,
            schoolUseConfirmed: existing ? existing.schoolUseConfirmed : record.schoolUseConfirmed,
            confirmationVersion: existing ? existing.confirmationVersion : record.confirmationVersion,
            confirmedAt: existing ? existing.confirmedAt : record.confirmedAt,
          },
          currentVersion,
        ),
      )
    },
    async get(sessionId) {
      const record = sessions.get(sessionId)
      return record ? recompute(record, currentVersion) : null
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
    async confirmSchoolUse(userId, confirmationVersion, confirmedAt) {
      for (const [sessionId, record] of sessions) {
        if (record.googleSub !== userId) continue
        sessions.set(sessionId, { ...record, schoolUseConfirmed: true, confirmationVersion, confirmedAt })
      }
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
}
