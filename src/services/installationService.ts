import type { Installation } from '@/types/installation'

interface InstallationResponse {
  installed: boolean
  schoolName?: string
  managerName?: string
  schoolPublicId?: string
  driveFolderUrl?: string | null
  spreadsheetUrl?: string | null
  error?: string
}

export async function fetchInstallation(): Promise<Installation | null> {
  const response = await fetch('/api/installation', { credentials: 'include' })
  if (!response.ok) return null

  const data = (await response.json()) as InstallationResponse
  // 설치 여부는 서버가 내려주는 installed 플래그를 그대로 신뢰한다 — 필드 값의
  // 빈 문자열 여부로 재판정하면 서버(installations 테이블 행 존재 여부) 판정과 어긋날 수 있다.
  if (!data.installed) return null

  return {
    schoolName: data.schoolName ?? '',
    managerName: data.managerName ?? '',
    schoolPublicId: data.schoolPublicId ?? '',
    driveFolderUrl: data.driveFolderUrl ?? null,
    spreadsheetUrl: data.spreadsheetUrl ?? null,
  }
}

export async function updateManagerName(managerName: string): Promise<void> {
  const response = await fetch('/api/installation', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ managerName }),
  })
  if (!response.ok) {
    throw new Error('update_manager_name_failed')
  }
}
