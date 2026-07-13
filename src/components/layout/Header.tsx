import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import type { NavItem } from '@/types/navigation'

const NAV_ITEMS: NavItem[] = [
  { label: '홈', path: '/' },
  { label: '로그인', path: '/login' },
  { label: '설치', path: '/setup' },
  { label: '관리자', path: '/app' },
  { label: '설정', path: '/settings' },
]

export function Header() {
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

        <nav className="flex flex-wrap gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
