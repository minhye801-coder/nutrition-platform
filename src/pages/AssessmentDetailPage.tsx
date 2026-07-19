import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { PdfDeidentifyPanel, type ReviewFlag } from '@/components/assessment/PdfDeidentifyPanel'
import {
  AssessmentApiError,
  createAssessment,
  extractAssessment,
  fetchAssessment,
  reviewAssessment,
} from '@/services/assessmentService'
import {
  ASSESSMENT_FIELD_GROUPS,
  ASSESSMENT_STATUS_CONFIRMED,
  EXTRACTION_STATUS_AI,
  OFFICIAL_RESULT_FIELD_GROUPS,
  RESPONSE_DETAIL_FIELD_GROUPS,
  REVIEW_FLAG_LABELS,
} from '@/types/assessment'
import type {
  AssessmentExtractedFieldKey,
  AssessmentExtractedFields,
  AssessmentListItem,
  ReviewFlagCode,
} from '@/types/assessment'

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

function describeError(error: unknown): string {
  if (error instanceof AssessmentApiError) {
    switch (error.code) {
      case 'not_found':
        return '검사결과를 찾을 수 없습니다.'
      case 'gemini_key_not_set':
        return 'Gemini API Key가 설정돼 있지 않습니다. 설정 화면에서 먼저 등록하거나, 아래 항목을 직접 입력해 주세요.'
      case 'gemini_extraction_failed':
        return 'AI 자동확인에 실패했습니다. 아래 항목을 직접 입력해 저장할 수 있습니다.'
      case 'invalid_transition':
        return '이미 처리된 항목이거나 처리할 수 없는 상태입니다.'
      case 'raw_pdf_upload_not_supported':
        return '원본 PDF는 서버로 전송할 수 없습니다. 비식별화 확인을 마친 텍스트만 분석에 사용할 수 있습니다.'
      default:
        return '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

function extractFields(detail: AssessmentListItem): AssessmentExtractedFields {
  const fields = {} as AssessmentExtractedFields
  for (const group of ASSESSMENT_FIELD_GROUPS) {
    for (const { key } of group.fields) {
      fields[key] = detail.assessment[key]
    }
  }
  return fields
}

/** "5학년 2반 15번" 형식 — AssessmentsPage.formatGradeClassNumber와 동일한 규칙. */
function formatGradeClassNumber(grade: string, studentClass: string, studentNumber: string): string {
  if (!grade && !studentClass && !studentNumber) return ''
  const parts: string[] = []
  if (grade) parts.push(`${grade}학년`)
  if (studentClass) parts.push(`${studentClass}반`)
  if (studentNumber) parts.push(`${studentNumber}번`)
  return parts.join(' ')
}

export function AssessmentDetailPage() {
  return <AuthGuard requireInstallation>{() => <AssessmentDetailContent />}</AuthGuard>
}

/** AuthGuard 없이 직접 테스트할 수 있도록 내부 컴포넌트를 노출한다(테스트 전용 export). */
export function AssessmentDetailContent() {
  const navigate = useNavigate()
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const [detail, setDetail] = useState<AssessmentListItem | null>(null)
  const [fields, setFields] = useState<AssessmentExtractedFields | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [extracting, setExtracting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  /** PDF 비식별화 단계에서만 판단할 수 있는 확인 필요 상태(요구사항 2·6절) — 리다크션
   * 이후에는 원문이 없어 서버가 다시 계산할 수 없으므로, 분석을 실행한 이 세션 동안은
   * 사람이 읽을 문구까지 함께 보여준다. 서버에는 code만 저장된다(reviewFlagCodes). */
  const [sessionFlags, setSessionFlags] = useState<ReviewFlag[]>([])
  const [startingFollowUp, setStartingFollowUp] = useState(false)

  const load = useCallback(async () => {
    if (!assessmentId) return
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchAssessment(assessmentId)
      setDetail(result)
      setFields(extractFields(result))
      setReviewNote(result.assessment.reviewNote)
      setSessionFlags([])
    } catch (error) {
      setLoadError(describeError(error))
    } finally {
      setLoading(false)
    }
  }, [assessmentId])

  useEffect(() => {
    void load()
  }, [load])

  function updateField(key: AssessmentExtractedFieldKey, value: string) {
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  /** 서버에 이미 저장된 코드(다시 열었을 때도 보이는 것) — 이번 세션의 라이브 문구가 없으면 라벨만 보여준다. */
  const persistedFlagCodes = detail?.assessment.reviewFlags
    ? (detail.assessment.reviewFlags.split('\n').filter(Boolean) as ReviewFlagCode[])
    : []
  const sessionFlagCodes = sessionFlags.map((f) => f.code)
  const allFlagCodes = Array.from(new Set([...sessionFlagCodes, ...persistedFlagCodes]))

  async function handleExtract(
    diagnosisText: string,
    caseRequestId: string,
    responseText: string | undefined,
    flags: ReviewFlag[],
  ) {
    if (!assessmentId || extracting) return
    setExtracting(true)
    setActionError('')
    setSessionFlags(flags)
    try {
      const assessment = await extractAssessment(
        assessmentId,
        diagnosisText,
        caseRequestId,
        responseText,
        flags.map((f) => f.code),
      )
      setDetail((prev) => (prev ? { ...prev, assessment } : prev))
      setFields(extractFields({ ...(detail as AssessmentListItem), assessment }))
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave() {
    if (!assessmentId || !fields || !detail || saving) return
    setSaving(true)
    setActionError('')
    setSavedMessage('')
    // AI를 아예 쓰지 않고 직접 입력만 한 채로 저장하면, 다시 열었을 때도 "AI가 확인하지
    // 않은 값"이라는 걸 알 수 있도록 MANUAL_REVIEW_REQUIRED를 함께 남긴다(요구사항 2절).
    const codes = new Set(allFlagCodes)
    if (detail.assessment.extractionStatus !== EXTRACTION_STATUS_AI) codes.add('MANUAL_REVIEW_REQUIRED')
    try {
      const result = await reviewAssessment(assessmentId, {
        ...fields,
        reviewNote,
        confirm: true,
        reviewFlagCodes: Array.from(codes),
      })
      setDetail((prev) => (prev ? { ...prev, assessment: result.assessment } : prev))
      setFields(extractFields({ ...(detail as AssessmentListItem), assessment: result.assessment }))
      setReviewNote(result.assessment.reviewNote)
      setSavedMessage('검토 완료로 저장되었습니다.')
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setSaving(false)
    }
  }

  /**
   * 사후 진단은 교사가 명시적으로 시작해야 한다(요구사항 3절) — 사전이 확인 완료된
   * 뒤에만 이 버튼이 보인다. 서버가 caseId+timepoint로 idempotent하게 처리하므로
   * 이미 사후 기록이 있으면 새로 만들지 않고 그 기록을 그대로 연다.
   */
  async function handleStartFollowUp() {
    if (!detail || startingFollowUp) return
    setStartingFollowUp(true)
    setActionError('')
    try {
      const followUp = await createAssessment(detail.assessment.caseId, '2차', '사후')
      navigate(`/assessments/${followUp.assessmentId}`)
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setStartingFollowUp(false)
    }
  }

  if (!assessmentId) {
    return <p className="py-16 text-center text-sm text-gray-500">잘못된 접근입니다.</p>
  }

  const assessment = detail?.assessment
  const serverWarnings = assessment?.warnings ? assessment.warnings.split('\n').filter(Boolean) : []
  const responseHighlights = assessment?.responseHighlights
    ? assessment.responseHighlights.split('\n').filter(Boolean)
    : []
  const isConfirmed = assessment?.status === ASSESSMENT_STATUS_CONFIRMED
  const gradeClass = detail ? formatGradeClassNumber(detail.grade, detail.studentClass, detail.studentNumber) : ''

  // "누락 또는 판독 실패 항목" — AI가 실제로 돌았는데 비어 있는 필드만 의미가 있다
  // (수동 입력 상태에서 빈 칸은 "누락"이 아니라 아직 안 채운 것일 뿐이다).
  const missingFieldLabels =
    fields && assessment?.extractionStatus === EXTRACTION_STATUS_AI
      ? ASSESSMENT_FIELD_GROUPS.flatMap((group) => group.fields)
          .filter(({ key }) => !fields[key])
          .map(({ label }) => label)
      : []

  return (
    <div className="space-y-6">
      <div>
        <Link to="/assessments" className="text-sm text-gray-500 hover:underline">
          ← 진단·검사 목록
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">검사결과 검토</h1>
      </div>

      {loading ? (
        <Card>
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        </Card>
      ) : loadError ? (
        <Card>
          <p className="text-sm text-red-600">{loadError}</p>
        </Card>
      ) : detail && assessment && fields ? (
        <>
          {/* ① 선택 학생 및 평가시점 */}
          <Card className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">학생 및 검사정보</h2>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-lg font-bold text-gray-900">{detail.studentName || '이름 미상'}</span>
              <span className="text-sm text-gray-500">{gradeClass || '학급 정보 없음'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isConfirmed ? 'success' : 'warning'}>{assessment.status}</Badge>
              <Badge tone="neutral">{assessment.extractionStatus === EXTRACTION_STATUS_AI ? 'AI 추출' : '수동 입력'}</Badge>
              <Badge tone="neutral">{assessment.timepoint}</Badge>
              <span className="text-xs text-gray-500">
                {assessment.round} · 등록일 {assessment.uploadedAt.slice(0, 10)}
              </span>
            </div>
            {assessment.fileUrl && (
              <a
                href={assessment.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                원본 PDF 열기(마이그레이션 이전 레코드)
              </a>
            )}
            {isConfirmed && assessment.timepoint === '사전' && (
              <button
                type="button"
                onClick={() => void handleStartFollowUp()}
                disabled={startingFollowUp}
                className={secondaryButtonClass}
              >
                {startingFollowUp ? '여는 중...' : '사후 진단 등록'}
              </button>
            )}
          </Card>

          {actionError && <p className="text-sm text-red-600">{actionError}</p>}

          {/* ② PDF 두 종류 처리 상태 */}
          {!isConfirmed && (
            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">진단결과·응답내역 PDF 분석</h2>
              <p className="text-sm text-gray-600">
                원본 PDF는 서버로 전송되거나 Drive에 저장되지 않습니다. 학교 PC에 있는 진단결과 PDF(필수)와
                응답내역 PDF(선택)를 선택하면 브라우저에서만 텍스트를 읽고, 식별정보 후보를 확인한 뒤 정제된
                텍스트만 분석에 사용합니다. Gemini API Key가 없거나 이 단계를 건너뛰어도, 아래 항목을 직접
                입력해 저장할 수 있습니다.
              </p>
              {extracting ? (
                <p className="text-sm text-gray-600">분석 중입니다...</p>
              ) : (
                <PdfDeidentifyPanel
                  studentName={detail.studentName}
                  studentGrade={detail.grade}
                  onConfirm={(diagnosisText, caseRequestId, responseText, flags) =>
                    void handleExtract(diagnosisText, caseRequestId, responseText, flags)
                  }
                  onCancel={() => setSessionFlags([])}
                />
              )}
            </Card>
          )}

          {/* ③ 공식 진단결과 */}
          <Card className="space-y-5">
            <h2 className="text-sm font-semibold text-gray-900">공식 진단결과</h2>
            {OFFICIAL_RESULT_FIELD_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {group.fields.map(({ key, label }) => (
                    <div key={key}>
                      <label htmlFor={key} className="block text-xs font-medium text-gray-500">
                        {label}
                      </label>
                      <input
                        id={key}
                        type="text"
                        value={fields[key]}
                        onChange={(event) => updateField(key, event.target.value)}
                        disabled={isConfirmed}
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          {/* ④ 응답내역 */}
          <Card className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">응답내역</h2>
              <p className="text-xs text-gray-500">
                PDF에 실제로 표시된 값만 옮깁니다 — 존재하지 않는 내용은 AI가 추론해서 채우지 않습니다.
              </p>
            </div>
            {RESPONSE_DETAIL_FIELD_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-gray-900">{group.title}</h3>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {group.fields.map(({ key, label }) => (
                    <div key={key}>
                      <label htmlFor={key} className="block text-xs font-medium text-gray-500">
                        {label}
                      </label>
                      <input
                        id={key}
                        type="text"
                        value={fields[key]}
                        onChange={(event) => updateField(key, event.target.value)}
                        disabled={isConfirmed}
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h3 className="text-sm font-semibold text-gray-900">확인이 필요한 응답</h3>
              <p className="mt-1 text-xs text-gray-500">
                상담에 참고할 만한 세부 응답과 확인이 필요한 응답을 AI가 정리한 목록입니다. 응답내역 PDF를
                선택하지 않았거나 분석 전이면 비어 있을 수 있습니다.
              </p>
              {responseHighlights.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-800">
                  {responseHighlights.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gray-400">등록된 응답내역이 없습니다.</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">누락 또는 판독 실패 항목</h3>
              {missingFieldLabels.length > 0 ? (
                <p className="mt-1 text-sm text-amber-700">
                  AI가 값을 찾지 못한 항목: {missingFieldLabels.join(', ')}
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-400">
                  {assessment.extractionStatus === EXTRACTION_STATUS_AI
                    ? '누락된 항목이 없습니다.'
                    : 'AI 분석을 실행하면 여기에 누락 항목이 표시됩니다.'}
                </p>
              )}
            </div>
          </Card>

          {/* ⑤ 확인 경고 */}
          {(allFlagCodes.length > 0 || serverWarnings.length > 0) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">확인이 필요한 항목</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {allFlagCodes.map((code) => {
                  const live = sessionFlags.find((f) => f.code === code)
                  return <li key={code}>{live ? live.message : REVIEW_FLAG_LABELS[code]}</li>
                })}
                {serverWarnings.map((warning, index) => (
                  <li key={`w-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ⑥ 교사 수정·확인 / ⑦ 검토 완료 및 저장 */}
          <Card className="space-y-4">
            <div>
              <label htmlFor="reviewNote" className="block text-xs font-medium text-gray-500">
                교사 메모
              </label>
              <textarea
                id="reviewNote"
                rows={3}
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                disabled={isConfirmed}
                className={inputClass}
              />
            </div>

            {savedMessage && <p className="text-sm text-gray-500">{savedMessage}</p>}

            {!isConfirmed && (
              <button type="button" onClick={() => void handleSave()} disabled={saving} className={`${primaryButtonClass} w-full`}>
                {saving ? '저장 중...' : '검토 완료 및 저장'}
              </button>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
