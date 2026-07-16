import type { Consent, ConsentDetail, ConsentListItem, PublicConsentInfo, SubmitConsentInput } from '@/types/consent'

/** 서버가 내려준 오류 코드를 그대로 담아 던진다(intakeService.ts의 IntakeApiError와 동일한 원칙). */
export class ConsentApiError extends Error {
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

async function throwConsentApiError(response: Response): Promise<never> {
  const data = await parseJsonSafe(response)
  const code = typeof data?.error === 'string' ? data.error : 'unknown_error'
  throw new ConsentApiError(code, response.status)
}

export async function fetchConsents(): Promise<ConsentListItem[]> {
  const response = await fetch('/api/consents', { credentials: 'include' })
  if (!response.ok) {
    return throwConsentApiError(response)
  }
  const data = (await response.json()) as { consents?: ConsentListItem[] }
  return data.consents ?? []
}

export async function fetchConsentDetail(caseId: string): Promise<ConsentDetail> {
  const response = await fetch(`/api/consents/${encodeURIComponent(caseId)}`, { credentials: 'include' })
  if (!response.ok) {
    return throwConsentApiError(response)
  }
  return response.json()
}

/** 학생 참여 의사 저장(POST /api/cases/:caseId/consent/assent) — 보호자 제출/교사 확인과 독립된 액션. */
export async function saveStudentAssent(caseId: string, studentAssent: string): Promise<Consent> {
  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/consent/assent`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentAssent }),
  })
  if (!response.ok) {
    return throwConsentApiError(response)
  }
  const data = (await response.json()) as { consent: Consent }
  return data.consent
}

/** 링크 생성 + 발송(POST /api/cases/:caseId/consent/send). 이미 보냈으면 alreadySent=true로 기존 값만 돌아온다. */
export async function sendConsentLink(caseId: string): Promise<{ consent: Consent; alreadySent: boolean }> {
  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/consent/send`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    return throwConsentApiError(response)
  }
  return response.json()
}

export async function confirmConsent(caseId: string): Promise<{ consent: Consent; alreadyConfirmed: boolean }> {
  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/consent/confirm`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    return throwConsentApiError(response)
  }
  return response.json()
}

/** 공개 보호자동의 페이지 데이터 조회(GET /api/public/consents/:token). 로그인 쿠키를 보내지 않는다. */
export async function fetchPublicConsent(token: string): Promise<PublicConsentInfo> {
  const response = await fetch(`/api/public/consents/${encodeURIComponent(token)}`)
  if (!response.ok) {
    return throwConsentApiError(response)
  }
  return response.json()
}

/** 보호자 제출(POST /api/public/consents/:token). 로그인 쿠키를 보내지 않는다. */
export async function submitPublicConsent(token: string, input: SubmitConsentInput): Promise<void> {
  const response = await fetch(`/api/public/consents/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    return throwConsentApiError(response)
  }
}
