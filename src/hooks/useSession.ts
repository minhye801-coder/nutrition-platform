import { useCallback, useEffect, useState } from 'react'
import { fetchSession, type SessionResult } from '@/services/authService'
import { setCachedAccountMode } from '@/lib/accountModeCache'
import { isGuestSession } from '@/lib/demoAck'
import type { SessionStatus, SessionUser } from '@/types/session'

interface UseSessionResult {
  status: SessionStatus
  user: SessionUser | null
  refresh: () => Promise<void>
}

/** "로그인 없이 체험하기"를 선택한 게스트용 합성 사용자 — 서버에 세션이 없으므로 이 값은 화면 표시에만 쓰인다. */
export const GUEST_USER: SessionUser = {
  email: '',
  name: '체험 사용자',
  picture: null,
  accountMode: 'DEMO_GUEST',
  hostedDomain: null,
  schoolUseConfirmed: false,
}

/**
 * useSession()의 핵심 분기를 React 상태와 분리한 순수 함수 — 유닛 테스트로 직접
 * 검증할 수 있다(요구사항 9절 테스트 1 "비로그인 사용자가 DEMO_GUEST 체험 가능").
 * 서버 세션이 없어도 게스트 플래그가 있으면 체험 모드로 계속 취급한다 — 실제 데이터
 * API는 세션 쿠키가 없으므로 이 값과 무관하게 항상 거부되고
 * (functions/_lib/requireSession.ts), 이 값은 화면 분기(어느 저장소를 쓸지, 어떤
 * 배너를 보여줄지)에만 쓰인다.
 */
export function resolveClientSession(
  serverResult: SessionResult,
  isGuest: boolean,
): { status: SessionStatus; user: SessionUser | null } {
  if (serverResult.status === 'unauthenticated' && isGuest) {
    return { status: 'authenticated', user: GUEST_USER }
  }
  return { status: serverResult.status, user: serverResult.user }
}

export function useSession(): UseSessionResult {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)

  const refresh = useCallback(async () => {
    setStatus('loading')
    const serverResult = await fetchSession()
    const resolved = resolveClientSession(serverResult, isGuestSession())
    setStatus(resolved.status)
    setUser(resolved.user)
    setCachedAccountMode(resolved.user?.accountMode ?? null)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { status, user, refresh }
}
