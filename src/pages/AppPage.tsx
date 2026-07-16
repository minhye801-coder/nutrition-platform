import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { useInstallation } from '@/hooks/useInstallation'
import type { SessionUser } from '@/types/session'

/**
 * legacy `counseling-manager/Index.html`의 `#kpis` 순서(운영 현황) 그대로.
 * `신규 접수`를 제외한 나머지는 `상담케이스.현재단계` 집계가 필요한데, 그 API가
 * 아직 없다(Milestone 2B 이후) — 그래서 이번 화면은 항목 구조만 legacy와 맞추고
 * 값은 전부 빈 상태로 둔다. 가짜 숫자를 채우지 않는다.
 */
const CASE_STATUS_KPI_LABELS = [
  '신규 접수',
  '동의 대기',
  '진단 대기',
  '결과 확인',
  '상담 예정',
  '실천 중',
  '추적상담 예정',
  '종결 검토',
  '종결',
  '전체 케이스',
  '오늘 일정',
]

/** legacy `Index.html` "질병관리청 성장도표 계산기" 링크와 동일한 고정 외부 URL. */
const GROWTH_CHART_URL = 'https://knhanes.kdca.go.kr/knhanes/grtcht/clclt/measClclt.do'

const quickLinkCardClass =
  'flex items-start gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-left text-sm transition-colors hover:border-brand-300 hover:bg-brand-50'

export function AppPage() {
  return <AuthGuard requireInstallation>{(user) => <AppContent user={user} />}</AuthGuard>
}

function AppContent({ user }: { user: SessionUser }) {
  const { installation } = useInstallation()
  // 설치 시 입력한 담당자명이 있으면 그 값을, 없으면 Google 프로필 이름을 fallback으로 표시한다.
  const displayName = installation?.managerName || user.name

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">홈 대시보드</h1>
        <p className="mt-1 text-sm text-gray-600">
          {displayName}님({user.email})의 학생정보·상담 데이터를 관리하는 화면입니다.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500">운영 현황</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CASE_STATUS_KPI_LABELS.map((label) => (
            <Card key={label} className="py-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-gray-300">–</p>
            </Card>
          ))}
        </div>
        <p className="text-xs text-gray-400">상담케이스 집계 기능은 준비 중입니다.</p>
      </section>

      <Card className="space-y-2">
        <h2 className="font-semibold text-gray-900">다가오는 일정</h2>
        <p className="text-sm text-gray-500">등록된 일정이 없습니다.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-900">업무 바로가기</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" disabled className={`${quickLinkCardClass} cursor-not-allowed opacity-60`}>
            <span className="text-lg">📋</span>
            <span>
              <span className="block font-medium text-gray-900">교육부 식생활·생활습관 진단</span>
              <span className="block text-xs text-gray-500">준비 중</span>
            </span>
          </button>

          <a href={GROWTH_CHART_URL} target="_blank" rel="noopener noreferrer" className={quickLinkCardClass}>
            <span className="text-lg">📏</span>
            <span>
              <span className="block font-medium text-gray-900">질병관리청 성장도표</span>
              <span className="block text-xs text-gray-500">신장·체중 성장 백분위 확인</span>
            </span>
          </a>

          <button type="button" disabled className={`${quickLinkCardClass} cursor-not-allowed opacity-60`}>
            <span className="text-lg">📊</span>
            <span>
              <span className="block font-medium text-gray-900">NEIS 상담관리 엑셀</span>
              <span className="block text-xs text-gray-500">준비 중</span>
            </span>
          </button>

          <button type="button" disabled className={`${quickLinkCardClass} cursor-not-allowed opacity-60`}>
            <span className="text-lg">🌱</span>
            <span>
              <span className="block font-medium text-gray-900">맛마을 탐험소</span>
              <span className="block text-xs text-gray-500">준비 중</span>
            </span>
          </button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-900">데이터 바로가기</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {installation?.spreadsheetUrl ? (
            <a href={installation.spreadsheetUrl} target="_blank" rel="noopener noreferrer" className={quickLinkCardClass}>
              <span className="text-lg">🗂️</span>
              <span>
                <span className="block font-medium text-gray-900">영양상담 매니저 데이터</span>
                <span className="block text-xs text-gray-500">상담접수·케이스·회기 데이터 열기</span>
              </span>
            </a>
          ) : (
            <span className={`${quickLinkCardClass} cursor-not-allowed opacity-60`}>
              <span className="text-lg">🗂️</span>
              <span>
                <span className="block font-medium text-gray-900">영양상담 매니저 데이터</span>
                <span className="block text-xs text-gray-500">설치를 완료하면 열 수 있습니다.</span>
              </span>
            </span>
          )}

          <button type="button" disabled className={`${quickLinkCardClass} cursor-not-allowed opacity-60`}>
            <span className="text-lg">📗</span>
            <span>
              <span className="block font-medium text-gray-900">맛마을 탐험소 데이터</span>
              <span className="block text-xs text-gray-500">준비 중</span>
            </span>
          </button>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold text-gray-900">월간 일정 캘린더</h2>
        <p className="text-sm text-gray-500">일정 관리 기능은 준비 중입니다.</p>
      </Card>
    </div>
  )
}
