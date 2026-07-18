export interface MigrationPreview {
  alreadyMigrated: boolean
  studentCount: number
  intakeCount: number
  duplicateCandidateCount: number
}

export type UnresolvedReason =
  | 'empty_student_id'
  | 'invalid_format'
  | 'not_found_in_identity_sheet'
  | 'name_based_reference_not_migrated'

export interface UnresolvedRecord {
  source: '상담케이스' | '진단결과' | '상담접수' | '학생정보'
  rowNumber: number
  grade: string
  studentClass: string
  studentNumber: string
  namePartialMasked: string
  studentIdMasked: string
  reason: UnresolvedReason
}

export interface MigrationRunResult {
  ok: boolean
  backupSpreadsheetId?: string
  studentsMigrated: number
  intakesMigrated: number
  duplicateCandidates: number
  status?: 'COMPLETED' | 'NEEDS_REVIEW'
  unresolvedCount?: number
  unresolvedRecords?: UnresolvedRecord[]
  error?: string
}

export interface MigrationReport {
  status: string
  backupSpreadsheetId: string | null
  studentsMigrated: number
  intakesMigrated: number
  duplicateCandidates: number
  errorMessage: string | null
  createdAt: number
  totalStudents: number
  totalRecords: number
  linkedRecords: number
  unresolvedReferences: number
  duplicateIdentifierCount: number
  samenameReviewCount: number
  conversionFailureCount: number
  recoverable: boolean
}

export async function fetchMigrationPreview(): Promise<MigrationPreview> {
  const response = await fetch('/api/migration/preview', { credentials: 'include' })
  if (!response.ok) throw new Error('migration_preview_failed')
  return response.json()
}

export async function runMigration(): Promise<MigrationRunResult> {
  const response = await fetch('/api/migration/run', { method: 'POST', credentials: 'include' })
  const data = (await response.json().catch(() => ({}))) as Partial<MigrationRunResult> & { error?: string }
  if (!response.ok) {
    return {
      ok: false,
      studentsMigrated: 0,
      intakesMigrated: 0,
      duplicateCandidates: 0,
      error: data.error ?? 'migration_failed',
    }
  }
  return { ok: true, studentsMigrated: 0, intakesMigrated: 0, duplicateCandidates: 0, ...data }
}

export async function fetchMigrationStatus(): Promise<MigrationReport | null> {
  const response = await fetch('/api/migration/status', { credentials: 'include' })
  if (!response.ok) throw new Error('migration_status_failed')
  const data = (await response.json()) as { report: MigrationReport | null }
  return data.report
}
