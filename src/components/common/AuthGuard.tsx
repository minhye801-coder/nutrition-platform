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
 * 로그인하지 않은 사용자(게스트 체험 모드 제외)를 /login으로 보내고, 로그인 상태가
 * 확인될 때까지 대기 화면을 보여준다. `requireInstallation`이 true면 로그인은 됐지만
 * 설치가 아직 완료되지 않은 사용자를 /setup으로도 되돌린다(예: /app).
 */
export function AuthGuard({ children, requireInstallation = false }: AuthGuardProps) {
  const { status, user } = useSession()
  const { installation, loading: installationLoading } = useInstallation()
  const navigate = useNavigate()

  // 개인 계정(PERSONAL_ACCOUNT_BLOCKED)이거나, Workspace 계정인데 아직 최초 확인
  // 화면을 통과하지 않은 경우(WORKSPACE_CONFIRMATION_REQUIRED) 실제 업무 화면보다
  // 먼저 /account/confirm을 봐야 한다. DEMO_GUEST는 첫 화면에서 이미 명시적으로
  // "로그인 없이 체험하기"를 선택한 것이므로 별도 확인 화면이 필요 없다. 서버도 각
  // API에서 동일한 조건을 다시 검사하므로(functions/_lib/requireInstalledAccess.ts),
  // 이 화면 우회 자체가 실제 데이터 접근 권한을 만들어주지 않는다 — 이건 UX 안내일
  // 뿐이다.
  const needsAccountConfirm =
    !!user && (user.accountMode === 'PERSONAL_ACCOUNT_BLOCKED' || user.accountMode === 'WORKSPACE_CONFIRMATION_REQUIRED')

  // DEMO_GUEST/PERSONAL_ACCOUNT_BLOCKED 계정은 실제 설치(Drive/Sheets)를 절대 만들지
  // 않으므로, 이 화면들은 픽스처 데이터로 동작한다 — installation이 없다는 이유로
  // /setup으로 보내면 안 된다(그곳은 SCHOOL_WORKSPACE 전용).
  const needsInstallation =
    requireInstallation && user?.accountMode === 'SCHOOL_WORKSPACE' && !installationLoading && !installation

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login', { replace: true })
      return
    }
    if (status !== 'authenticated' || !user) return
    if (needsAccountConfirm) {
      navigate('/account/confirm', { replace: true })
      return
    }
    if (needsInstallation) {
      navigate('/setup', { replace: true })
    }
  }, [status, user, needsAccountConfirm, needsInstallation, navigate])

  if (status !== 'authenticated' || !user) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        로그인 상태를 확인하는 중입니다...
      </div>
    )
  }

  if (needsAccountConfirm) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        계정 확인 화면으로 이동하는 중입니다...
      </div>
    )
  }

  if (
    requireInstallation &&
    user.accountMode === 'SCHOOL_WORKSPACE' &&
    (installationLoading || !installation)
  ) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        설치 상태를 확인하는 중입니다...
      </div>
    )
  }

  return <>{children(user)}</>
}
