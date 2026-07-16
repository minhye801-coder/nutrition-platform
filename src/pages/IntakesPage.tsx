import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { secondaryButtonClass } from '@/components/common/buttonStyles'
import { fetchIntakes, IntakeApiError } from '@/services/intakeService'
import { useInstallation } from '@/hooks/useInstallation'
import {
  INTAKE_STATUS_APPROVED,
  INTAKE_STATUS_NEW,
  INTAKE_STATUS_REJECTED,
  INTAKE_STATUS_REVIEWING,
} from '@/types/intake'
import type { Intake } from '@/types/intake'

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

function statusBadge(status: string) {
  switch (status) {
    case INTAKE_STATUS_NEW:
      return <Badge tone="neutral">신규</Badge>
    case INTAKE_STATUS_REVIEWING:
      return <Badge tone="warning">검토중</Badge>
    case INTAKE_STATUS_APPROVED:
      return <Badge tone="success">승인</Badge>
    case INTAKE_STATUS_REJECTED:
      return <Badge tone="warning">반려</Badge>
    default:
      return <Badge tone="neutral">{status}</Badge>
  }
}

function describeIntakeListError(error: unknown): string {
  if (error instanceof IntakeApiError) {
    switch (error.code) {
      case 'not_installed':
        return '설치가 아직 완료되지 않았습니다. 설치를 먼저 진행해 주세요.'
      case 'drive_access_required':
        return 'Google Drive 접근 권한이 만료되었거나 부족합니다. 다시 로그인해 주세요.'
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      default:
        return '상담접수 목록을 불러오지 못했습니다.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

const compactButtonBase =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors'
const compactPrimaryButtonClass = `${compactButtonBase} bg-brand-600 text-white hover:bg-brand-700`
const compactSecondaryButtonClass = `${compactButtonBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`

/**
 * schoolPublicId 1개당 공개 상담신청 URL은 정확히 하나다(설치 시 1회 생성, 재로그인/개명 시
 * 재생성되지 않음 — functions/_lib/setupOrchestrator.ts:176). 이 값을 그대로 읽기 전용으로
 * 보여주고 열기/복사만 제공한다. URL을 새로 만들거나 저장하지 않는다.
 */
function PublicIntakeCard({ schoolPublicId, loading }: { schoolPublicId: string | null; loading: boolean }) {
  const [message, setMessage] = useState('')

  const publicUrl = schoolPublicId ? `${window.location.origin}/intake/${schoolPublicId}` : ''

  function showMessage(text: string) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2000)
  }

  async function handleCopy() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      showMessage('링크가 복사되었습니다.')
    } catch {
      showMessage('복사에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  function handleShowQr() {
    showMessage('QR 기능은 준비 중입니다.')
  }

  return (
    <Card className="w-full space-y-2 lg:max-w-sm">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">공개 상담신청</h2>
        <p className="mt-0.5 text-xs text-gray-500">학생·보호자가 로그인 없이 상담을 신청하는 페이지입니다.</p>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">링크를 불러오는 중...</p>
      ) : publicUrl ? (
        <>
          <p className="truncate rounded-md bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600" title={publicUrl}>
            {publicUrl}
          </p>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={compactPrimaryButtonClass}>
              상담신청 페이지 열기
            </a>
            <button type="button" onClick={() => void handleCopy()} className={compactSecondaryButtonClass}>
              링크 복사
            </button>
            <button type="button" onClick={handleShowQr} className={compactSecondaryButtonClass}>
              QR 보기
            </button>
          </div>
          {message && <p className="text-xs text-gray-500">{message}</p>}
        </>
      ) : (
        <p className="text-xs text-gray-400">설치를 완료하면 링크가 표시됩니다.</p>
      )}
    </Card>
  )
}

export function IntakesPage() {
  return <AuthGuard requireInstallation>{() => <IntakesContent />}</AuthGuard>
}

function IntakesContent() {
  const { installation, loading: installationLoading } = useInstallation()
  const [intakes, setIntakes] = useState<Intake[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [filters, setFilters] = useState({ status: '', q: '' })
  const [filterInputs, setFilterInputs] = useState(filters)

  const loadIntakes = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchIntakes({ status: filters.status || undefined, q: filters.q || undefined })
      setIntakes(result)
    } catch (error) {
      setLoadError(describeIntakeListError(error))
    } finally {
      setLoading(false)
    }
  }, [filters.status, filters.q])

  useEffect(() => {
    void loadIntakes()
  }, [loadIntakes])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(filterInputs)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">상담접수</h1>
          <p className="mt-1 text-sm text-gray-500">공개 상담신청 폼으로 들어온 접수를 검토하고 승인/반려합니다.</p>
        </div>
        <PublicIntakeCard schoolPublicId={installation?.schoolPublicId ?? null} loading={installationLoading} />
      </div>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500">검색 및 필터</h2>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={applyFilters}>
          <div className="sm:col-span-2">
            <label htmlFor="q" className="block text-xs font-medium text-gray-500">
              학생명/신청자명 검색
            </label>
            <input
              id="q"
              type="text"
              value={filterInputs.q}
              onChange={(event) => setFilterInputs({ ...filterInputs, q: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-gray-500">
              상태
            </label>
            <select
              id="status"
              value={filterInputs.status}
              onChange={(event) => setFilterInputs({ ...filterInputs, status: event.target.value })}
              className={inputClass}
            >
              <option value="">전체</option>
              <option value={INTAKE_STATUS_NEW}>신규</option>
              <option value={INTAKE_STATUS_REVIEWING}>검토중</option>
              <option value={INTAKE_STATUS_APPROVED}>승인</option>
              <option value={INTAKE_STATUS_REJECTED}>반려</option>
            </select>
          </div>
          <div className="flex items-end sm:col-span-4">
            <button type="submit" className={secondaryButtonClass}>
              검색/필터 적용
            </button>
          </div>
        </form>
      </Card>

      <Card>
        {loadError && <p className="mb-3 text-sm text-red-600">{loadError}</p>}
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : intakes.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">조건에 맞는 상담접수가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2">학생명</th>
                  <th className="py-2 pr-2">학년/반</th>
                  <th className="py-2 pr-2">신청자</th>
                  <th className="py-2 pr-2">상담주제</th>
                  <th className="py-2 pr-2">접수일</th>
                  <th className="py-2 pr-2">상태</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {intakes.map((intake) => (
                  <tr key={intake.intakeId} className="border-b border-gray-100">
                    <td className="py-2 pr-2 text-gray-900">{intake.name}</td>
                    <td className="py-2 pr-2 text-gray-700">
                      {intake.grade}학년 {intake.class}반
                    </td>
                    <td className="py-2 pr-2 text-gray-700">
                      {intake.applicantName}({intake.applicantType})
                    </td>
                    <td className="py-2 pr-2 text-gray-700">{intake.topic}</td>
                    <td className="py-2 pr-2 text-gray-500">{intake.submittedAt.slice(0, 10)}</td>
                    <td className="py-2 pr-2">{statusBadge(intake.status)}</td>
                    <td className="py-2 pr-2 text-right">
                      <Link to={`/intakes/${intake.intakeId}`} className="text-sm font-medium text-brand-600 hover:underline">
                        상세보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
