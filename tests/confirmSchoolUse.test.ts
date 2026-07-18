import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireSessionMock = vi.fn()
const confirmSchoolUseMock = vi.fn()

vi.mock('../functions/_lib/requireSession', () => ({
  requireSession: (...args: unknown[]) => requireSessionMock(...args),
}))

vi.mock('../functions/_lib/stores', () => ({
  getSessionStore: () => ({ confirmSchoolUse: (...args: unknown[]) => confirmSchoolUseMock(...args) }),
}))

describe('POST /api/account/confirm-school-use', () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    confirmSchoolUseMock.mockReset().mockResolvedValue(undefined)
  })

  it('rejects an unauthenticated request', async () => {
    requireSessionMock.mockResolvedValue(null)
    const { onRequestPost } = await import('../functions/api/account/confirm-school-use')
    const response = await onRequestPost({
      request: new Request('https://example.com/api/account/confirm-school-use', { method: 'POST' }),
      env: {} as never,
      params: {},
    } as never)
    expect(response.status).toBe(401)
    expect(confirmSchoolUseMock).not.toHaveBeenCalled()
  })

  it('rejects a gmail.com / personal account (no hosted domain) — cannot activate school features', async () => {
    // 요구사항 9절 테스트 4: gmail.com 계정은 학교용 기능 활성화 불가. 서버는
    // 클라이언트가 보낸 accountMode를 보지 않고 세션에 저장된 hostedDomain만 본다.
    requireSessionMock.mockResolvedValue({
      googleSub: 'sub-1',
      hostedDomain: null,
      accountMode: 'SCHOOL_WORKSPACE', // 클라이언트/캐시가 조작됐다고 가정해도
    })
    const { onRequestPost } = await import('../functions/api/account/confirm-school-use')
    const response = await onRequestPost({
      request: new Request('https://example.com/api/account/confirm-school-use', { method: 'POST' }),
      env: {} as never,
      params: {},
    } as never)
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe('personal_account_blocked')
    expect(confirmSchoolUseMock).not.toHaveBeenCalled()
  })

  it('confirms a hosted-domain account and stores only metadata (userId + version + timestamp)', async () => {
    // 요구사항 9절 테스트 8: 확인 기록이 D1에 메타데이터로만 저장된다 — 이름/학생자료
    // 등은 이 호출 어디에도 등장하지 않는다(호출 인자가 googleSub/version/timestamp뿐).
    requireSessionMock.mockResolvedValue({
      googleSub: 'sub-2',
      hostedDomain: 'school.go.kr',
      accountMode: 'WORKSPACE_CONFIRMATION_REQUIRED',
    })
    const { onRequestPost } = await import('../functions/api/account/confirm-school-use')
    const response = await onRequestPost({
      request: new Request('https://example.com/api/account/confirm-school-use', { method: 'POST' }),
      env: {} as never,
      params: {},
    } as never)
    expect(response.status).toBe(200)
    expect(confirmSchoolUseMock).toHaveBeenCalledTimes(1)
    const [userId, version, confirmedAt] = confirmSchoolUseMock.mock.calls[0]
    expect(userId).toBe('sub-2')
    expect(typeof version).toBe('string')
    expect(version.length).toBeGreaterThan(0)
    expect(typeof confirmedAt).toBe('number')
  })
})
