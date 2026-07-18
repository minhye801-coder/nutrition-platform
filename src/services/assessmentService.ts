import type { Assessment, AssessmentExtractedFields, AssessmentListItem } from '@/types/assessment'
import { isDemoMode } from '@/lib/accountModeCache'
import { demoAssessmentStore } from '@/data/demoStore'

/** 서버가 내려준 오류 코드를 그대로 담아 던진다(consentService.ts의 ConsentApiError와 동일한 원칙). */
export class AssessmentApiError extends Error {
  code: string
  status: number
  constructor(code: string, status: number) {
    super(code)
    this.code = code
    this.status = status
  }
}

async function parseJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function throwAssessmentApiError(response: Response): Promise<never> {
  const data = await parseJsonSafe(response)
  const code = typeof data?.error === 'string' ? data.error : 'unknown_error'
  throw new AssessmentApiError(code, response.status)
}

export async function fetchAssessments(): Promise<AssessmentListItem[]> {
  if (isDemoMode()) return demoAssessmentStore.list()

  const response = await fetch('/api/assessments', { credentials: 'include' })
  if (!response.ok) {
    return throwAssessmentApiError(response)
  }
  const data = (await response.json()) as { assessments?: AssessmentListItem[] }
  return data.assessments ?? []
}

export async function fetchAssessment(assessmentId: string): Promise<Assessment> {
  if (isDemoMode()) return demoAssessmentStore.detail(assessmentId)

  const response = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, { credentials: 'include' })
  if (!response.ok) {
    return throwAssessmentApiError(response)
  }
  const data = (await response.json()) as { assessment: Assessment }
  return data.assessment
}

/**
 * 검사결과 레코드 등록. 원본 PDF 바이트는 절대 서버로 보내지 않는다(개인정보 보호
 * 구조 확정 사항) — 여기서는 round/timepoint만 전달해 빈 레코드를 만들고, 실제 PDF는
 * AssessmentDetailPage에서 PdfDeidentifyPanel(브라우저 내부 처리)로만 다룬다.
 */
export async function createAssessment(caseId: string, round: string, timepoint: string): Promise<Assessment> {
  if (isDemoMode()) return demoAssessmentStore.uploadSample(caseId, round, timepoint)

  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/assessments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round, timepoint }),
  })
  if (!response.ok) {
    return throwAssessmentApiError(response)
  }
  const data = (await response.json()) as { assessment: Assessment }
  return data.assessment
}

/**
 * "AI로 자동 확인" — 브라우저에서 이미 비식별화 확인을 마친 텍스트만 보낸다(원본 PDF
 * 바이트 없음, src/lib/pdfDeidentify.ts + AssessmentDetailPage의 확인 화면 참고).
 * Gemini에는 이 텍스트만 전달된다(functions/_lib/geminiClient.ts).
 */
export async function extractAssessment(
  assessmentId: string,
  deidentifiedText: string,
  caseRequestId: string,
): Promise<Assessment> {
  if (isDemoMode()) return demoAssessmentStore.extractSample(assessmentId)

  const response = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/extract`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deidentifiedText, caseRequestId }),
  })
  if (!response.ok) {
    return throwAssessmentApiError(response)
  }
  const data = (await response.json()) as { assessment: Assessment }
  return data.assessment
}

export interface ReviewAssessmentPayload extends Partial<AssessmentExtractedFields> {
  reviewNote?: string
  confirm: boolean
}

export async function reviewAssessment(
  assessmentId: string,
  payload: ReviewAssessmentPayload,
): Promise<{ assessment: Assessment; confirmed: boolean }> {
  if (isDemoMode()) return demoAssessmentStore.review(assessmentId, payload)

  const response = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    return throwAssessmentApiError(response)
  }
  return response.json()
}
