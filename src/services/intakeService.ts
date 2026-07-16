import type { Intake, IntakeListFilters, SubmitIntakeInput } from '@/types/intake'

/** 서버가 내려준 오류 코드를 그대로 담아 던진다(studentService.ts의 StudentApiError와 동일한 원칙). */
export class IntakeApiError extends Error {
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

async function throwIntakeApiError(response: Response): Promise<never> {
  const data = await parseJsonSafe(response)
  const code = typeof data?.error === 'string' ? data.error : 'unknown_error'
  throw new IntakeApiError(code, response.status)
}

/** 공개 상담신청 제출(POST /api/public/intakes/:schoolPublicId). 로그인 쿠키를 보내지 않는다. */
export async function submitPublicIntake(
  schoolPublicId: string,
  input: SubmitIntakeInput,
): Promise<{ intakeId: string }> {
  const response = await fetch(`/api/public/intakes/${encodeURIComponent(schoolPublicId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    return throwIntakeApiError(response)
  }
  return response.json()
}

/** 공개 상담신청 폼 상단에 표시할 학교명 조회(GET /api/public/intakes/:schoolPublicId/config). */
export async function fetchPublicIntakeConfig(schoolPublicId: string): Promise<{ schoolName: string }> {
  const response = await fetch(`/api/public/intakes/${encodeURIComponent(schoolPublicId)}/config`)
  if (!response.ok) {
    return throwIntakeApiError(response)
  }
  return response.json()
}

export async function fetchIntakes(filters: IntakeListFilters = {}): Promise<Intake[]> {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  const query = params.toString()

  const response = await fetch(`/api/intakes${query ? `?${query}` : ''}`, { credentials: 'include' })
  if (!response.ok) {
    return throwIntakeApiError(response)
  }
  const data = (await response.json()) as { intakes?: Intake[] }
  return data.intakes ?? []
}

export async function fetchIntake(intakeId: string): Promise<Intake> {
  const response = await fetch(`/api/intakes/${encodeURIComponent(intakeId)}`, { credentials: 'include' })
  if (!response.ok) {
    return throwIntakeApiError(response)
  }
  const data = (await response.json()) as { intake: Intake }
  return data.intake
}

async function postIntakeAction(intakeId: string, action: 'review' | 'approve' | 'reject'): Promise<Intake> {
  const response = await fetch(`/api/intakes/${encodeURIComponent(intakeId)}/${action}`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    return throwIntakeApiError(response)
  }
  const data = (await response.json()) as { intake: Intake }
  return data.intake
}

export const reviewIntake = (intakeId: string): Promise<Intake> => postIntakeAction(intakeId, 'review')
export const approveIntake = (intakeId: string): Promise<Intake> => postIntakeAction(intakeId, 'approve')
export const rejectIntake = (intakeId: string): Promise<Intake> => postIntakeAction(intakeId, 'reject')
