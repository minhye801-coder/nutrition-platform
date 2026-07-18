import { describe, expect, it } from 'vitest'
import { resolveClientSession, GUEST_USER } from '../src/hooks/useSession'
import { isChecklistComplete } from '../src/pages/AccountConfirmPage'
import type { SessionResult } from '../src/services/authService'

describe('resolveClientSession', () => {
  it('lets an unauthenticated visitor become DEMO_GUEST once they opted in', () => {
    // 요구사항 9절 테스트 1: 비로그인 사용자가 DEMO_GUEST로 체험 가능.
    const serverResult: SessionResult = { status: 'unauthenticated', user: null }
    const resolved = resolveClientSession(serverResult, true)
    expect(resolved.status).toBe('authenticated')
    expect(resolved.user).toEqual(GUEST_USER)
    expect(resolved.user?.accountMode).toBe('DEMO_GUEST')
  })

  it('stays unauthenticated when the visitor never opted into guest mode', () => {
    const serverResult: SessionResult = { status: 'unauthenticated', user: null }
    const resolved = resolveClientSession(serverResult, false)
    expect(resolved.status).toBe('unauthenticated')
    expect(resolved.user).toBeNull()
  })

  it('prefers the real server session over the guest flag when both are present', () => {
    const serverResult: SessionResult = {
      status: 'authenticated',
      user: {
        email: 'teacher@school.go.kr',
        name: 'Teacher',
        picture: null,
        accountMode: 'SCHOOL_WORKSPACE',
        hostedDomain: 'school.go.kr',
        schoolUseConfirmed: true,
      },
    }
    const resolved = resolveClientSession(serverResult, true)
    expect(resolved.user?.accountMode).toBe('SCHOOL_WORKSPACE')
  })
})

describe('isChecklistComplete', () => {
  it('is false until every required box is checked', () => {
    // 요구사항 9절 테스트 6: 모든 필수 체크 전에는 활성화 버튼 비활성.
    expect(isChecklistComplete([false, false, false])).toBe(false)
    expect(isChecklistComplete([true, true, false])).toBe(false)
  })

  it('is true only once all boxes are checked', () => {
    expect(isChecklistComplete([true, true, true, true, true, true, true])).toBe(true)
  })

  it('is false for an empty checklist (defensive — should never happen in the real UI)', () => {
    expect(isChecklistComplete([])).toBe(false)
  })
})
