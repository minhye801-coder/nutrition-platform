import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass } from '@/components/common/buttonStyles'
import { fetchConsents, ConsentApiError } from '@/services/consentService'
import { AssessmentApiError, createAssessment, fetchAssessments } from '@/services/assessmentService'
import { ASSESSMENT_STATUS_CONFIRMED, EXTRACTION_STATUS_AI } from '@/types/assessment'
import type { AssessmentListItem } from '@/types/assessment'
import type { ConsentListItem } from '@/types/consent'

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

/** 검사결과를 새로 등록할 수 있는 케이스 단계 — 승인 시 '진단 대기'가 되고, 등록 후 '결과 확인'이 된다(추가 회차 등록 허용). */
const UPLOADABLE_CASE_STATUSES = ['진단 대기', '결과 확인']

function statusBadge(status: string) {
  return status === ASSESSMENT_STATUS_CONFIRMED ? (
    <Badge tone="success">확인 완료</Badge>
  ) : (
    <Badge tone="warning">검토 대기</Badge>
  )
}

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

export function AssessmentsPage() {
  return <AuthGuard requireInstallation>{() => <AssessmentsContent />}</AuthGuard>
}

function AssessmentsContent() {
  const [items, setItems] = useState<AssessmentListItem[]>([])
  const [targets, setTargets] = useState<ConsentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [caseId, setCaseId] = useState('')
  const [round, setRound] = useState('1차')
  const [timepoint, setTimepoint] = useState('사전')
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [assessments, consents] = await Promise.all([fetchAssessments(), fetchConsents()])
      setItems(assessments)
      setTargets(consents.filter((item) => UPLOADABLE_CASE_STATUSES.includes(item.caseStatus)))
    } catch (error) {
      setLoadError(describeError(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const registerableTargets = useMemo(
    () => targets.filter((item) => item.consent.status === '동의 완료'),
    [targets],
  )

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (registering || !caseId || !round.trim() || !timepoint) return

    setRegistering(true)
    setRegisterError('')
    try {
      await createAssessment(caseId, round.trim(), timepoint)
      setCaseId('')
      await load()
    } catch (error) {
      setRegisterError(describeError(error))
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">진단·검사</h1>
        <p className="mt-1 text-sm text-gray-500">
          검사결과 PDF는 학교 PC에서만 열어봅니다. 이 화면에서는 검사결과 항목만 등록하고, 실제 PDF 읽기·비식별화
          확인·AI 분석은 검토 화면에서 브라우저 안에서만 진행합니다.
        </p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">진단검사 대상 학생</h2>
        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {loading ? (
          <p className="py-4 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : targets.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">보호자동의가 진행 중인 케이스가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {targets.map((item) => (
              <div key={item.consent.caseId} className="rounded-md border border-gray-200 p-3">
                <p className="font-semibold text-gray-900">{item.studentName || '이름 미상'}</p>
                <p className="text-xs text-gray-500">
                  {formatGradeClassNumber(item.grade, item.studentClass, item.studentNumber) || '학급 정보 없음'}
                </p>
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
                    <dd>{describeAssessmentStatus(item.consent.caseId, items)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">검사결과 등록</h2>
        <p className="text-xs text-gray-500">
          여기서는 검사차수·평가시점만 등록합니다. 원본 PDF 선택과 비식별화 확인은 등록 후 검토 화면에서 진행해
          주세요.
        </p>
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={(event) => void handleRegister(event)}>
          <div className="sm:col-span-2">
            <label htmlFor="caseId" className="block text-xs font-medium text-gray-500">
              대상 케이스 *
            </label>
            <select id="caseId" value={caseId} onChange={(event) => setCaseId(event.target.value)} className={inputClass}>
              <option value="">선택하세요</option>
              {registerableTargets.map((item) => (
                <option key={item.consent.caseId} value={item.consent.caseId}>
                  {item.studentName || '이름 미상'}
                  {formatGradeClassNumber(item.grade, item.studentClass, item.studentNumber)
                    ? ` (${formatGradeClassNumber(item.grade, item.studentClass, item.studentNumber)})`
                    : ''}{' '}
                  · {item.caseTopic || '주제 없음'} ({item.caseStatus})
                </option>
              ))}
            </select>
            {!loading && registerableTargets.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">보호자동의가 완료된 케이스가 없습니다.</p>
            )}
          </div>
          <div>
            <label htmlFor="round" className="block text-xs font-medium text-gray-500">
              검사차수 *
            </label>
            <input id="round" type="text" value={round} onChange={(event) => setRound(event.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="timepoint" className="block text-xs font-medium text-gray-500">
              평가시점 *
            </label>
            <select id="timepoint" value={timepoint} onChange={(event) => setTimepoint(event.target.value)} className={inputClass}>
              <option value="사전">사전</option>
              <option value="사후">사후</option>
            </select>
          </div>
          {registerError && <p className="text-sm text-red-600 sm:col-span-4">{registerError}</p>}
          <div className="sm:col-span-4">
            <button type="submit" disabled={registering} className={primaryButtonClass}>
              {registering ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">등록된 검사결과가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="py-2 pr-2">학생명</th>
                  <th className="py-2 pr-2">학년·반·번호</th>
                  <th className="py-2 pr-2">검사차수/시점</th>
                  <th className="py-2 pr-2">추출방식</th>
                  <th className="py-2 pr-2">상태</th>
                  <th className="py-2 pr-2">등록일</th>
                  <th className="py-2 pr-2" />
                </tr>
              </thead>
              <tbody>
                {items.map(({ assessment, studentName, grade, studentClass, studentNumber }) => (
                  <tr key={assessment.assessmentId} className="border-b border-gray-100">
                    <td className="py-2 pr-2 text-gray-900">{studentName || '-'}</td>
                    <td className="py-2 pr-2 text-gray-700">
                      {formatGradeClassNumber(grade, studentClass, studentNumber) || '-'}
                    </td>
                    <td className="py-2 pr-2 text-gray-700">
                      {assessment.round} / {assessment.timepoint}
                    </td>
                    <td className="py-2 pr-2 text-gray-700">
                      {assessment.extractionStatus === EXTRACTION_STATUS_AI ? 'AI 추출' : '수동 입력'}
                    </td>
                    <td className="py-2 pr-2">{statusBadge(assessment.status)}</td>
                    <td className="py-2 pr-2 text-gray-500">{assessment.uploadedAt.slice(0, 10)}</td>
                    <td className="py-2 pr-2 text-right">
                      <Link
                        to={`/assessments/${assessment.assessmentId}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        검토
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
