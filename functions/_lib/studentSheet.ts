import { appendValues, getValues, updateValues } from './googleSheets'

/** docs/database-schema.md 2.2절(확정)과 동일하게 유지한다. */
export const STUDENT_SHEET_NAME = '학생정보'

export const STUDENT_HEADERS = [
  'studentUuid',
  'tenantId',
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
 * 설치된(구버전 헤더를 가진) 학교도 다음 쓰기 호출부터 자동으로 새 열을 갖게 된다 —
 * legacy `ensureSheetHeaders_`와 동일한 자가-치유 패턴이며, 기존 데이터 행은
 * 건드리지 않는다(파괴적 변경 없음). 등록/수정/비활성/복구처럼 실제로 쓰기가
 * 필요한 작업에서만 호출한다 — 단순 조회(GET)는 시트에 쓰기를 하지 않는다(아래
 * `loadReadOnlySheet` 참고).
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

  return { headers: newHeaders, headerIndex: buildHeaderIndex(newHeaders), rows: sheet.rows }
}

async function loadWritableSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const sheet = await loadSheet(accessToken, spreadsheetId)
  return ensureHeaders(accessToken, spreadsheetId, sheet)
}

/** 조회 전용 경로. 시트에 쓰지 않되, 핵심 식별자 헤더(studentUuid)조차 없으면 명확한 오류를 던진다. */
async function loadReadOnlySheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const sheet = await loadSheet(accessToken, spreadsheetId)
  if (sheet.headerIndex.studentUuid === undefined) {
    const missing = STUDENT_HEADERS.filter((header) => sheet.headerIndex[header] === undefined)
    throw new StudentSheetSchemaError(missing)
  }
  return sheet
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

/** 기본 정렬: 재학상태 → 학년 → 반 → 번호 → 이름. */
function compareStudents(a: StudentRecord, b: StudentRecord): number {
  return (
    enrollmentStatusRank(a.enrollmentStatus) - enrollmentStatusRank(b.enrollmentStatus) ||
    compareNatural(a.grade, b.grade) ||
    compareNatural(a.class, b.class) ||
    compareNatural(a.studentNumber, b.studentNumber) ||
    a.name.localeCompare(b.name, 'ko')
  )
}

export interface ListStudentsOptions {
  /** 이름 부분 일치 검색(공백 무시, 대소문자 무시). */
  q?: string
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
  const sheet = await loadReadOnlySheet(accessToken, spreadsheetId)
  let records = sheet.rows.map((row) => rowToRecord(row, sheet.headerIndex))

  if (!options.status || options.status === 'active') {
    records = records.filter((student) => student.enrollmentStatus !== ENROLLMENT_STATUS_INACTIVE)
  } else if (options.status !== 'all') {
    records = records.filter((student) => student.enrollmentStatus === options.status)
  }

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
 * name+grade+class+studentNumber가 모두 같고 재학 중인 학생이 이미 있는지 확인한다
 * (중복 등록 경고용 — 이름만으로 학생을 자동 연결/병합하지 않는다, database-schema.md 3절).
 */
export async function findPotentialDuplicate(
  accessToken: string,
  spreadsheetId: string,
  name: string,
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
        student.grade === grade &&
        student.class === studentClass &&
        student.studentNumber === normalizedNumber,
    ) ?? null
  )
}

export interface CreateStudentInput {
  tenantId: string
  name: string
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
  Pick<StudentRecord, 'name' | 'grade' | 'class' | 'studentNumber' | 'enrollmentStatus'>
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
