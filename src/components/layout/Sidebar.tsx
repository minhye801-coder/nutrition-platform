import { NavLink } from 'react-router-dom'
import type { NavItem } from '@/types/navigation'

/**
 * legacy `counseling-manager/Index.html`(nav 섹션)과 동일한 순서·명칭을 따른다.
 * 아직 구현되지 않은 화면은 라우트 자체는 만들되 comingSoon으로 표시해
 * "준비 중" 안내만 보여준다(메뉴를 숨기거나 새 기능으로 바꾸지 않는다).
 */
const MENU_ITEMS: NavItem[] = [
  { label: '홈 대시보드', path: '/app' },
  { label: '상담 접수 관리', path: '/intakes' },
  { label: '보호자 동의 관리', path: '/consents' },
  { label: '공식 진단 PDF', path: '/diagnosis', comingSoon: true },
  { label: '상담 기록', path: '/sessions', comingSoon: true },
  { label: '다음 회기 준비', path: '/preparation', comingSoon: true },
  { label: 'NEIS 업로드', path: '/neis', comingSoon: true },
  { label: '효과평가·성장', path: '/evaluation', comingSoon: true },
  { label: '학생·상담 검색', path: '/students' },
  { label: '테스트 데이터 정리', path: '/cleanup', comingSoon: true },
]

/**
 * legacy에서는 학교별 "설정" 시트에 저장된 OFFICIAL_DIAG_URL을 그대로 열었지만,
 * 현재 시스템에는 이 값을 저장·조회하는 설정 화면/API가 아직 없다(임의 URL을
 * 지어내지 않는다) — 그래서 고정 외부 링크가 아니라 다른 항목들과 같은 방식의
 * "준비 중" 라우트로 취급한다.
 */
const OFFICIAL_DIAGNOSIS_ITEM: NavItem = { label: '교육부 진단프로그램', path: '/official-diagnosis', comingSoon: true }

/** legacy `Index.html` "질병관리청 성장도표 계산기" 링크와 동일한 고정 외부 URL. */
const GROWTH_CHART_URL = 'https://knhanes.kdca.go.kr/knhanes/grtcht/clclt/measClclt.do'

const itemClass = (isActive: boolean) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
  }`

interface SidebarProps {
  schoolPublicId: string | null
  onLogout: () => void
  loggingOut: boolean
  /** 모바일에서 메뉴 클릭 시 사이드바를 닫기 위한 콜백(선택). */
  onNavigate?: () => void
}

export function Sidebar({ schoolPublicId, onLogout, loggingOut, onNavigate }: SidebarProps) {
  const publicIntakeUrl = schoolPublicId ? `${window.location.origin}/intake/${schoolPublicId}` : null

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-gray-200 bg-white p-3">
      {MENU_ITEMS.map((item) =>
        item.comingSoon ? (
          <NavLink key={item.path} to={item.path} onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
            {item.label}
            <span className="ml-1.5 text-xs font-normal text-gray-400">(준비 중)</span>
          </NavLink>
        ) : (
          <NavLink key={item.path} to={item.path} onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
            {item.label}
          </NavLink>
        ),
      )}

      <div className="my-2 border-t border-gray-100" />

      {publicIntakeUrl ? (
        <a
          href={publicIntakeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          공개 접수 페이지 열기
        </a>
      ) : (
        <span className="block rounded-md px-3 py-2 text-sm font-medium text-gray-300">
          공개 접수 페이지 열기
        </span>
      )}

      <NavLink to={OFFICIAL_DIAGNOSIS_ITEM.path} onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
        {OFFICIAL_DIAGNOSIS_ITEM.label}
        <span className="ml-1.5 text-xs font-normal text-gray-400">(준비 중)</span>
      </NavLink>

      <a
        href={GROWTH_CHART_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
      >
        질병관리청 성장도표 계산기
      </a>

      <div className="my-2 border-t border-gray-100" />

      <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => itemClass(isActive)}>
        설정
      </NavLink>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="block rounded-md px-3 py-2 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:text-gray-400"
      >
        {loggingOut ? '로그아웃 중...' : '로그아웃'}
      </button>
    </nav>
  )
}
