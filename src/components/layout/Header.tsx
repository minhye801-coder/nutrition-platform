import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'
import { useSession } from '@/hooks/useSession'
import { logout } from '@/services/authService'
import type { NavItem } from '@/types/navigation'

const LOGGED_OUT_NAV: NavItem[] = [
  { label: '홈', path: '/' },
  { label: '로그인', path: '/login' },
]

const LOGGED_IN_NAV: NavItem[] = [
  { label: '관리자', path: '/app' },
  { label: '학생관리', path: '/students' },
  { label: '설정', path: '/settings' },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
  }`

export function Header() {
  const navigate = useNavigate()
  const { status, refresh } = useSession()
  const [loggingOut, setLoggingOut] = useState(false)
  const isAuthenticated = status === 'authenticated'

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    await refresh()
    setLoggingOut(false)
    navigate('/login', { replace: true })
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="text-lg font-bold leading-tight text-gray-900">
              영양상담 AI+
            </p>
            <p className="text-sm leading-tight text-gray-500">
              학교 영양상담 통합플랫폼
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {(isAuthenticated ? LOGGED_IN_NAV : LOGGED_OUT_NAV).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path !== '/students'}
              className={navLinkClass}
            >
              {item.label}
            </NavLink>
          ))}
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:text-gray-400"
            >
              {loggingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
