import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { primaryButtonClass } from '@/components/common/buttonStyles'
import { useInstallation } from '@/hooks/useInstallation'
import { fetchCases } from '@/services/caseService'
import { CASE_STATUS_VALUES } from '@/types/case'
import type { SessionUser } from '@/types/session'

/**
 * legacy `counseling-manager/Index.html`의 `#kpis` 순서(운영 현황) 그대로.
 * `상담케이스.현재단계`(CASE_STATUS_VALUES) 8단계 + 전체 케이스는 GET /api/cases 응답을
 * 클라이언트에서 집계해 채운다 — 진단·검사 모듈이 만든 '진단 대기'→'결과 확인'→
 * '상담 예정' 전이가 그대로 이 화면에 반영된다(대시보드 연계). `신규 접수`(상담신청
 * 접수 건수)와 `오늘 일정`(상담회기 일정)은 각각 별도 시트/CRUD가 아직 없어
 * (상담회기는 Milestone 5 범위) 계속 빈 상태로 둔다 — 가짜 숫자를 채우지 않는다.
 */
const CASE_STATUS_KPI_LABELS = ['신규 접수', ...CASE_STATUS_VALUES, '전체 케이스', '오늘 일정'] as const

const NOT_YET_AVAILABLE_KPI_LABELS = new Set(['신규 접수', '오늘 일정'])

/** legacy `Index.html` "질병관리청 성장도표 계산기" 링크와 동일한 고정 외부 URL. */
const GROWTH_CHART_URL = 'https://knhanes.kdca.go.kr/knhanes/grtcht/clclt/measClclt.do'

/** 교육부 식생활·생활습관 진단(공식 진단프로그램) 고정 외부 URL. */
const OFFICIAL_DIAGNOSIS_URL = 'http://www.sfpi.or.kr/food/index.html#/'

const quickLinkCardClass =
  'flex items-start gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-left text-sm transition-colors hover:border-brand-300 hover:bg-brand-50'

export function AppPage() {
  return <AuthGuard requireInstallation>{(user) => <AppContent user={user} />}</AuthGuard>
}

function AppContent({ user }: { user: SessionUser }) {
  const { installation } = useInstallation()
  // 설치 시 입력한 담당자명이 있으면 그 값을, 없으면 Google 프로필 이름을 fallback으로 표시한다.
  const displayName = installation?.managerName || user.name

  const [statusCounts, setStatusCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCases()
      .then((cases) => {
        if (cancelled) return
        const counts: Record<string, number> = {}
        for (const item of cases) {
          counts[item.status] = (counts[item.status] ?? 0) + 1
        }
        counts['전체 케이스'] = cases.length
        setStatusCounts(counts)
      })
      .catch(() => {
        // 집계 실패는 조용히 무시한다 — KPI는 대시보드 요약일 뿐, 실패해도 나머지 화면은 그대로 쓸 수 있어야 한다.
      })
    return () => {
      cancelled = true
    }
  }, [])

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
          {CASE_STATUS_KPI_LABELS.map((label) => {
            const notYetAvailable = NOT_YET_AVAILABLE_KPI_LABELS.has(label)
            const count = notYetAvailable ? null : (statusCounts?.[label] ?? (statusCounts ? 0 : null))
            const body = (
              <>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`mt-1 text-xl font-bold ${count === null ? 'text-gray-300' : 'text-gray-900'}`}>
                  {count === null ? '–' : count}
                </p>
              </>
            )
            // 진단·검사 모듈이 만드는 두 단계는 클릭하면 바로 그 화면으로 이동한다(대시보드 연계).
            if (label === '진단 대기' || label === '결과 확인') {
              return (
                <Link key={label} to="/assessments">
                  <Card className="py-3 transition-colors hover:border-brand-300 hover:bg-brand-50">{body}</Card>
                </Link>
              )
            }
            return (
              <Card key={label} className="py-3">
                {body}
              </Card>
            )
          })}
        </div>
        <p className="text-xs text-gray-400">신규 접수·오늘 일정 집계 기능은 준비 중입니다.</p>
      </section>

      <Card className="space-y-2">
        <h2 className="font-semibold text-gray-900">다가오는 일정</h2>
        <p className="text-sm text-gray-500">등록된 일정이 없습니다.</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-gray-900">업무 바로가기</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-lg">📋</span>
              <span className="font-medium text-gray-900">교육부 식생활·생활습관 진단</span>
            </div>
            <p className="text-xs text-gray-500">
              공식 식생활·생활습관 진단을 실시하고 진단결과와 응답내역 PDF를 내려받습니다.
            </p>
            <a
              href={OFFICIAL_DIAGNOSIS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${primaryButtonClass} self-start`}
            >
              교육부 진단프로그램 열기
            </a>
          </div>

          <a href={GROWTH_CHART_URL} target="_blank" rel="noopener noreferrer" className={quickLinkCardClass}>
            <span className="text-lg">📏</span>
            <span>
              <span className="block font-medium text-gray-900">성장도표 계산기</span>
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
