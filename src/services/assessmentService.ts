import type { Assessment, AssessmentExtractedFields, AssessmentListItem } from '@/types/assessment'

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
  const response = await fetch('/api/assessments', { credentials: 'include' })
  if (!response.ok) {
    return throwAssessmentApiError(response)
  }
  const data = (await response.json()) as { assessments?: AssessmentListItem[] }
  return data.assessments ?? []
}

export async function fetchAssessment(assessmentId: string): Promise<Assessment> {
  const response = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, { credentials: 'include' })
  if (!response.ok) {
    return throwAssessmentApiError(response)
  }
  const data = (await response.json()) as { assessment: Assessment }
  return data.assessment
}

export async function uploadAssessment(
  caseId: string,
  file: File,
  round: string,
  timepoint: string,
): Promise<Assessment> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('round', round)
  formData.append('timepoint', timepoint)

  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/assessments`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!response.ok) {
    return throwAssessmentApiError(response)
  }
  const data = (await response.json()) as { assessment: Assessment }
  return data.assessment
}

/** "AI로 자동 확인" — 업로드된 PDF를 Gemini로 재분석한다(functions/_lib/geminiClient.ts). */
export async function extractAssessment(assessmentId: string): Promise<Assessment> {
  const response = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/extract`, {
    method: 'POST',
    credentials: 'include',
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
