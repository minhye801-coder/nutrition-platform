import { describe, expect, it } from 'vitest'
import { requireSession } from '../functions/_lib/requireSession'
import { requireInstalledAccess, isAccessError } from '../functions/_lib/requireInstalledAccess'

/** D1을 흉내 내되, 조금이라도 쿼리가 오면 즉시 실패시켜 "D1을 전혀 건드리지 않았다"를 증명한다. */
function makeTripwireDb(): D1Database {
  return {
    prepare() {
      throw new Error('D1 must not be touched for a guest/unauthenticated request')
    },
  } as unknown as D1Database
}

describe('DEMO_GUEST / unauthenticated requests never reach storage', () => {
  it('requireSession returns null for a request with no session cookie, without touching D1', async () => {
    const request = new Request('https://example.com/api/students')
    const env = { AUTH_DB: makeTripwireDb(), SESSION_SECRET: 'secret' } as never
    // 요구사항 9절 테스트 2·15: DEMO_GUEST(=세션 쿠키 자체가 없는 요청)는 저장 API에
    // 접근할 수 없고, D1/Drive/Sheets 어디에도 데이터를 남기지 않는다.
    const session = await requireSession(request, env)
    expect(session).toBeNull()
  })

  it('requireInstalledAccess rejects the same request with "unauthenticated" before any D1 lookup', async () => {
    const request = new Request('https://example.com/api/students')
    const env = { AUTH_DB: makeTripwireDb(), SESSION_SECRET: 'secret' } as never
    const result = await requireInstalledAccess(request, env)
    expect(isAccessError(result)).toBe(true)
    if (isAccessError(result)) {
      expect(result.error).toBe('unauthenticated')
      expect(result.status).toBe(401)
    }
  })

  it('a forged session cookie for a nonexistent id is also rejected without a live D1 row', async () => {
    const request = new Request('https://example.com/api/students', {
      headers: { Cookie: 'session=forged-id-that-does-not-exist' },
    })
    // 실제로 아무 행도 없는 D1을 흉내 낸다 — 서버는 클라이언트가 보낸 쿠키만으로
    // 세션을 신뢰하지 않고, 저장된 세션이 없으면 항상 거부한다.
    const env = {
      AUTH_DB: {
        prepare() {
          return {
            bind() {
              return this
            },
            async first() {
              return null
            },
          }
        },
      } as unknown as D1Database,
      SESSION_SECRET: 'secret',
    } as never
    const session = await requireSession(request, env)
    expect(session).toBeNull()
  })

  it('the Gemini extraction route (requireSchoolWorkspaceAccess) also rejects a guest request before touching D1', async () => {
    // 요구사항 9절 테스트 16: DEMO_GUEST가 실제 저장·AI API를 호출하지 않는다 —
    // extract.ts를 포함해 모든 데이터/AI 라우트가 requireSchoolWorkspaceAccess →
    // requireInstalledAccess → requireSession을 거치므로, 세션 쿠키가 없으면 Gemini
    // 호출 이전에 이미 401로 막힌다.
    const { requireSchoolWorkspaceAccess } = await import('../functions/_lib/requireInstalledAccess')
    const request = new Request('https://example.com/api/assessments/ASSESS-1/extract', { method: 'POST' })
    const env = { AUTH_DB: makeTripwireDb(), SESSION_SECRET: 'secret' } as never
    const result = await requireSchoolWorkspaceAccess(request, env)
    expect(isAccessError(result)).toBe(true)
    if (isAccessError(result)) {
      expect(result.error).toBe('unauthenticated')
    }
  })
})
