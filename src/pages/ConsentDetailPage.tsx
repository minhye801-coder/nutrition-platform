import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import {
  confirmConsent,
  ConsentApiError,
  fetchConsentDetail,
  saveStudentAssent,
  sendConsentLink,
} from '@/services/consentService'
import {
  CONSENT_STATUS_CONFIRMED,
  CONSENT_STATUS_DECLINED,
  CONSENT_STATUS_NEEDS_REVIEW,
  CONSENT_STATUS_NOT_SENT,
  STUDENT_ASSENT_VALUES,
} from '@/types/consent'
import type { ConsentDetail } from '@/types/consent'

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

const fieldRowClass = 'flex flex-col gap-1 sm:flex-row sm:gap-3'
const fieldLabelClass = 'w-36 shrink-0 text-xs font-medium text-gray-500'
const fieldValueClass = 'text-sm text-gray-900'

function statusBadge(status: string) {
  const tone = status === CONSENT_STATUS_CONFIRMED ? 'success' : status === CONSENT_STATUS_NOT_SENT ? 'neutral' : 'warning'
  return <Badge tone={tone}>{status || CONSENT_STATUS_NOT_SENT}</Badge>
}

function describeError(error: unknown): string {
  if (error instanceof ConsentApiError) {
    switch (error.code) {
      case 'not_found':
        return '해당 케이스를 찾을 수 없습니다.'
      case 'invalid_transition':
        return '지금 상태에서는 처리할 수 없습니다. 새로고침 후 다시 시도해 주세요.'
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      default:
        return '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

export function ConsentDetailPage() {
  return <AuthGuard requireInstallation>{() => <ConsentDetailContent />}</AuthGuard>
}

function ConsentDetailContent() {
  const { caseId } = useParams<{ caseId: string }>()
  const [detail, setDetail] = useState<ConsentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [assentValue, setAssentValue] = useState('')
  const [savingAssent, setSavingAssent] = useState(false)

  const load = useCallback(async () => {
    if (!caseId) return
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchConsentDetail(caseId)
      setDetail(result)
      setAssentValue(result.consent.studentAssent || STUDENT_ASSENT_VALUES[0])
    } catch (error) {
      setLoadError(describeError(error))
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSend() {
    if (!caseId || actionPending) return
    setActionPending(true)
    setActionError('')
    try {
      await sendConsentLink(caseId)
      await load()
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setActionPending(false)
    }
  }

  async function handleConfirm() {
    if (!caseId || actionPending) return
    setActionPending(true)
    setActionError('')
    try {
      await confirmConsent(caseId)
      await load()
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setActionPending(false)
    }
  }

  async function handleSaveAssent() {
    if (!caseId || savingAssent) return
    setSavingAssent(true)
    setActionError('')
    try {
      await saveStudentAssent(caseId, assentValue)
      await load()
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setSavingAssent(false)
    }
  }

  async function handleCopyLink(token: string) {
    const url = `${window.location.origin}/consent/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyMessage('링크를 복사했습니다.')
    } catch {
      setCopyMessage('복사에 실패했습니다.')
    }
    setTimeout(() => setCopyMessage(''), 2000)
  }

  function handleOpenLink(token: string) {
    window.open(`${window.location.origin}/consent/${token}`, '_blank')
  }

  if (!caseId) {
    return <p className="py-16 text-center text-sm text-gray-500">잘못된 접근입니다.</p>
  }

  const consent = detail?.consent
  const canSend = consent?.status === CONSENT_STATUS_NOT_SENT
  const canConfirm = consent?.status === CONSENT_STATUS_NEEDS_REVIEW
  const linkUrl = consent?.consentToken ? `${window.location.origin}/consent/${consent.consentToken}` : ''

  return (
    <div className="space-y-6">
      <div>
        <Link to="/consents" className="text-sm text-gray-500 hover:underline">
          ← 보호자동의 관리
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">보호자동의 상세</h1>
      </div>

      <Card className="space-y-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : detail && consent ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {detail.gradeClass} {detail.studentName} 보호자 동의
              </h2>
              {statusBadge(consent.status)}
            </div>

            <div className="space-y-2">
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>상담 주제</span>
                <span className={fieldValueClass}>{detail.topic || '-'}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>현재 단계</span>
                <span className={fieldValueClass}>{detail.caseStatus || '-'}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>보호자 연락처</span>
                <span className={fieldValueClass}>{consent.guardianContact || '-'}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>보호자명</span>
                <span className={fieldValueClass}>{consent.guardianName || '-'}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>학생과의 관계</span>
                <span className={fieldValueClass}>{consent.relationToStudent || '-'}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>제출일</span>
                <span className={fieldValueClass}>{consent.respondedAt || '-'}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>동의서 PDF</span>
                <span className={fieldValueClass}>
                  {consent.consentPdfUrl ? (
                    <a href={consent.consentPdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                      PDF 열기
                    </a>
                  ) : (
                    '미생성'
                  )}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-gray-200 p-3 text-sm">
              <p className="font-semibold text-gray-900">보호자 제출 항목</p>
              <p className="mt-1 text-gray-600">
                상담 참여: {consent.counselingConsent || '미확인'} · 개인정보: {consent.personalInfoConsent || '미확인'} · 민감정보:{' '}
                {consent.sensitiveInfoConsent || '미확인'} · 진단결과 활용: {consent.diagnosisUseConsent || '미확인'} · AI 보조 안내:{' '}
                {consent.aiNoticeConfirmed || '미확인'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500">보호자동의 링크</label>
              <div className="mt-1 flex flex-wrap gap-2">
                <input type="text" readOnly value={linkUrl} className={`${inputClass} mt-0 flex-1 bg-gray-50`} />
                <button
                  type="button"
                  disabled={!linkUrl}
                  onClick={() => void handleCopyLink(consent.consentToken)}
                  className={secondaryButtonClass}
                >
                  링크 복사
                </button>
                <button type="button" disabled={!linkUrl} onClick={() => handleOpenLink(consent.consentToken)} className={secondaryButtonClass}>
                  열기
                </button>
              </div>
              {copyMessage && <p className="mt-1 text-xs text-gray-500">{copyMessage}</p>}
            </div>

            <div>
              <label htmlFor="assent" className="block text-xs font-medium text-gray-500">
                학생 참여 의사
              </label>
              <div className="mt-1 flex gap-2">
                <select id="assent" value={assentValue} onChange={(event) => setAssentValue(event.target.value)} className={`${inputClass} mt-0`}>
                  {STUDENT_ASSENT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button type="button" disabled={savingAssent} onClick={() => void handleSaveAssent()} className={secondaryButtonClass}>
                  {savingAssent ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>

            {actionError && <p className="text-sm text-red-600">{actionError}</p>}

            {consent.status !== CONSENT_STATUS_CONFIRMED && consent.status !== CONSENT_STATUS_DECLINED && (
              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                {canSend && (
                  <button type="button" disabled={actionPending} onClick={() => void handleSend()} className={primaryButtonClass}>
                    동의 링크 생성·발송
                  </button>
                )}
                {canConfirm && (
                  <button type="button" disabled={actionPending} onClick={() => void handleConfirm()} className={primaryButtonClass}>
                    동의 완료 처리
                  </button>
                )}
              </div>
            )}
          </>
        ) : null}
      </Card>
    </div>
  )
}
