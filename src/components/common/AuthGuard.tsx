import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import type { SessionUser } from '@/types/session'

interface AuthGuardProps {
  children: (user: SessionUser) => ReactNode
}

/** 로그인하지 않은 사용자를 /login으로 보내고, 로그인 상태가 확인될 때까지 대기 화면을 보여준다. */
export function AuthGuard({ children }: AuthGuardProps) {
  const { status, user } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login', { replace: true })
    }
  }, [status, navigate])

  if (status !== 'authenticated' || !user) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        로그인 상태를 확인하는 중입니다...
      </div>
    )
  }

  return <>{children(user)}</>
}
