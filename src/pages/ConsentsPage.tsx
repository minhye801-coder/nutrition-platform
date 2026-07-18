import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { ConsentApiError, fetchConsents } from '@/services/consentService'
import {
  CONSENT_STATUS_CONFIRMED,
  CONSENT_STATUS_DECLINED,
  CONSENT_STATUS_NEEDS_REVIEW,
  CONSENT_STATUS_NOT_SENT,
  CONSENT_STATUS_REQUESTED,
} from '@/types/consent'
import type { ConsentListItem } from '@/types/consent'

function statusBadge(status: string) {
  switch (status) {
    case CONSENT_STATUS_NOT_SENT:
      return <Badge tone="neutral">미발송</Badge>
    case CONSENT_STATUS_REQUESTED:
      return <Badge tone="warning">동의 요청</Badge>
    case CONSENT_STATUS_NEEDS_REVIEW:
      return <Badge tone="warning">교사 확인 필요</Badge>
    case CONSENT_STATUS_CONFIRMED:
      return <Badge tone="success">동의 완료</Badge>
    case CONSENT_STATUS_DECLINED:
      return <Badge tone="warning">비동의</Badge>
    default:
      return <Badge tone="neutral">{status}</Badge>
  }
}

function describeConsentError(error: unknown): string {
  if (error instanceof ConsentApiError) {
    switch (error.code) {
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      default:
        return '목록을 불러오지 못했습니다.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export function ConsentsPage() {
  return <AuthGuard requireInstallation>{() => <ConsentsContent />}</AuthGuard>
}

function ConsentsContent() {
  const [items, setItems] = useState<ConsentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchConsents()
      setItems(result)
    } catch (error) {
      setLoadError(describeConsentError(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">보호자동의 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          승인된 상담접수의 보호자동의 링크를 발송하고, 보호자 제출 내용을 확인·확정합니다.
        </p>
      </div>

      <Card>
        {loadError && <p className="mb-3 text-sm text-red-600">{loadError}</p>}
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">보호자동의 대상 케이스가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2">학생</th>
                  <th className="py-2 pr-2">상담 주제</th>
                  <th className="py-2 pr-2">동의 상태</th>
                  <th className="py-2 pr-2">발송일</th>
                  <th className="py-2 pr-2">제출일</th>
                  <th className="py-2 pr-2">학생 참여</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {items.map(({ consent, studentName, gradeClass, caseTopic }) => (
                  <tr key={consent.consentId} className="border-b border-gray-100">
                    <td className="py-2 pr-2 text-gray-900">
                      {gradeClass} {studentName || '-'}
                    </td>
                    <td className="py-2 pr-2 text-gray-700">{caseTopic || '-'}</td>
                    <td className="py-2 pr-2">{statusBadge(consent.status)}</td>
                    <td className="py-2 pr-2 text-gray-500">{consent.requestedAt.slice(0, 10) || '-'}</td>
                    <td className="py-2 pr-2 text-gray-500">{consent.respondedAt.slice(0, 10) || '-'}</td>
                    <td className="py-2 pr-2 text-gray-700">{consent.studentAssent || '미확인'}</td>
                    <td className="py-2 pr-2 text-right">
                      <Link
                        to={`/consents/${consent.caseId}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        관리
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
