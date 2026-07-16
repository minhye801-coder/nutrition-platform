import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { approveIntake, fetchIntake, IntakeApiError, rejectIntake, reviewIntake } from '@/services/intakeService'
import {
  INTAKE_STATUS_APPROVED,
  INTAKE_STATUS_NEW,
  INTAKE_STATUS_REJECTED,
  INTAKE_STATUS_REVIEWING,
} from '@/types/intake'
import type { Intake } from '@/types/intake'

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

function describeIntakeActionError(error: unknown): string {
  if (error instanceof IntakeApiError) {
    switch (error.code) {
      case 'invalid_transition':
        return '이미 처리된 접수입니다. 목록을 새로고침해 주세요.'
      case 'not_found':
        return '해당 접수를 찾을 수 없습니다.'
      case 'drive_access_required':
        return 'Google Drive 접근 권한이 만료되었거나 부족합니다. 다시 로그인해 주세요.'
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      default:
        return '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

const fieldRowClass = 'flex flex-col gap-1 sm:flex-row sm:gap-3'
const fieldLabelClass = 'w-32 shrink-0 text-xs font-medium text-gray-500'
const fieldValueClass = 'text-sm text-gray-900'

export function IntakeDetailPage() {
  return <AuthGuard requireInstallation>{() => <IntakeDetailContent />}</AuthGuard>
}

function IntakeDetailContent() {
  const { intakeId } = useParams<{ intakeId: string }>()
  const [intake, setIntake] = useState<Intake | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const [justApproved, setJustApproved] = useState(false)

  const load = useCallback(async () => {
    if (!intakeId) return
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchIntake(intakeId)
      setIntake(result)
    } catch (error) {
      setLoadError(describeIntakeActionError(error))
    } finally {
      setLoading(false)
    }
  }, [intakeId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(action: (id: string) => Promise<Intake>, isApprove = false) {
    if (!intakeId || actionPending) return
    setActionPending(true)
    setActionError('')
    try {
      const updated = await action(intakeId)
      setIntake(updated)
      if (isApprove) setJustApproved(true)
    } catch (error) {
      setActionError(describeIntakeActionError(error))
    } finally {
      setActionPending(false)
    }
  }

  if (!intakeId) {
    return <p className="py-16 text-center text-sm text-gray-500">잘못된 접근입니다.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/intakes" className="text-sm text-gray-500 hover:underline">
            ← 상담접수 목록
          </Link>
          <h1 className="mt-1 text-xl font-bold text-gray-900">상담접수 상세</h1>
        </div>
      </div>

      <Card className="space-y-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : intake ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{intake.name} 학생</h2>
              {statusBadge(intake.status)}
            </div>

            <div className="space-y-2">
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>학년도/학년/반/번호</span>
                <span className={fieldValueClass}>
                  {intake.schoolYear} / {intake.grade}학년 {intake.class}반 {intake.studentNumber || '-'}번
                </span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>신청자</span>
                <span className={fieldValueClass}>
                  {intake.applicantName} ({intake.applicantType}, {intake.relationToStudent})
                </span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>연락처</span>
                <span className={fieldValueClass}>{intake.contactInfo}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>상담주제</span>
                <span className={fieldValueClass}>{intake.topic}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>신청 이유</span>
                <span className={`${fieldValueClass} whitespace-pre-wrap`}>{intake.content}</span>
              </div>
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>희망 시간 / 긴급도</span>
                <span className={fieldValueClass}>
                  {intake.preferredTime || '-'} / {intake.urgency || '-'}
                </span>
              </div>
              {intake.note && (
                <div className={fieldRowClass}>
                  <span className={fieldLabelClass}>기타 전달사항</span>
                  <span className={`${fieldValueClass} whitespace-pre-wrap`}>{intake.note}</span>
                </div>
              )}
              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>접수일</span>
                <span className={fieldValueClass}>{intake.submittedAt}</span>
              </div>
            </div>

            {actionError && <p className="text-sm text-red-600">{actionError}</p>}

            {justApproved && intake.status === INTAKE_STATUS_APPROVED && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
                <span>승인되었습니다. 이제 보호자동의 링크를 발송할 수 있습니다.</span>
                <Link to="/consents" className={primaryButtonClass}>
                  보호자동의 관리로 이동
                </Link>
              </div>
            )}

            {(intake.status === INTAKE_STATUS_NEW || intake.status === INTAKE_STATUS_REVIEWING) && (
              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                {intake.status === INTAKE_STATUS_NEW && (
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => void runAction(reviewIntake)}
                    className={secondaryButtonClass}
                  >
                    검토 시작
                  </button>
                )}
                <button
                  type="button"
                  disabled={actionPending}
                  onClick={() => void runAction(approveIntake, true)}
                  className={primaryButtonClass}
                >
                  승인
                </button>
                <button
                  type="button"
                  disabled={actionPending}
                  onClick={() => void runAction(rejectIntake)}
                  className={secondaryButtonClass}
                >
                  반려
                </button>
              </div>
            )}
          </>
        ) : null}
      </Card>
    </div>
  )
}
