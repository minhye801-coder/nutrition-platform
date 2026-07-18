export interface LegacyPdfAuditItem {
  assessmentId: string
  caseId: string
  fileId: string
  fileName: string
  createdAt: string
  studentIdMasked: string
  driveLocation: string
  webViewLink: string
  hasStructuredResult: boolean
  driveStatus: 'found' | 'trashed' | 'not_found' | 'error'
}

/** 점검 목록 조회 — 아무것도 삭제하지 않는다. */
export async function fetchLegacyAssessmentPdfs(): Promise<LegacyPdfAuditItem[]> {
  const response = await fetch('/api/admin/legacy-assessment-pdfs', { credentials: 'include' })
  if (!response.ok) throw new Error('legacy_pdf_audit_failed')
  const data = (await response.json()) as { items: LegacyPdfAuditItem[] }
  return data.items
}

/** 관리자가 직접 선택한 fileId만 Drive 휴지통으로 옮긴다(영구 삭제 아님, 복구 가능). */
export async function trashLegacyAssessmentPdfs(
  fileIds: string[],
): Promise<{ fileId: string; ok: boolean }[]> {
  const response = await fetch('/api/admin/legacy-assessment-pdfs/trash', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  })
  if (!response.ok) throw new Error('legacy_pdf_trash_failed')
  const data = (await response.json()) as { results: { fileId: string; ok: boolean }[] }
  return data.results
}
