import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { CaseApiError, fetchCaseDetail } from '@/services/caseService'
import type { CaseDetail } from '@/types/case'

const fieldRowClass = 'flex flex-col gap-1 sm:flex-row sm:gap-3'
const fieldLabelClass = 'w-32 shrink-0 text-xs font-medium text-gray-500'
const fieldValueClass = 'text-sm text-gray-900'

function describeError(error: unknown): string {
  if (error instanceof CaseApiError) {
    switch (error.code) {
      case 'not_found':
        return '해당 케이스를 찾을 수 없습니다.'
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      default:
        return '불러오지 못했습니다.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export function CaseDetailPage() {
  return <AuthGuard requireInstallation>{() => <CaseDetailContent />}</AuthGuard>
}

function CaseDetailContent() {
  const { caseId } = useParams<{ caseId: string }>()
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    if (!caseId) return
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchCaseDetail(caseId)
      setDetail(result)
    } catch (error) {
      setLoadError(describeError(error))
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    void load()
  }, [load])

  if (!caseId) {
    return <p className="py-16 text-center text-sm text-gray-500">잘못된 접근입니다.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/cases" className="text-sm text-gray-500 hover:underline">
          ← 학생·상담 검색
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">상담 이력</h1>
      </div>

      <Card className="space-y-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : detail ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {detail.gradeClass} {detail.studentName}
              </h2>
              <Badge tone="neutral">{detail.case.status}</Badge>
            </div>

            <div className="space-y-2">
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>상담 주제</span>
                <span className={fieldValueClass}>{detail.case.topic || '-'}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>접수일</span>
                <span className={fieldValueClass}>{detail.case.openedAt || '-'}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>다음 일정</span>
                <span className={fieldValueClass}>{detail.case.nextScheduledAt || '-'}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>보호자동의 상태</span>
                <span className={fieldValueClass}>
                  {detail.consentStatus || '-'}{' '}
                  <Link to={`/consents/${detail.case.caseId}`} className="text-brand-600 hover:underline">
                    관리
                  </Link>
                </span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>Drive 폴더</span>
                <span className={fieldValueClass}>
                  {detail.case.driveFolderUrl ? (
                    <a href={detail.case.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                      열기
                    </a>
                  ) : (
                    '-'
                  )}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
              상담 회기·목표 이력은 다음 마일스톤(상담회기 및 목표관리)에서 제공됩니다.
            </div>
          </>
        ) : null}
      </Card>
    </div>
  )
}
