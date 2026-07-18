import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthGuard } from '@/components/common/AuthGuard'
import { Card } from '@/components/common/Card'
import { Badge } from '@/components/common/Badge'
import { primaryButtonClass, secondaryButtonClass } from '@/components/common/buttonStyles'
import { PdfDeidentifyPanel } from '@/components/assessment/PdfDeidentifyPanel'
import {
  AssessmentApiError,
  extractAssessment,
  fetchAssessment,
  reviewAssessment,
} from '@/services/assessmentService'
import {
  ASSESSMENT_FIELD_GROUPS,
  ASSESSMENT_STATUS_CONFIRMED,
  EXTRACTION_STATUS_AI,
} from '@/types/assessment'
import type { Assessment, AssessmentExtractedFieldKey, AssessmentExtractedFields } from '@/types/assessment'

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
        return 'AI 자동확인에 실패했습니다. 업로드한 PDF는 그대로 남아 있으니 직접 입력으로 진행할 수 있습니다.'
      case 'invalid_transition':
        return '이미 처리된 항목이거나 처리할 수 없는 상태입니다.'
      default:
        return '처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'
    }
  }
  return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

function extractFields(assessment: Assessment): AssessmentExtractedFields {
  const fields = {} as AssessmentExtractedFields
  for (const group of ASSESSMENT_FIELD_GROUPS) {
    for (const { key } of group.fields) {
      fields[key] = assessment[key]
    }
  }
  return fields
}

export function AssessmentDetailPage() {
  return <AuthGuard requireInstallation>{() => <AssessmentDetailContent />}</AuthGuard>
}

function AssessmentDetailContent() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [fields, setFields] = useState<AssessmentExtractedFields | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [showAiNotice, setShowAiNotice] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')

  const load = useCallback(async () => {
    if (!assessmentId) return
    setLoading(true)
    setLoadError('')
    try {
      const result = await fetchAssessment(assessmentId)
      setAssessment(result)
      setFields(extractFields(result))
      setReviewNote(result.reviewNote)
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

  async function handleExtract(deidentifiedText: string, caseRequestId: string) {
    if (!assessmentId || extracting) return
    setExtracting(true)
    setActionError('')
    try {
      const result = await extractAssessment(assessmentId, deidentifiedText, caseRequestId)
      setAssessment(result)
      setFields(extractFields(result))
      setShowAiNotice(false)
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setExtracting(false)
    }
  }

  async function handleSave(confirm: boolean) {
    if (!assessmentId || !fields || saving) return
    setSaving(true)
    setActionError('')
    setSavedMessage('')
    try {
      const result = await reviewAssessment(assessmentId, { ...fields, reviewNote, confirm })
      setAssessment(result.assessment)
      setFields(extractFields(result.assessment))
      setReviewNote(result.assessment.reviewNote)
      setSavedMessage(confirm ? '확인 완료로 저장되었습니다.' : '임시 저장되었습니다.')
    } catch (error) {
      setActionError(describeError(error))
    } finally {
      setSaving(false)
    }
  }

  if (!assessmentId) {
    return <p className="py-16 text-center text-sm text-gray-500">잘못된 접근입니다.</p>
  }

  const warningList = assessment?.warnings ? assessment.warnings.split('\n').filter(Boolean) : []
  const isConfirmed = assessment?.status === ASSESSMENT_STATUS_CONFIRMED

  return (
    <div className="space-y-6">
      <div>
        <Link to="/assessments" className="text-sm text-gray-500 hover:underline">
          ← 진단·검사 목록
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">검사결과 검토</h1>
      </div>

      <Card className="space-y-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">불러오는 중...</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : assessment && fields ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone={isConfirmed ? 'success' : 'warning'}>{assessment.status}</Badge>
                <Badge tone="neutral">{assessment.extractionStatus === EXTRACTION_STATUS_AI ? 'AI 추출' : '수동 입력'}</Badge>
                <span className="text-sm text-gray-500">
                  {assessment.round} / {assessment.timepoint}
                </span>
              </div>
              <a href={assessment.fileUrl} target="_blank" rel="noopener noreferrer" className={secondaryButtonClass}>
                원본 PDF 열기
              </a>
            </div>

            {warningList.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">확인이 필요한 항목</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {warningList.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              {!showAiNotice ? (
                <button
                  type="button"
                  onClick={() => setShowAiNotice(true)}
                  disabled={extracting}
                  className={secondaryButtonClass}
                >
                  AI로 자동 확인
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-800">
                    저장된 원본 PDF를 그대로 Gemini에 보내지 않습니다. 아래에서 같은(또는 동일 내용의) PDF를 다시
                    선택하면 브라우저에서만 텍스트를 읽고, 식별정보 후보를 확인한 뒤 정제된 텍스트만 분석에 사용합니다.
                  </p>
                  {extracting ? (
                    <p className="text-sm text-gray-600">분석 중입니다...</p>
                  ) : (
                    <PdfDeidentifyPanel
                      studentName=""
                      onConfirm={(text, caseRequestId) => void handleExtract(text, caseRequestId)}
                      onCancel={() => setShowAiNotice(false)}
                    />
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-400">
                Gemini API Key가 없거나 이 단계를 건너뛰어도, 아래 항목을 직접 입력해 저장할 수 있습니다.
              </p>
            </div>

            {actionError && <p className="text-sm text-red-600">{actionError}</p>}

            <div className="space-y-5 border-t border-gray-100 pt-4">
              {ASSESSMENT_FIELD_GROUPS.map((group) => (
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
            </div>

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
              <div className="flex gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => void handleSave(false)}
                  disabled={saving}
                  className={secondaryButtonClass}
                >
                  임시 저장
                </button>
                <button type="button" onClick={() => void handleSave(true)} disabled={saving} className={primaryButtonClass}>
                  확인 완료로 저장
                </button>
              </div>
            )}
          </>
        ) : null}
      </Card>
    </div>
  )
}
