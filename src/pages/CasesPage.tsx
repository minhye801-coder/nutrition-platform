import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { secondaryButtonClass } from '@/components/common/buttonStyles'
import { CaseApiError, fetchCases } from '@/services/caseService'
import { CASE_STATUS_VALUES } from '@/types/case'
import type { CaseSearchItem } from '@/types/case'

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

function describeError(error: unknown): string {
  if (error instanceof CaseApiError) {
    switch (error.code) {
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      default:
        return '목록을 불러오지 못했습니다.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export function CasesPage() {
  return <AuthGuard requireInstallation>{() => <CasesContent />}</AuthGuard>
}

function CasesContent() {
  const [items, setItems] = useState<CaseSearchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [filters, setFilters] = useState({ keyword: '', status: '' })
  const [filterInputs, setFilterInputs] = useState(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchCases({ keyword: filters.keyword || undefined, status: filters.status || undefined })
      setItems(result)
    } catch (error) {
      setLoadError(describeError(error))
    } finally {
      setLoading(false)
    }
  }, [filters.keyword, filters.status])

  useEffect(() => {
    void load()
  }, [load])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFilters(filterInputs)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">학생·상담 검색</h1>
        <p className="mt-1 text-sm text-gray-500">상담케이스가 만들어진 학생만 표시됩니다(접수 대기·반려 건은 표시되지 않습니다).</p>
      </div>

      <Card className="space-y-4">
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={applyFilters}>
          <div className="sm:col-span-2">
            <label htmlFor="keyword" className="block text-xs font-medium text-gray-500">
              학생 이름·학년·주제 검색
            </label>
            <input
              id="keyword"
              type="text"
              value={filterInputs.keyword}
              onChange={(event) => setFilterInputs({ ...filterInputs, keyword: event.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-gray-500">
              현재 단계
            </label>
            <select
              id="status"
              value={filterInputs.status}
              onChange={(event) => setFilterInputs({ ...filterInputs, status: event.target.value })}
              className={inputClass}
            >
              <option value="">전체 상태</option>
              {CASE_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className={secondaryButtonClass}>
              검색
            </button>
          </div>
        </form>
      </Card>

      <Card>
        {loadError && <p className="mb-3 text-sm text-red-600">{loadError}</p>}
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">상담 케이스가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2">학년반</th>
                  <th className="py-2 pr-2">학생</th>
                  <th className="py-2 pr-2">주제</th>
                  <th className="py-2 pr-2">상태</th>
                  <th className="py-2 pr-2">상담 회기</th>
                  <th className="py-2 pr-2">최근 상담</th>
                  <th className="py-2 pr-2">다음 일정</th>
                  <th className="py-2 pr-2">최근 목표</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.caseId} className="border-b border-gray-100">
                    <td className="py-2 pr-2 text-gray-700">{item.gradeClass || '-'}</td>
                    <td className="py-2 pr-2 font-medium text-gray-900">{item.studentName || '-'}</td>
                    <td className="py-2 pr-2 text-gray-700">{item.topic || '-'}</td>
                    <td className="py-2 pr-2">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{item.status}</span>
                    </td>
                    <td className="py-2 pr-2 text-gray-700">{item.sessionCount}회</td>
                    <td className="py-2 pr-2 text-gray-500">{item.lastSessionDate || '-'}</td>
                    <td className="py-2 pr-2 text-gray-500">{item.nextDate ? item.nextDate.slice(0, 10) : '-'}</td>
                    <td className="py-2 pr-2 text-gray-700">{item.latestGoal || '-'}</td>
                    <td className="py-2 pr-2 text-right">
                      <Link to={`/cases/${item.caseId}`} className="text-sm font-medium text-brand-600 hover:underline">
                        상담 이력 보기
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
