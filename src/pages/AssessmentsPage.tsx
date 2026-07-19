import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass } from '@/components/common/buttonStyles'
import { fetchConsents, ConsentApiError } from '@/services/consentService'
import { AssessmentApiError, createAssessment, fetchAssessments } from '@/services/assessmentService'
import { ASSESSMENT_STATUS_CONFIRMED, EXTRACTION_STATUS_AI } from '@/types/assessment'
import type { AssessmentListItem } from '@/types/assessment'
import type { ConsentListItem } from '@/types/consent'

/**
 * 진단대상 조건(요구사항 2절): 상담접수 완료 + 보호자동의 완료 + 진단 대기/결과 확인
 * 단계인 케이스만 진단대상이다. consents 목록은 이미 StudentID+caseId로 조인돼 있다
 * (functions/api/consents/index.ts) — 이름으로 다시 합치지 않는다.
 */
const DIAGNOSIS_TARGET_CASE_STATUSES = ['진단 대기', '결과 확인']

function describeError(error: unknown): string {
  if (error instanceof AssessmentApiError || error instanceof ConsentApiError) {
    switch (error.code) {
      case 'not_found':
        return '해당 케이스를 찾을 수 없습니다.'
      case 'raw_pdf_upload_not_supported':
        return '원본 PDF는 서버로 전송할 수 없습니다. 검사결과 검토 화면에서 브라우저 내 비식별화 확인을 거쳐 진행해 주세요.'
      case 'invalid_input':
        return '입력값을 확인해 주세요.'
      case 'sheets_unavailable':
        return 'Google Sheets에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
      default:
        return '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

/** 학년·반·번호를 "5학년 2반 15번" 형식으로 합친다. 값이 비어 있으면 빈 문자열. */
export function formatGradeClassNumber(grade: string, studentClass: string, studentNumber: string): string {
  if (!grade && !studentClass && !studentNumber) return ''
  const parts: string[] = []
  if (grade) parts.push(`${grade}학년`)
  if (studentClass) parts.push(`${studentClass}반`)
  if (studentNumber) parts.push(`${studentNumber}번`)
  return parts.join(' ')
}

function formatDate(value: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** 케이스별 진단검사 진행 상태 요약 — StudentID/caseId로만 조인하고 이름으로는 합치지 않는다. */
export function describeAssessmentStatus(caseId: string, assessments: AssessmentListItem[]): string {
  const related = assessments.filter((item) => item.assessment.caseId === caseId)
  if (related.length === 0) return '미실시'
  const latest = [...related].sort((a, b) => b.assessment.updatedAt.localeCompare(a.assessment.updatedAt))[0]
  if (latest.assessment.status === ASSESSMENT_STATUS_CONFIRMED) return '확인 완료'
  if (latest.assessment.extractionStatus === EXTRACTION_STATUS_AI) return 'AI 분석 완료(검토 대기)'
  return '분석 대기'
}

/**
 * 이 케이스의 "현재 평가시점" — 사전 기록이 아직 없으면 다음 등록은 사전이 기본이고
 * (요구사항 3절), 있으면 그 시점을 그대로 보여준다.
 */
function currentTimepoint(caseId: string, assessments: AssessmentListItem[]): string {
  const related = assessments.filter((item) => item.assessment.caseId === caseId)
  if (related.length === 0) return '사전'
  const latest = [...related].sort((a, b) => b.assessment.updatedAt.localeCompare(a.assessment.updatedAt))[0]
  return latest.assessment.timepoint || '사전'
}

export function AssessmentsPage() {
  return <AuthGuard requireInstallation>{() => <AssessmentsContent />}</AuthGuard>
}

/** AuthGuard 없이 직접 테스트할 수 있도록 내부 컴포넌트를 노출한다(테스트 전용 export). */
export function AssessmentsContent() {
  const navigate = useNavigate()
  const [items, setItems] = useState<AssessmentListItem[]>([])
  const [targets, setTargets] = useState<ConsentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [openingCaseId, setOpeningCaseId] = useState('')
  const [openError, setOpenError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [assessments, consents] = await Promise.all([fetchAssessments(), fetchConsents()])
      setItems(assessments)
      setTargets(
        consents.filter(
          (item) => item.consent.status === '동의 완료' && DIAGNOSIS_TARGET_CASE_STATUSES.includes(item.caseStatus),
        ),
      )
    } catch (error) {
      setLoadError(describeError(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const assessmentByCaseAndTimepoint = useMemo(() => {
    const map = new Map<string, AssessmentListItem>()
    for (const item of items) {
      map.set(`${item.assessment.caseId}:${item.assessment.timepoint}`, item)
    }
    return map
  }, [items])

  /**
   * 학생 카드의 유일한 버튼. 사전 기록이 이미 있으면 그 기록을 그대로 열고(요구사항
   * 3절 "사전 진단이 존재하면 기존 사전 자료를 표시"), 없으면 사전으로 새로 만든다.
   * caseId+timepoint 유일성은 서버(ensureAssessment)가 보장하므로 버튼을 연타해도
   * 같은 기록이 반환된다 — 여기서는 진행 중에 같은 카드를 다시 누르지 못하게만 막는다
   * (요구사항 8·9절).
   */
  async function handleOpenDiagnosis(caseId: string) {
    if (openingCaseId) return
    setOpeningCaseId(caseId)
    setOpenError('')
    try {
      const existingPre = assessmentByCaseAndTimepoint.get(`${caseId}:사전`)
      if (existingPre) {
        navigate(`/assessments/${existingPre.assessment.assessmentId}`)
        return
      }
      const assessment = await createAssessment(caseId, '1차', '사전')
      navigate(`/assessments/${assessment.assessmentId}`)
    } catch (error) {
      setOpenError(describeError(error))
    } finally {
      setOpeningCaseId('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">진단·검사</h1>
        <p className="mt-1 text-sm text-gray-500">
          검사결과 PDF는 학교 PC에서만 열어봅니다. 학생을 선택하면 검토 화면에서 진단결과·응답내역 PDF 읽기,
          비식별화 확인, AI 분석을 모두 브라우저 안에서 진행합니다.
        </p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">진단대상 학생</h2>
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {openError && <p className="text-sm text-red-600">{openError}</p>}
        {loading ? (
          <p className="py-4 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : targets.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">
            보호자동의가 완료되고 진단을 기다리는 학생이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((item) => {
              const caseId = item.consent.caseId
              const opening = openingCaseId === caseId
              return (
                <div key={caseId} className="flex flex-col justify-between rounded-md border border-gray-200 p-3">
                  <div>
                    <p className="text-base font-bold text-gray-900">{item.studentName || '이름 미상'}</p>
                    <p className="text-xs text-gray-500">
                      {formatGradeClassNumber(item.grade, item.studentClass, item.studentNumber) || '학급 정보 없음'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge tone="neutral">{item.caseStatus}</Badge>
                      <Badge tone="neutral">{currentTimepoint(caseId, items)}</Badge>
                    </div>
                    <dl className="mt-2 space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between gap-2">
                        <dt>상담접수</dt>
                        <dd>{formatDate(item.caseOpenedAt)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>보호자동의</dt>
                        <dd>{item.consent.status}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>진단검사</dt>
                        <dd>{describeAssessmentStatus(caseId, items)}</dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleOpenDiagnosis(caseId)}
                    disabled={opening}
                    className={`${primaryButtonClass} mt-3 w-full`}
                  >
                    {opening ? '여는 중...' : '진단자료 확인'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
