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

async function loadSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const range = `${quoteSheetName(STUDENT_SHEET_NAME)}!A1:Z`
  const values = await getValues(accessToken, spreadsheetId, range)
  const headers = values[0] ?? []
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== ''))
  const headerIndex: Partial<Record<StudentHeader, number>> = {}
  headers.forEach((header, index) => {
    if ((STUDENT_HEADERS as readonly string[]).includes(header)) {
      headerIndex[header as StudentHeader] = index
    }
  })
  return { headers, headerIndex, rows }
}

/**
 * 캐노니컬 헤더 중 시트에 없는 열이 있으면 뒤에 이어붙인다. Milestone 1에서 이미
 * 설치된(구버전 헤더를 가진) 학교도 다음 호출부터 자동으로 새 열을 갖게 된다 —
 * legacy `ensureSheetHeaders_`와 동일한 자가-치유 패턴이며, 기존 데이터 행은
 * 건드리지 않는다(파괴적 변경 없음).
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

  const headerIndex: Partial<Record<StudentHeader, number>> = {}
  newHeaders.forEach((header, index) => {
    if ((STUDENT_HEADERS as readonly string[]).includes(header)) {
      headerIndex[header as StudentHeader] = index
    }
  })
  return { headers: newHeaders, headerIndex, rows: sheet.rows }
}

async function loadReadySheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const sheet = await loadSheet(accessToken, spreadsheetId)
  return ensureHeaders(accessToken, spreadsheetId, sheet)
}

function rowToRecord(row: string[], headerIndex: Partial<Record<StudentHeader, number>>): StudentRecord {
  const get = (header: StudentHeader): string => {
    const index = headerIndex[header]
    return index === undefined ? '' : (row[index] ?? '')
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

export interface ListStudentsOptions {
  /** 이름 부분 일치 검색(공백 무시, 대소문자 무시). */
  q?: string
  grade?: string
  class?: string
  /** 생략 또는 'active' = 비활성 제외. 'all' = 전체. 그 외 값 = enrollmentStatus 정확히 일치. */
  status?: string
}

export async function listStudents(
  accessToken: string,
  spreadsheetId: string,
  options: ListStudentsOptions = {},
): Promise<StudentRecord[]> {
  const sheet = await loadReadySheet(accessToken, spreadsheetId)
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

  return records
}

/** 같은 이름(공백 무시)+학년+반을 가진 재학 중인 학생이 이미 있는지 확인한다(중복 등록 방지). */
export async function findActiveDuplicate(
  accessToken: string,
  spreadsheetId: string,
  name: string,
  grade: string,
  studentClass: string,
): Promise<StudentRecord | null> {
  const active = await listStudents(accessToken, spreadsheetId, { status: 'active' })
  const normalizedName = normalizeName(name)
  return (
    active.find(
      (student) =>
        normalizeName(student.name) === normalizedName &&
        student.grade === grade &&
        student.class === studentClass,
    ) ?? null
  )
}

export interface CreateStudentInput {
  tenantId: string
  name: string
  grade: string
  class: string
  studentNumber?: string
}

export async function createStudent(
  accessToken: string,
  spreadsheetId: string,
  input: CreateStudentInput,
): Promise<StudentRecord> {
  const sheet = await loadReadySheet(accessToken, spreadsheetId)
  const now = new Date().toISOString()
  const record: StudentRecord = {
    studentUuid: crypto.randomUUID(),
    tenantId: input.tenantId,
    name: input.name,
    grade: input.grade,
    class: input.class,
    studentNumber: input.studentNumber ?? '',
    enrollmentStatus: ENROLLMENT_STATUS_ACTIVE,
    createdAt: now,
    updatedAt: now,
  }
  const row = recordToRow(record, sheet.headers)
  await appendValues(accessToken, spreadsheetId, `${quoteSheetName(STUDENT_SHEET_NAME)}!A1`, [row])
  return record
}

export type StudentPatch = Partial<
  Pick<StudentRecord, 'name' | 'grade' | 'class' | 'studentNumber' | 'enrollmentStatus'>
>

export async function updateStudent(
  accessToken: string,
  spreadsheetId: string,
  studentUuid: string,
  patch: StudentPatch,
): Promise<StudentRecord | null> {
  const sheet = await loadReadySheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.studentUuid
  if (idColumn === undefined) return null

  const rowOffset = sheet.rows.findIndex((row) => row[idColumn] === studentUuid)
  if (rowOffset === -1) return null

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  const updated: StudentRecord = { ...current, ...patch, updatedAt: new Date().toISOString() }
  const row = recordToRow(updated, sheet.headers)

  const sheetRowNumber = rowOffset + 2 // 1행은 헤더, 이후 1-based 행 번호
  const range = `${quoteSheetName(STUDENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return updated
}

/** 행을 삭제하지 않고 enrollmentStatus만 '비활성'으로 바꾼다(소프트 삭제). */
export async function deactivateStudent(
  accessToken: string,
  spreadsheetId: string,
  studentUuid: string,
): Promise<StudentRecord | null> {
  return updateStudent(accessToken, spreadsheetId, studentUuid, {
    enrollmentStatus: ENROLLMENT_STATUS_INACTIVE,
  })
}
