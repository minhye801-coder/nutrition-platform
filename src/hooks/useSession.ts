import { useCallback, useEffect, useState } from 'react'
import { fetchSession } from '@/services/authService'
import { setCachedAccountMode } from '@/lib/accountModeCache'
import type { SessionStatus, SessionUser } from '@/types/session'

interface UseSessionResult {
  status: SessionStatus
  user: SessionUser | null
  refresh: () => Promise<void>
}

export function useSession(): UseSessionResult {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)

  const refresh = useCallback(async () => {
    setStatus('loading')
    const result = await fetchSession()
    setStatus(result.status)
    setUser(result.user)
    setCachedAccountMode(result.user?.accountMode ?? null)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { status, user, refresh }
}
