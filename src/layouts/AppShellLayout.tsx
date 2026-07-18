import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AppHeader } from '@/components/layout/AppHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { ModeBanner } from '@/components/common/ModeBanner'
import { useInstallation } from '@/hooks/useInstallation'
import { logout } from '@/services/authService'
import { useSession } from '@/hooks/useSession'
import { endGuestSession } from '@/lib/demoAck'

/**
 * 로그인 후 실제 업무 화면(`/app`, `/intakes`, `/students`, `/settings` 등) 전용
 * 레이아웃. legacy `counseling-manager/Index.html`의 상단 헤더 + 좌측 사이드바
 * 구조를 그대로 따른다. 각 페이지 자체의 `<AuthGuard>`는 그대로 유지되므로(이
 * 레이아웃은 그 위에 얹히는 순수 表시 껍데기), 인증/설치 판정 로직은 건드리지 않는다.
 */
export function AppShellLayout() {
  const navigate = useNavigate()
  const { user, refresh: refreshSession } = useSession()
  const { installation } = useInstallation()
  const [loggingOut, setLoggingOut] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    await refreshSession()
    setLoggingOut(false)
    navigate('/login', { replace: true })
  }

  function handleExitGuest() {
    endGuestSession()
    navigate('/', { replace: true })
  }

  function handleGuestLoginAsWorkspace() {
    endGuestSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-full min-h-screen flex-col">
      {user && (
        <ModeBanner
          accountMode={user.accountMode}
          onExitGuest={handleExitGuest}
          onLoginAsWorkspace={handleGuestLoginAsWorkspace}
        />
      )}
      <AppHeader
        schoolName={installation?.schoolName ?? null}
        onLogout={() => void handleLogout()}
        loggingOut={loggingOut}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />

      <div className="flex min-h-0 flex-1">
        {/* 데스크톱: 항상 보이는 고정 사이드바 */}
        <div className="hidden lg:block">
          <Sidebar
            schoolPublicId={installation?.schoolPublicId ?? null}
            onLogout={() => void handleLogout()}
            loggingOut={loggingOut}
          />
        </div>

        {/* 좁은 화면: 토글로 열고 닫는 오버레이 사이드바 */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
            <div className="absolute inset-y-0 left-0 shadow-lg">
              <Sidebar
                schoolPublicId={installation?.schoolPublicId ?? null}
                onLogout={() => void handleLogout()}
                loggingOut={loggingOut}
                onNavigate={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden bg-gray-50 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
