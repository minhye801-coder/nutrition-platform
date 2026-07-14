export interface SessionUser {
  email: string
  name: string
  picture: string | null
}

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'
