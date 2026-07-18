import type { CaseDetail, CaseSearchFilters, CaseSearchItem } from '@/types/case'
import { isDemoMode } from '@/lib/accountModeCache'
import { demoCaseStore } from '@/data/demoStore'

export class CaseApiError extends Error {
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

async function throwCaseApiError(response: Response): Promise<never> {
  const data = await parseJsonSafe(response)
  const code = typeof data?.error === 'string' ? data.error : 'unknown_error'
  throw new CaseApiError(code, response.status)
}

export async function fetchCases(filters: CaseSearchFilters = {}): Promise<CaseSearchItem[]> {
  if (isDemoMode()) return demoCaseStore.list(filters)

  const params = new URLSearchParams()
  if (filters.keyword) params.set('keyword', filters.keyword)
  if (filters.status) params.set('status', filters.status)
  const query = params.toString()

  const response = await fetch(`/api/cases${query ? `?${query}` : ''}`, { credentials: 'include' })
  if (!response.ok) {
    return throwCaseApiError(response)
  }
  const data = (await response.json()) as { cases?: CaseSearchItem[] }
  return data.cases ?? []
}

export async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  if (isDemoMode()) return demoCaseStore.detail(caseId)

  const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, { credentials: 'include' })
  if (!response.ok) {
    return throwCaseApiError(response)
  }
  return response.json()
}
