import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { useInstallation } from '@/hooks/useInstallation'
import type { SessionUser } from '@/types/session'

interface AuthGuardProps {
  children: (user: SessionUser) => ReactNode
  /** true면 로그인뿐 아니라 설치 완료도 요구한다(/app). 미완료면 /setup으로 보낸다. */
  requireInstallation?: boolean
}

/**
 * 로그인하지 않은 사용자를 /login으로 보내고, 로그인 상태가 확인될 때까지 대기
 * 화면을 보여준다. `requireInstallation`이 true면 로그인은 됐지만 설치가 아직
 * 완료되지 않은 사용자를 /setup으로도 되돌린다(예: /app).
 */
export function AuthGuard({ children, requireInstallation = false }: AuthGuardProps) {
  const { status, user } = useSession()
  const { installation, loading: installationLoading } = useInstallation()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login', { replace: true })
      return
    }
    if (
      status === 'authenticated' &&
      requireInstallation &&
      !installationLoading &&
      !installation
    ) {
      navigate('/setup', { replace: true })
    }
  }, [status, requireInstallation, installationLoading, installation, navigate])

  if (status !== 'authenticated' || !user) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        로그인 상태를 확인하는 중입니다...
      </div>
    )
  }

  if (requireInstallation && (installationLoading || !installation)) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        설치 상태를 확인하는 중입니다...
      </div>
    )
  }

  return <>{children(user)}</>
}
