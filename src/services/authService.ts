import type { SessionStatus, SessionUser } from '@/types/session'

interface SessionResponse {
  authenticated: boolean
  user?: SessionUser
}

export interface SessionResult {
  status: SessionStatus
  user: SessionUser | null
}

export async function fetchSession(): Promise<SessionResult> {
  try {
    const response = await fetch('/api/auth/session', { credentials: 'include' })
    if (!response.ok) {
      return { status: 'unauthenticated', user: null }
    }
    const data = (await response.json()) as SessionResponse
    if (data.authenticated && data.user) {
      return { status: 'authenticated', user: data.user }
    }
    return { status: 'unauthenticated', user: null }
  } catch {
    return { status: 'unauthenticated', user: null }
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export const GOOGLE_LOGIN_URL = '/api/auth/google'
