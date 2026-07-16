import { appendValues, getValues, updateValues } from './googleSheets'
import { recordSchemaVersion, STUDENT_SCHEMA_VERSION } from './settingsSheet'

/** docs/database-schema.md 2.2절(확정)과 동일하게 유지한다. */
export const STUDENT_SHEET_NAME = '학생정보'

export const STUDENT_HEADERS = [
  'studentUuid',
  'tenantId',
  'schoolYear',
  'name',
  'grade',
  'class',
  'studentNumber',
  'enrollmentStatus',
  'createdAt',
  'updatedAt',
] as const

type StudentHeader = (typeof STUDENT_HEADERS)[number]

export interface StudentRecord {
  studentUuid: string
  tenantId: string
  /** legacy 학년도. 매년 같은 학년/반이 반복되므로(예: 매년 "1학년 3반") 학생을 유일하게
   * 구분하려면 학년/반만으로는 부족하다 — docs/student-info-verification.md 7.1절. */
  schoolYear: string
  name: string
  grade: string
  class: string
  studentNumber: string
  enrollmentStatus: string
  createdAt: string
  updatedAt: string
}

export const ENROLLMENT_STATUS_ACTIVE = '재학'
export const ENROLLMENT_STATUS_INACTIVE = '비활성'
export const ENROLLMENT_STATUS_VALUES = [ENROLLMENT_STATUS_ACTIVE, ENROLLMENT_STATUS_INACTIVE] as const

export function isValidEnrollmentStatus(value: string): boolean {
  return (ENROLLMENT_STATUS_VALUES as readonly string[]).includes(value)
}

/** "학생정보" 탭이 아예 없거나(탭명 변경/삭제) studentUuid 헤더 자체를 찾을 수 없을 때. */
export class StudentSheetSchemaError extends Error {
  constructor(public readonly missingHeaders: string[]) {
    super(`student sheet missing headers: ${missingHeaders.join(', ')}`)
    this.name = 'StudentSheetSchemaError'
  }
}

function quoteSheetName(name: string): string {
  return `'${name}'`
}

/** 0-based 열 인덱스를 A1 표기 열 문자(A, B, ..., Z, AA, ...)로 바꾼다. */
function columnLetter(index: number): string {
  let n = index + 1
  let letters = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

interface LoadedSheet {
  headers: string[]
  headerIndex: Partial<Record<StudentHeader, number>>
  /** 헤더를 제외한 데이터 행. 완전히 빈 행은 제외한다. */
  rows: string[][]
}

function buildHeaderIndex(headers: string[]): Partial<Record<StudentHeader, number>> {
  const headerIndex: Partial<Record<StudentHeader, number>> = {}
  headers.forEach((header, index) => {
    if ((STUDENT_HEADERS as readonly string[]).includes(header)) {
      headerIndex[header as StudentHeader] = index
    }
  })
  return headerIndex
}

async function loadSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const range = `${quoteSheetName(STUDENT_SHEET_NAME)}!A1:Z`
  const values = await getValues(accessToken, spreadsheetId, range)
  const headers = values[0] ?? []
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== ''))
  return { headers, headerIndex: buildHeaderIndex(headers), rows }
}

/**
 * 캐노니컬 헤더 중 시트에 없는 열이 있으면 뒤에 이어붙인다. Milestone 1에서 이미
 * 설치된(구버전 헤더를 가진) 학교도 다음 호출부터 자동으로 새 열을 갖게 된다 —
 * legacy `ensureSheetHeaders_`와 동일한 자가-치유 패턴이며, 기존 데이터 행은
 * 건드리지 않는다(파괴적 변경 없음). 조회(GET)를 포함해 학생 API의 모든 진입점이
 * 이 함수를 거친다 — "스키마가 낡아서 실패"하는 상태 자체를 만들지 않는 게
 * 목표다. 실제로 헤더를 보정했을 때만 "설정" 탭의 schemaVersion도 함께 갱신한다
 * (그 갱신 자체는 감사 기록일 뿐이며 실패해도 학생 API 결과에는 영향 없음).
 */
async function ensureHeaders(
  accessToken: string,
  spreadsheetId: string,
  sheet: LoadedSheet,
): Promise<LoadedSheet> {
  const missing = STUDENT_HEADERS.filter((header) => sheet.headerIndex[header] === undefined)
  if (missing.length === 0) return sheet

  const newHeaders = [...sheet.headers, ...missing]
  const range = `${quoteSheetName(STUDENT_SHEET_NAME)}!A1:${columnLetter(newHeaders.length - 1)}1`
  await updateValues(accessToken, spreadsheetId, range, [newHeaders])

  await recordSchemaVersion(accessToken, spreadsheetId, STUDENT_SCHEMA_VERSION).catch((error) => {
    console.error('[students] schemaVersion 기록 실패(무시하고 계속 진행)', error)
  })

  return { headers: newHeaders, headerIndex: buildHeaderIndex(newHeaders), rows: sheet.rows }
}

/**
 * 학생 API의 모든 진입점(목록 조회 포함)이 쓰는 로더. 항상 먼저 스키마를
 * 확인/보정한 뒤 데이터를 돌려주므로, 호출부는 "헤더가 없어서 실패"하는 경우를
 * 신경 쓸 필요가 없다 — studentUuid 헤더는 ensureHeaders가 끝나면 항상 존재를
 * 보장한다.
 */
async function loadWritableSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const sheet = await loadSheet(accessToken, spreadsheetId)
  return ensureHeaders(accessToken, spreadsheetId, sheet)
}

function rowToRecord(row: string[], headerIndex: Partial<Record<StudentHeader, number>>): StudentRecord {
  const get = (header: StudentHeader): string => {
    const index = headerIndex[header]
    if (index === undefined) return ''
    const value = row[index]
    return value === undefined || value === null ? '' : String(value)
  }
  return {
    studentUuid: get('studentUuid'),
    tenantId: get('tenantId'),
    schoolYear: get('schoolYear'),
    name: get('name'),
    grade: get('grade'),
    class: get('class'),
    studentNumber: get('studentNumber'),
    enrollmentStatus: get('enrollmentStatus'),
    createdAt: get('createdAt'),
    updatedAt: get('updatedAt'),
  }
}

function recordToRow(record: StudentRecord, headers: string[]): string[] {
  const byHeader = record as unknown as Record<string, string>
  return headers.map((header) => byHeader[header] ?? '')
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '')
}

/** "10" < "2"가 되는 문자열 비교 문제를 피하려고, 둘 다 숫자로 보이면 숫자로 비교한다. */
function compareNatural(a: string, b: string): number {
  if (a !== '' && b !== '') {
    const numA = Number(a)
    const numB = Number(b)
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB
  }
  return a.localeCompare(b, 'ko')
}

function enrollmentStatusRank(status: string): number {
  const index = (ENROLLMENT_STATUS_VALUES as readonly string[]).indexOf(status)
  return index === -1 ? ENROLLMENT_STATUS_VALUES.length : index
}

/** 기본 정렬: 재학상태 → 학년도 → 학년 → 반 → 번호 → 이름. */
function compareStudents(a: StudentRecord, b: StudentRecord): number {
  return (
    enrollmentStatusRank(a.enrollmentStatus) - enrollmentStatusRank(b.enrollmentStatus) ||
    compareNatural(a.schoolYear, b.schoolYear) ||
    compareNatural(a.grade, b.grade) ||
    compareNatural(a.class, b.class) ||
    compareNatural(a.studentNumber, b.studentNumber) ||
    a.name.localeCompare(b.name, 'ko')
  )
}

export interface ListStudentsOptions {
  /** 이름 부분 일치 검색(공백 무시, 대소문자 무시). */
  q?: string
  schoolYear?: string
  grade?: string
  class?: string
  /** 생략 또는 'active' = 비활성 제외. 'all' = 전체(비활성 포함). 그 외 값 = enrollmentStatus 정확히 일치. */
  status?: string
}

export async function listStudents(
  accessToken: string,
  spreadsheetId: string,
  options: ListStudentsOptions = {},
): Promise<StudentRecord[]> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  let records = sheet.rows.map((row) => rowToRecord(row, sheet.headerIndex))

  if (!options.status || options.status === 'active') {
    records = records.filter((student) => student.enrollmentStatus !== ENROLLMENT_STATUS_INACTIVE)
  } else if (options.status !== 'all') {
    records = records.filter((student) => student.enrollmentStatus === options.status)
  }

  if (options.schoolYear) records = records.filter((student) => student.schoolYear === options.schoolYear)
  if (options.grade) records = records.filter((student) => student.grade === options.grade)
  if (options.class) records = records.filter((student) => student.class === options.class)
  if (options.q) {
    const normalizedQuery = normalizeName(options.q).toLowerCase()
    records = records.filter((student) =>
      normalizeName(student.name).toLowerCase().includes(normalizedQuery),
    )
  }

  return records.sort(compareStudents)
}

/**
 * name+schoolYear+grade+class+studentNumber가 모두 같고 재학 중인 학생이 이미 있는지 확인한다
 * (중복 등록 경고용 — 이름만으로 학생을 자동 연결/병합하지 않는다, database-schema.md 3절).
 * legacy `findStudent_`(docs/student-info-verification.md 3절)와 동일하게 학년도를 매칭
 * 조건에 포함한다 — 학년/반만으로는 해마다 반복되는 값이라 다른 해의 학생과 구분되지 않는다.
 */
export async function findPotentialDuplicate(
  accessToken: string,
  spreadsheetId: string,
  name: string,
  schoolYear: string,
  grade: string,
  studentClass: string,
  studentNumber: string,
): Promise<StudentRecord | null> {
  const active = await listStudents(accessToken, spreadsheetId, { status: ENROLLMENT_STATUS_ACTIVE })
  const normalizedName = normalizeName(name)
  const normalizedNumber = studentNumber.trim()
  return (
    active.find(
      (student) =>
        normalizeName(student.name) === normalizedName &&
        student.schoolYear === schoolYear &&
        student.grade === grade &&
        student.class === studentClass &&
        student.studentNumber === normalizedNumber,
    ) ?? null
  )
}

/**
 * 상담접수 승인 시 학생을 자동으로 매칭할 때만 쓴다(functions/api/intakes/[intakeId]/approve.ts).
 * `findPotentialDuplicate`(직접등록 화면의 "중복일 수도 있습니다" 경고용, 사용자가 최종
 * 판단)와는 목적이 다르다 — 여기서는 매칭되면 그 학생코드로 자동 연결하고 새로 만들지
 * 않으므로, legacy `findStudent_`(counseling-manager/code.gs.txt:5842)의 느슨한 번호
 * 매칭 규칙을 그대로 따른다: 번호는 신청서와 기존 학생 레코드 중 하나라도 비어 있으면
 * 조건에서 제외하고, 둘 다 있을 때만 정확히 일치해야 한다(공개 상담신청에서 번호는
 * 선택 입력이라 비어 있는 경우가 흔하다 — intake-migration-spec.md 1.2절).
 */
export async function findStudentForCaseApproval(
  accessToken: string,
  spreadsheetId: string,
  name: string,
  schoolYear: string,
  grade: string,
  studentClass: string,
  studentNumber: string,
): Promise<StudentRecord | null> {
  const active = await listStudents(accessToken, spreadsheetId, { status: ENROLLMENT_STATUS_ACTIVE })
  const normalizedName = normalizeName(name)
  const normalizedNumber = studentNumber.trim()
  return (
    active.find(
      (student) =>
        normalizeName(student.name) === normalizedName &&
        student.schoolYear === schoolYear &&
        student.grade === grade &&
        student.class === studentClass &&
        (!normalizedNumber || !student.studentNumber || student.studentNumber === normalizedNumber),
    ) ?? null
  )
}

export interface CreateStudentInput {
  tenantId: string
  name: string
  schoolYear: string
  grade: string
  class: string
  studentNumber: string
}

export async function createStudent(
  accessToken: string,
  spreadsheetId: string,
  input: CreateStudentInput,
): Promise<StudentRecord> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const now = new Date().toISOString()
  const record: StudentRecord = {
    studentUuid: crypto.randomUUID(),
    tenantId: input.tenantId,
    schoolYear: input.schoolYear,
    name: input.name,
    grade: input.grade,
    class: input.class,
    studentNumber: input.studentNumber,
    enrollmentStatus: ENROLLMENT_STATUS_ACTIVE,
    createdAt: now,
    updatedAt: now,
  }
  const row = recordToRow(record, sheet.headers)
  await appendValues(accessToken, spreadsheetId, `${quoteSheetName(STUDENT_SHEET_NAME)}!A1`, [row])
  return record
}

/** studentUuid는 포함하지 않는다 — 영구 식별자는 변경 불가(호출부인 API 라우트에서도 별도로 막는다). */
export type StudentPatch = Partial<
  Pick<StudentRecord, 'name' | 'schoolYear' | 'grade' | 'class' | 'studentNumber' | 'enrollmentStatus'>
>

export async function updateStudent(
  accessToken: string,
  spreadsheetId: string,
  studentUuid: string,
  patch: StudentPatch,
): Promise<StudentRecord | null> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.studentUuid
  if (idColumn === undefined) return null

  const rowOffset = sheet.rows.findIndex((row) => row[idColumn] === studentUuid)
  if (rowOffset === -1) return null

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  const updated: StudentRecord = { ...current, ...patch, studentUuid, updatedAt: new Date().toISOString() }
  const row = recordToRow(updated, sheet.headers)

  const sheetRowNumber = rowOffset + 2 // 1행은 헤더, 이후 1-based 행 번호
  const range = `${quoteSheetName(STUDENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return updated
}

/** 행을 삭제하지 않고 enrollmentStatus만 '비활성'으로 바꾼다(소프트 삭제) — 상담기록 등 다른 탭의 참조는 그대로 보존된다. */
export async function deactivateStudent(
  accessToken: string,
  spreadsheetId: string,
  studentUuid: string,
): Promise<StudentRecord | null> {
  return updateStudent(accessToken, spreadsheetId, studentUuid, {
    enrollmentStatus: ENROLLMENT_STATUS_INACTIVE,
  })
}

/** 비활성 처리를 되돌린다. */
export async function restoreStudent(
  accessToken: string,
  spreadsheetId: string,
  studentUuid: string,
): Promise<StudentRecord | null> {
  return updateStudent(accessToken, spreadsheetId, studentUuid, {
    enrollmentStatus: ENROLLMENT_STATUS_ACTIVE,
  })
}
