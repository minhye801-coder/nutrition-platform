import { useCallback, useEffect, useState } from 'react'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { confirmConsent, ConsentApiError, fetchConsents, sendConsentLink } from '@/services/consentService'
import {
  CONSENT_STATUS_CONFIRMED,
  CONSENT_STATUS_DECLINED,
  CONSENT_STATUS_NEEDS_REVIEW,
  CONSENT_STATUS_NOT_SENT,
  CONSENT_STATUS_REQUESTED,
} from '@/types/consent'
import type { ConsentListItem } from '@/types/consent'

const compactButtonBase =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const compactPrimaryButtonClass = `${compactButtonBase} bg-brand-600 text-white hover:bg-brand-700`
const compactSecondaryButtonClass = `${compactButtonBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`

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
      case 'not_found':
        return '해당 케이스를 찾을 수 없습니다.'
      case 'invalid_transition':
        return '지금 상태에서는 처리할 수 없습니다. 목록을 새로고침해 주세요.'
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      default:
        return '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'
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
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ caseId: string; message: string } | null>(null)
  const [copiedCaseId, setCopiedCaseId] = useState<string | null>(null)

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

  async function handleSend(caseId: string) {
    if (pendingCaseId) return
    setPendingCaseId(caseId)
    setRowError(null)
    try {
      await sendConsentLink(caseId)
      await load()
    } catch (error) {
      setRowError({ caseId, message: describeConsentError(error) })
    } finally {
      setPendingCaseId(null)
    }
  }

  async function handleConfirm(caseId: string) {
    if (pendingCaseId) return
    setPendingCaseId(caseId)
    setRowError(null)
    try {
      await confirmConsent(caseId)
      await load()
    } catch (error) {
      setRowError({ caseId, message: describeConsentError(error) })
    } finally {
      setPendingCaseId(null)
    }
  }

  async function handleCopyLink(caseId: string, token: string) {
    const url = `${window.location.origin}/consent/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedCaseId(caseId)
      setTimeout(() => setCopiedCaseId((current) => (current === caseId ? null : current)), 2000)
    } catch {
      setRowError({ caseId, message: '복사에 실패했습니다. 잠시 후 다시 시도해 주세요.' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">보호자동의</h1>
        <p className="mt-1 text-sm text-gray-500">
          케이스별 보호자동의 링크를 발송하고, 보호자 제출 내용을 최종 확인합니다.
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2">학생명</th>
                  <th className="py-2 pr-2">상담주제</th>
                  <th className="py-2 pr-2">케이스 단계</th>
                  <th className="py-2 pr-2">동의 상태</th>
                  <th className="py-2 pr-2">보호자</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {items.map(({ consent, studentName, caseTopic, caseStatus }) => (
                  <tr key={consent.consentId} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-2 text-gray-900">{studentName || '-'}</td>
                    <td className="py-2 pr-2 text-gray-700">{caseTopic || '-'}</td>
                    <td className="py-2 pr-2 text-gray-700">{caseStatus || '-'}</td>
                    <td className="py-2 pr-2">{statusBadge(consent.status)}</td>
                    <td className="py-2 pr-2 text-gray-700">
                      {consent.guardianName ? `${consent.guardianName}(${consent.relationToStudent})` : '-'}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap justify-end gap-2">
                        {consent.status === CONSENT_STATUS_NOT_SENT && (
                          <button
                            type="button"
                            disabled={pendingCaseId === consent.caseId}
                            onClick={() => void handleSend(consent.caseId)}
                            className={compactPrimaryButtonClass}
                          >
                            링크 생성·발송
                          </button>
                        )}
                        {consent.status === CONSENT_STATUS_REQUESTED && (
                          <button
                            type="button"
                            onClick={() => void handleCopyLink(consent.caseId, consent.consentToken)}
                            className={compactSecondaryButtonClass}
                          >
                            {copiedCaseId === consent.caseId ? '복사됨' : '링크 복사'}
                          </button>
                        )}
                        {consent.status === CONSENT_STATUS_NEEDS_REVIEW && (
                          <button
                            type="button"
                            disabled={pendingCaseId === consent.caseId}
                            onClick={() => void handleConfirm(consent.caseId)}
                            className={compactPrimaryButtonClass}
                          >
                            확인 완료 처리
                          </button>
                        )}
                      </div>
                      {rowError?.caseId === consent.caseId && (
                        <p className="mt-1 text-right text-xs text-red-600">{rowError.message}</p>
                      )}
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
