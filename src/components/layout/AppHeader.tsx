import { Link } from 'react-router-dom'
import { Logo } from './Logo'

interface AppHeaderProps {
  schoolName: string | null
  onLogout: () => void
  loggingOut: boolean
  onToggleSidebar: () => void
}

/**
 * legacy `counseling-manager/Index.html`의 `<header><h1>AI 영양상담 매니저</h1>
 * <div id="schoolName">학교명 · 학년도</div></header>` 구성과 같은 정보(서비스명,
 * 학교명·학년도)를 보여준다. 인증된 앱 화면(`AppShellLayout`)에서만 쓰고,
 * 공개 페이지(`RootLayout`)의 기존 `Header.tsx`는 그대로 둔다.
 *
 * legacy는 학년도를 학교별 "설정" 시트 값(SCHOOL_YEAR)에서 읽지만, 현재 시스템에는
 * 그 값을 저장·조회하는 설정 화면/API가 아직 없다(이번 작업 범위 밖 — D1/설치 로직
 * 변경 금지). 대신 `PublicIntakePage.tsx`의 기본값과 동일하게 클라이언트에서 계산한
 * 현재 연도를 표시용으로만 쓴다(저장된 값이 아님).
 */
export function AppHeader({ schoolName, onLogout, loggingOut, onToggleSidebar }: AppHeaderProps) {
  const currentYear = new Date().getFullYear()
  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
          aria-label="메뉴 열기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>
        <Link to="/app" className="flex items-center gap-2">
          <Logo />
          <span className="text-base font-bold text-gray-900">AI 영양상담 매니저</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-gray-500 sm:inline">
          {schoolName ? `${schoolName} · ${currentYear}학년도` : '설치 후 표시됩니다'}
        </span>
        <Link to="/settings" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          설정
        </Link>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:text-gray-400"
        >
          {loggingOut ? '로그아웃 중...' : '로그아웃'}
        </button>
      </div>
    </header>
  )
}
