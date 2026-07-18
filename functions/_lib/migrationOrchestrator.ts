import { getValues, createSpreadsheet, batchWriteValues } from './googleSheets'
import { copyFile, moveFileToRootFolder } from './googleDrive'
import { IDENTITY_TAB_TITLES, IDENTITY_SPREADSHEET_TITLE } from './installTemplate'
import { STUDENT_HEADERS } from './studentSheet'
import { INTAKE_HEADERS } from './intakeSheet'
import { CASE_SHEET_NAME } from './caseSheet'
import { ASSESSMENT_SHEET_NAME } from './assessmentSheet'
import { isValidStudentIdFormat, maskStudentId, maskNamePartial } from './maskId'
import { GoogleApiError } from './googleApiError'
import type { InstallationRecord } from './installationStore'
import type { Env } from './env'

function quoteSheetName(name: string): string {
  return `'${name}'`
}

interface SheetSnapshot {
  headers: string[]
  rows: string[][]
}

const EMPTY_SNAPSHOT: SheetSnapshot = { headers: [], rows: [] }

async function readSheet(accessToken: string, spreadsheetId: string, sheetName: string): Promise<SheetSnapshot> {
  const values = await getValues(accessToken, spreadsheetId, `${quoteSheetName(sheetName)}!A1:ZZ`)
  const headers = values[0] ?? []
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== ''))
  return { headers, rows }
}

/** 해당 시트/탭이 아직 없는 설치(예: 진단검사 기능을 한 번도 안 쓴 학교)를 빈 스냅샷으로 처리한다. */
async function readSheetOrEmpty(accessToken: string, spreadsheetId: string, sheetName: string): Promise<SheetSnapshot> {
  try {
    return await readSheet(accessToken, spreadsheetId, sheetName)
  } catch (error) {
    if (error instanceof GoogleApiError && (error.status === 400 || error.status === 404)) {
      return EMPTY_SNAPSHOT
    }
    throw error
  }
}

function columnIndex(headers: string[], name: string): number {
  return headers.indexOf(name)
}

function makeGetter(headers: string[]): (row: string[], header: string) => string {
  const index = new Map(headers.map((h, i) => [h, i]))
  return (row, header) => {
    const idx = index.get(header)
    if (idx === undefined) return ''
    return row[idx] ?? ''
  }
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

export type UnresolvedReason =
  | 'empty_student_id'
  | 'invalid_format'
  | 'not_found_in_identity_sheet'
  | 'name_based_reference_not_migrated'

/**
 * 오류 항목 하나. 학생 이름 전체나 StudentID 전체를 담지 않는다(요구사항 12절 "학생
 * 이름 전체가 아니라 이름 일부 마스킹만 표시") — 화면/DB 어디에도 원문을 남기지 않는다.
 */
export interface UnresolvedRecord {
  source: '상담케이스' | '진단결과' | '상담접수' | '학생정보'
  /** 원본 시트의 1-based 행 번호(헤더 제외, 데이터 1행 = 2). */
  rowNumber: number
  grade: string
  studentClass: string
  studentNumber: string
  namePartialMasked: string
  studentIdMasked: string
  reason: UnresolvedReason
}

export interface MigrationValidation {
  totalStudents: number
  /** 상담케이스+진단결과 전체 + 승인된 상담접수 — StudentID로 연결되어야 하는 상담기록. */
  totalRecords: number
  linkedRecords: number
  unresolvedRecords: UnresolvedRecord[]
  /** 정확히 같은 StudentID 값이 학생정보에 2행 이상 있는 경우(데이터 정합성 오류). */
  duplicateStudentIdCount: number
  /** 이름+학년도+학년+반+번호가 완전히 같은데 StudentID가 다른 후보(동일 학생 중복 등록 의심). */
  duplicateCandidates: number
  /** 이름+학년도는 같지만 학년/반/번호가 달라 동명이인으로 추정되는, 병합하면 안 되는 후보. */
  samenameReviewCandidates: number
  /** 학생정보 자체에 빈 값/형식이 잘못된 StudentID가 있는 행(요구사항 12절 검증 기준 7). */
  invalidIdentitySheetEntries: UnresolvedRecord[]
  status: 'COMPLETED' | 'NEEDS_REVIEW'
}

/**
 * 마이그레이션 검증의 핵심 로직 — 순수 함수(스프레드시트 스냅샷만 받고 네트워크 호출은
 * 하지 않음)라 유닛 테스트로 직접 검증할 수 있다. 과거에는 이 검사 자체가 없어서
 * unresolved_references가 항상 0으로 하드코딩되어 있었다(migrationOrchestrator.ts:186,
 * 이번 수정 대상).
 *
 * 검증 기준(요구사항 12절):
 * 1) 상담케이스/진단결과/승인된 상담접수마다 StudentID가 있는지 확인
 * 2) 그 StudentID가 새 학생정보 시트에 실제 존재하는지 확인
 * 3) 연결되지 않은 상담기록 수 계산
 * 4) 중복 StudentID 검사
 * 5) 동일 학생으로 추정되지만 여러 StudentID로 분리된 후보 검사
 * 6) 이름은 같지만 학년·반·번호가 다른 동명이인 후보 분리
 * 7) 빈 StudentID 또는 잘못된 형식 검사
 * 8) 마이그레이션되지 않은 기존 이름 기반 참조 검사(승인된 상담접수인데 StudentID가 비어 있음)
 */
export function validateMigration(
  students: SheetSnapshot,
  intakes: SheetSnapshot,
  cases: SheetSnapshot,
  assessments: SheetSnapshot,
): MigrationValidation {
  const studentGet = makeGetter(students.headers)
  const intakeGet = makeGetter(intakes.headers)
  const caseGet = makeGetter(cases.headers)
  const assessmentGet = makeGetter(assessments.headers)

  const studentIds = students.rows.map((row) => studentGet(row, 'studentUuid'))

  // 4) 중복 StudentID(정확히 같은 값이 2행 이상)
  const idCounts = new Map<string, number>()
  for (const id of studentIds) {
    if (!id) continue
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
  }
  let duplicateStudentIdCount = 0
  for (const count of idCounts.values()) {
    if (count > 1) duplicateStudentIdCount += count
  }

  // 7) 학생정보 자체의 빈 값/잘못된 형식 StudentID
  const invalidIdentitySheetEntries: UnresolvedRecord[] = []
  const validStudentIdSet = new Set<string>()
  students.rows.forEach((row, index) => {
    const uuid = studentGet(row, 'studentUuid')
    if (uuid && isValidStudentIdFormat(uuid)) {
      validStudentIdSet.add(uuid)
      return
    }
    invalidIdentitySheetEntries.push({
      source: '학생정보',
      rowNumber: index + 2,
      grade: studentGet(row, 'grade'),
      studentClass: studentGet(row, 'class'),
      studentNumber: studentGet(row, 'studentNumber'),
      namePartialMasked: maskNamePartial(studentGet(row, 'name')),
      studentIdMasked: maskStudentId(uuid),
      reason: uuid ? 'invalid_format' : 'empty_student_id',
    })
  })

  // 5) 동일 학생(이름+학년도+학년+반+번호 완전 일치)인데 StudentID가 다른 후보
  // 6) 동명이인(이름+학년도만 같고 학년/반/번호는 다름) 후보 — 병합하면 안 되는 별도 학생
  const identityGroups = new Map<string, Set<string>>()
  const nameYearGroups = new Map<string, Set<string>>()
  students.rows.forEach((row) => {
    const name = studentGet(row, 'name')
    if (!name) return
    const year = studentGet(row, 'schoolYear')
    const grade = studentGet(row, 'grade')
    const studentClass = studentGet(row, 'class')
    const number = studentGet(row, 'studentNumber')
    const uuid = studentGet(row, 'studentUuid')

    const identityKey = [name, year, grade, studentClass, number].join('|')
    const idsForIdentity = identityGroups.get(identityKey) ?? new Set<string>()
    if (uuid) idsForIdentity.add(uuid)
    identityGroups.set(identityKey, idsForIdentity)

    const nameYearKey = [name, year].join('|')
    const tuplesForName = nameYearGroups.get(nameYearKey) ?? new Set<string>()
    tuplesForName.add([grade, studentClass, number].join('|'))
    nameYearGroups.set(nameYearKey, tuplesForName)
  })
  let duplicateCandidates = 0
  for (const ids of identityGroups.values()) {
    if (ids.size > 1) duplicateCandidates += ids.size
  }
  let samenameReviewCandidates = 0
  for (const tuples of nameYearGroups.values()) {
    if (tuples.size > 1) samenameReviewCandidates += tuples.size
  }

  // 1~3, 8) 상담기록(상담케이스/진단결과/승인된 상담접수)의 StudentID 연결 여부
  function classify(studentId: string): 'ok' | UnresolvedReason {
    if (!studentId) return 'empty_student_id'
    if (!isValidStudentIdFormat(studentId)) return 'invalid_format'
    if (!validStudentIdSet.has(studentId)) return 'not_found_in_identity_sheet'
    return 'ok'
  }

  const unresolvedRecords: UnresolvedRecord[] = []
  let totalRecords = 0
  let linkedRecords = 0

  cases.rows.forEach((row, index) => {
    totalRecords += 1
    const studentId = caseGet(row, 'studentUuid')
    const result = classify(studentId)
    if (result === 'ok') {
      linkedRecords += 1
      return
    }
    unresolvedRecords.push({
      source: '상담케이스',
      rowNumber: index + 2,
      grade: '',
      studentClass: '',
      studentNumber: '',
      namePartialMasked: '',
      studentIdMasked: maskStudentId(studentId),
      reason: result,
    })
  })

  assessments.rows.forEach((row, index) => {
    totalRecords += 1
    const studentId = assessmentGet(row, 'studentUuid')
    const result = classify(studentId)
    if (result === 'ok') {
      linkedRecords += 1
      return
    }
    unresolvedRecords.push({
      source: '진단결과',
      rowNumber: index + 2,
      grade: '',
      studentClass: '',
      studentNumber: '',
      namePartialMasked: '',
      studentIdMasked: maskStudentId(studentId),
      reason: result,
    })
  })

  // 상담접수는 '승인' 상태만 상담기록으로 취급한다 — 신규/검토중/반려는 아직 학생과
  // 연결되지 않는 게 정상이라 검증 대상이 아니다.
  intakes.rows.forEach((row, index) => {
    const status = intakeGet(row, 'status')
    if (status !== '승인') return
    totalRecords += 1
    const studentId = intakeGet(row, 'studentUuid')
    const result = classify(studentId)
    if (result === 'ok') {
      linkedRecords += 1
      return
    }
    unresolvedRecords.push({
      source: '상담접수',
      rowNumber: index + 2,
      grade: intakeGet(row, 'grade'),
      studentClass: intakeGet(row, 'class'),
      studentNumber: intakeGet(row, 'studentNumber'),
      namePartialMasked: maskNamePartial(intakeGet(row, 'name')),
      studentIdMasked: maskStudentId(studentId),
      // 승인됐는데 StudentID가 비어 있다면 예전 이름 기반 참조가 아직 학생과 연결되지 않은 것(요구사항 12절 검증 기준 8).
      reason: result === 'empty_student_id' ? 'name_based_reference_not_migrated' : result,
    })
  })

  return {
    totalStudents: students.rows.length,
    totalRecords,
    linkedRecords,
    unresolvedRecords,
    duplicateStudentIdCount,
    duplicateCandidates,
    samenameReviewCandidates,
    invalidIdentitySheetEntries,
    status: unresolvedRecords.length > 0 ? 'NEEDS_REVIEW' : 'COMPLETED',
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
  validation?: MigrationValidation
  conversionFailureCount: number
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

/**
 * 재배열 후 필수 값(학생: studentUuid+name, 상담접수: intakeId)이 비어 있는 행을 센다 —
 * 원본 시트에 목표 헤더와 이름이 일치하는 열이 없어서 값을 옮기지 못한 경우다(요구사항
 * 12절 "변환 실패 수"). 옮기지 못했을 뿐 원본 행 자체는 그대로 남아 있으므로 데이터
 * 손실은 아니다 — 관리자가 새 Spreadsheet에서 해당 행을 직접 확인해야 한다는 신호다.
 */
function countConversionFailures(
  remappedStudents: string[][],
  studentTargetHeaders: string[],
  remappedIntakes: string[][],
  intakeTargetHeaders: string[],
): number {
  const studentUuidIdx = studentTargetHeaders.indexOf('studentUuid')
  const studentNameIdx = studentTargetHeaders.indexOf('name')
  const intakeIdIdx = intakeTargetHeaders.indexOf('intakeId')

  let failures = 0
  for (const row of remappedStudents) {
    if (!row[studentUuidIdx] || !row[studentNameIdx]) failures += 1
  }
  for (const row of remappedIntakes) {
    if (!row[intakeIdIdx]) failures += 1
  }
  return failures
}

/**
 * 1) 기존 Spreadsheet 백업(Drive 사본) → 2) 새 학생식별정보 Spreadsheet 생성 →
 * 3) 학생정보/상담접수 행을 그대로 복사(studentUuid/intakeId 보존, 새로 발급하지 않음)
 * → 4) 상담케이스/진단결과(상담데이터 Spreadsheet에 그대로 남아 있음)가 새 학생정보와
 * 실제로 연결되는지 검증 → 5) 새 Spreadsheet ID와 검증 결과를 반환(호출부가 D1에 저장).
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
    return {
      ok: false,
      studentsMigrated: 0,
      intakesMigrated: 0,
      duplicateCandidates: 0,
      conversionFailureCount: 0,
      errorMessage: 'already_migrated',
    }
  }
  if (!installation.spreadsheetId || !installation.rootFolderId) {
    return {
      ok: false,
      studentsMigrated: 0,
      intakesMigrated: 0,
      duplicateCandidates: 0,
      conversionFailureCount: 0,
      errorMessage: 'installation_incomplete',
    }
  }

  const backup = await copyFile(
    accessToken,
    installation.spreadsheetId,
    `${installation.schoolName}_백업_${new Date().toISOString().slice(0, 10)}`,
  )

  const [students, intakes, cases, assessments] = await Promise.all([
    readSheet(accessToken, installation.spreadsheetId, '학생정보'),
    readSheet(accessToken, installation.spreadsheetId, '상담접수'),
    readSheetOrEmpty(accessToken, installation.spreadsheetId, CASE_SHEET_NAME),
    readSheetOrEmpty(accessToken, installation.spreadsheetId, ASSESSMENT_SHEET_NAME),
  ])

  const remappedStudents = remapRows(students, [...STUDENT_HEADERS])
  const remappedIntakes = remapRows(intakes, [...INTAKE_HEADERS])
  const conversionFailureCount = countConversionFailures(
    remappedStudents,
    [...STUDENT_HEADERS],
    remappedIntakes,
    [...INTAKE_HEADERS],
  )

  const identitySpreadsheetId = await createSpreadsheet(accessToken, IDENTITY_SPREADSHEET_TITLE, IDENTITY_TAB_TITLES)
  await moveFileToRootFolder(accessToken, identitySpreadsheetId, installation.rootFolderId)

  const ranges = [
    { range: `${quoteSheetName('학생정보')}!A1`, values: [[...STUDENT_HEADERS], ...remappedStudents] },
    { range: `${quoteSheetName('상담접수')}!A1`, values: [[...INTAKE_HEADERS], ...remappedIntakes] },
  ]
  await batchWriteValues(accessToken, identitySpreadsheetId, ranges)

  // 검증은 방금 새로 만든 학생정보/상담접수 스냅샷(remap 결과)을 기준으로 한다 —
  // 원본 열 이름이 달라 옮겨지지 않은 값까지 "존재하지 않음"으로 정확히 잡아낸다.
  const validation = validateMigration(
    { headers: [...STUDENT_HEADERS], rows: remappedStudents },
    { headers: [...INTAKE_HEADERS], rows: remappedIntakes },
    cases,
    assessments,
  )

  return {
    ok: true,
    backupSpreadsheetId: backup.id,
    identitySpreadsheetId,
    studentsMigrated: students.rows.length,
    intakesMigrated: intakes.rows.length,
    duplicateCandidates: validation.duplicateCandidates,
    conversionFailureCount,
    validation,
  }
}

export async function saveMigrationReport(env: Env, userId: string, result: MigrationResult): Promise<void> {
  if (!env.AUTH_DB) return
  const status = !result.ok ? 'failed' : result.validation?.status === 'NEEDS_REVIEW' ? 'needs_review' : 'completed'
  await env.AUTH_DB
    .prepare(
      `INSERT INTO migration_reports (
         user_id, status, backup_spreadsheet_id, students_migrated, intakes_migrated,
         duplicate_candidates, unresolved_references, error_message, created_at,
         total_students, total_records, linked_records, duplicate_identifier_count,
         samename_review_count, conversion_failure_count
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
       ON CONFLICT(user_id) DO UPDATE SET
         status = excluded.status,
         backup_spreadsheet_id = excluded.backup_spreadsheet_id,
         students_migrated = excluded.students_migrated,
         intakes_migrated = excluded.intakes_migrated,
         duplicate_candidates = excluded.duplicate_candidates,
         unresolved_references = excluded.unresolved_references,
         error_message = excluded.error_message,
         created_at = excluded.created_at,
         total_students = excluded.total_students,
         total_records = excluded.total_records,
         linked_records = excluded.linked_records,
         duplicate_identifier_count = excluded.duplicate_identifier_count,
         samename_review_count = excluded.samename_review_count,
         conversion_failure_count = excluded.conversion_failure_count`,
    )
    .bind(
      userId,
      status,
      result.backupSpreadsheetId ?? null,
      result.studentsMigrated,
      result.intakesMigrated,
      result.duplicateCandidates,
      result.validation?.unresolvedRecords.length ?? 0,
      result.errorMessage ?? null,
      Date.now(),
      result.validation?.totalStudents ?? 0,
      result.validation?.totalRecords ?? 0,
      result.validation?.linkedRecords ?? 0,
      result.validation?.duplicateStudentIdCount ?? 0,
      result.validation?.samenameReviewCandidates ?? 0,
      result.conversionFailureCount,
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
  totalStudents: number
  totalRecords: number
  linkedRecords: number
  unresolvedReferences: number
  duplicateIdentifierCount: number
  samenameReviewCount: number
  conversionFailureCount: number
  /** backupSpreadsheetId가 있으면 그 사본으로 복구할 수 있다는 뜻(요구사항 12절 "복구 가능 여부"). */
  recoverable: boolean
}

export async function getMigrationReport(env: Env, userId: string): Promise<StoredMigrationReport | null> {
  if (!env.AUTH_DB) return null
  const row = await env.AUTH_DB
    .prepare(
      `SELECT status, backup_spreadsheet_id, students_migrated, intakes_migrated,
              duplicate_candidates, unresolved_references, error_message, created_at,
              total_students, total_records, linked_records, duplicate_identifier_count,
              samename_review_count, conversion_failure_count
       FROM migration_reports WHERE user_id = ?1`,
    )
    .bind(userId)
    .first<{
      status: string
      backup_spreadsheet_id: string | null
      students_migrated: number
      intakes_migrated: number
      duplicate_candidates: number
      unresolved_references: number
      error_message: string | null
      created_at: number
      total_students: number
      total_records: number
      linked_records: number
      duplicate_identifier_count: number
      samename_review_count: number
      conversion_failure_count: number
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
    totalStudents: row.total_students,
    totalRecords: row.total_records,
    linkedRecords: row.linked_records,
    unresolvedReferences: row.unresolved_references,
    duplicateIdentifierCount: row.duplicate_identifier_count,
    samenameReviewCount: row.samename_review_count,
    conversionFailureCount: row.conversion_failure_count,
    recoverable: !!row.backup_spreadsheet_id,
  }
}
