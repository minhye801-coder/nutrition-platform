import { getValues, createSpreadsheet, batchWriteValues } from './googleSheets'
import { copyFile, moveFileToRootFolder } from './googleDrive'
import { IDENTITY_TAB_TITLES, IDENTITY_SPREADSHEET_TITLE } from './installTemplate'
import { STUDENT_HEADERS } from './studentSheet'
import { INTAKE_HEADERS } from './intakeSheet'
import type { InstallationRecord } from './installationStore'
import type { Env } from './env'

function quoteSheetName(name: string): string {
  return `'${name}'`
}

interface SheetSnapshot {
  headers: string[]
  rows: string[][]
}

async function readSheet(accessToken: string, spreadsheetId: string, sheetName: string): Promise<SheetSnapshot> {
  const values = await getValues(accessToken, spreadsheetId, `${quoteSheetName(sheetName)}!A1:ZZ`)
  const headers = values[0] ?? []
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== ''))
  return { headers, rows }
}

function columnIndex(headers: string[], name: string): number {
  return headers.indexOf(name)
}

/** name+schoolYear+grade+class+studentNumber가 겹치는 재학생 후보 수를 센다(요구사항 12절 "중복 가능성"). */
function countDuplicateCandidates(headers: string[], rows: string[][]): number {
  const nameIdx = columnIndex(headers, 'name')
  const yearIdx = columnIndex(headers, 'schoolYear')
  const gradeIdx = columnIndex(headers, 'grade')
  const classIdx = columnIndex(headers, 'class')
  const numberIdx = columnIndex(headers, 'studentNumber')
  if (nameIdx === -1) return 0

  const seen = new Map<string, number>()
  for (const row of rows) {
    const key = [row[nameIdx], row[yearIdx], row[gradeIdx], row[classIdx], row[numberIdx]].join('|')
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  let duplicates = 0
  for (const count of seen.values()) {
    if (count > 1) duplicates += count
  }
  return duplicates
}

export interface MigrationPreview {
  /** 이미 분리된 설치는 미리보기 자체가 필요 없다. */
  alreadyMigrated: boolean
  studentCount: number
  intakeCount: number
  duplicateCandidateCount: number
}

/**
 * 기존 단일 Spreadsheet(학생정보/상담접수 탭이 아직 상담데이터 Spreadsheet 안에 있는
 * 상태)를 읽기만 한다 — 아무것도 쓰지 않는다. 요구사항 12절 "마이그레이션 전에
 * 처리 대상 학생 수/상담기록 수/중복 가능성"을 보여주기 위한 것.
 */
export async function previewMigration(
  accessToken: string,
  installation: InstallationRecord,
): Promise<MigrationPreview> {
  if (installation.identitySpreadsheetId) {
    return { alreadyMigrated: true, studentCount: 0, intakeCount: 0, duplicateCandidateCount: 0 }
  }
  if (!installation.spreadsheetId) {
    return { alreadyMigrated: false, studentCount: 0, intakeCount: 0, duplicateCandidateCount: 0 }
  }

  const [students, intakes] = await Promise.all([
    readSheet(accessToken, installation.spreadsheetId, '학생정보'),
    readSheet(accessToken, installation.spreadsheetId, '상담접수'),
  ])

  return {
    alreadyMigrated: false,
    studentCount: students.rows.length,
    intakeCount: intakes.rows.length,
    duplicateCandidateCount: countDuplicateCandidates(students.headers, students.rows),
  }
}

export interface MigrationResult {
  ok: boolean
  backupSpreadsheetId?: string
  identitySpreadsheetId?: string
  studentsMigrated: number
  intakesMigrated: number
  duplicateCandidates: number
  errorMessage?: string
}

/**
 * 1) 기존 Spreadsheet 백업(Drive 사본) → 2) 새 학생식별정보 Spreadsheet 생성 →
 * 3) 학생정보/상담접수 행을 그대로 복사(studentUuid/intakeId 보존, 새로 발급하지 않음)
 * → 4) 새 Spreadsheet ID를 반환(호출부가 D1에 저장).
 *
 * 기존 상담데이터 Spreadsheet의 학생정보/상담접수 탭과 예전 보호자 컬럼 값은 이
 * 함수가 지우지 않는다 — 백업이 있으니 실패해도 원본이 남아 있고(요구사항 12절
 * "실패 시 기존 데이터로 복원"), 삭제 대신 "더 이상 쓰지 않음"으로 처리한다(이미
 * consentSheet.ts/studentSheet.ts가 새 Spreadsheet만 사용하도록 바뀌어 있음) — 남은
 * 정리는 학교 담당자가 백업을 확인한 뒤 Google Sheets에서 직접 하도록 안내한다.
 */
export async function runMigration(
  accessToken: string,
  installation: InstallationRecord,
): Promise<MigrationResult> {
  if (installation.identitySpreadsheetId) {
    return { ok: false, studentsMigrated: 0, intakesMigrated: 0, duplicateCandidates: 0, errorMessage: 'already_migrated' }
  }
  if (!installation.spreadsheetId || !installation.rootFolderId) {
    return { ok: false, studentsMigrated: 0, intakesMigrated: 0, duplicateCandidates: 0, errorMessage: 'installation_incomplete' }
  }

  const backup = await copyFile(
    accessToken,
    installation.spreadsheetId,
    `${installation.schoolName}_백업_${new Date().toISOString().slice(0, 10)}`,
  )

  const [students, intakes] = await Promise.all([
    readSheet(accessToken, installation.spreadsheetId, '학생정보'),
    readSheet(accessToken, installation.spreadsheetId, '상담접수'),
  ])
  const duplicateCandidates = countDuplicateCandidates(students.headers, students.rows)

  const identitySpreadsheetId = await createSpreadsheet(accessToken, IDENTITY_SPREADSHEET_TITLE, IDENTITY_TAB_TITLES)
  await moveFileToRootFolder(accessToken, identitySpreadsheetId, installation.rootFolderId)

  const ranges = [
    { range: `${quoteSheetName('학생정보')}!A1`, values: [[...STUDENT_HEADERS], ...remapRows(students, [...STUDENT_HEADERS])] },
    { range: `${quoteSheetName('상담접수')}!A1`, values: [[...INTAKE_HEADERS], ...remapRows(intakes, [...INTAKE_HEADERS])] },
  ]
  await batchWriteValues(accessToken, identitySpreadsheetId, ranges)

  return {
    ok: true,
    backupSpreadsheetId: backup.id,
    identitySpreadsheetId,
    studentsMigrated: students.rows.length,
    intakesMigrated: intakes.rows.length,
    duplicateCandidates,
  }
}

/** 원본 시트의 열 순서가 목표 헤더와 다를 수 있으므로, 헤더 이름 기준으로 값을 재배열한다. */
function remapRows(snapshot: SheetSnapshot, targetHeaders: string[]): string[][] {
  const indexByHeader = new Map(snapshot.headers.map((header, index) => [header, index]))
  return snapshot.rows.map((row) =>
    targetHeaders.map((header) => {
      const index = indexByHeader.get(header)
      return index === undefined ? '' : (row[index] ?? '')
    }),
  )
}

export async function saveMigrationReport(env: Env, userId: string, result: MigrationResult): Promise<void> {
  if (!env.AUTH_DB) return
  await env.AUTH_DB
    .prepare(
      `INSERT INTO migration_reports (
         user_id, status, backup_spreadsheet_id, students_migrated, intakes_migrated,
         duplicate_candidates, unresolved_references, error_message, created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(user_id) DO UPDATE SET
         status = excluded.status,
         backup_spreadsheet_id = excluded.backup_spreadsheet_id,
         students_migrated = excluded.students_migrated,
         intakes_migrated = excluded.intakes_migrated,
         duplicate_candidates = excluded.duplicate_candidates,
         unresolved_references = excluded.unresolved_references,
         error_message = excluded.error_message,
         created_at = excluded.created_at`,
    )
    .bind(
      userId,
      result.ok ? 'completed' : 'failed',
      result.backupSpreadsheetId ?? null,
      result.studentsMigrated,
      result.intakesMigrated,
      result.duplicateCandidates,
      0,
      result.errorMessage ?? null,
      Date.now(),
    )
    .run()
}

export interface StoredMigrationReport {
  status: string
  backupSpreadsheetId: string | null
  studentsMigrated: number
  intakesMigrated: number
  duplicateCandidates: number
  errorMessage: string | null
  createdAt: number
}

export async function getMigrationReport(env: Env, userId: string): Promise<StoredMigrationReport | null> {
  if (!env.AUTH_DB) return null
  const row = await env.AUTH_DB
    .prepare(
      `SELECT status, backup_spreadsheet_id, students_migrated, intakes_migrated,
              duplicate_candidates, error_message, created_at
       FROM migration_reports WHERE user_id = ?1`,
    )
    .bind(userId)
    .first<{
      status: string
      backup_spreadsheet_id: string | null
      students_migrated: number
      intakes_migrated: number
      duplicate_candidates: number
      error_message: string | null
      created_at: number
    }>()
  if (!row) return null
  return {
    status: row.status,
    backupSpreadsheetId: row.backup_spreadsheet_id,
    studentsMigrated: row.students_migrated,
    intakesMigrated: row.intakes_migrated,
    duplicateCandidates: row.duplicate_candidates,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }
}
