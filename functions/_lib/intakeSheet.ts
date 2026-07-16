import { appendValues, getValues, updateValues } from './googleSheets'
import { recordSchemaVersion, INTAKE_SCHEMA_VERSION } from './settingsSheet'

/** docs/database-schema.md 2.3절(Milestone 2A 확정)과 동일하게 유지한다. */
export const INTAKE_SHEET_NAME = '상담접수'

export const INTAKE_HEADERS = [
  'intakeId',
  'tenantId',
  'applicantType',
  'applicantName',
  'relationToStudent',
  'schoolYear',
  'grade',
  'class',
  'studentNumber',
  'name',
  'topic',
  'content',
  'preferredTime',
  'urgency',
  'contactInfo',
  'privacyConsent',
  'note',
  'studentUuid',
  'status',
  'submittedAt',
  'updatedAt',
] as const

type IntakeHeader = (typeof INTAKE_HEADERS)[number]

export interface IntakeRecord {
  intakeId: string
  tenantId: string
  applicantType: string
  applicantName: string
  relationToStudent: string
  schoolYear: string
  grade: string
  class: string
  studentNumber: string
  name: string
  topic: string
  content: string
  preferredTime: string
  urgency: string
  contactInfo: string
  privacyConsent: string
  /** 선택 입력. */
  note: string
  /** 승인 전에는 비어 있다 — Milestone 2B에서 학생 매칭/생성 시 채워진다. */
  studentUuid: string
  status: string
  submittedAt: string
  updatedAt: string
}

export const INTAKE_STATUS_NEW = '신규'
export const INTAKE_STATUS_REVIEWING = '검토중'
export const INTAKE_STATUS_APPROVED = '승인'
export const INTAKE_STATUS_REJECTED = '반려'
export const INTAKE_STATUS_VALUES = [
  INTAKE_STATUS_NEW,
  INTAKE_STATUS_REVIEWING,
  INTAKE_STATUS_APPROVED,
  INTAKE_STATUS_REJECTED,
] as const

/** legacy `Intake.html.txt`와 동일한 값 목록(docs/intake-migration-spec.md 1.1절). */
export const APPLICANT_TYPE_VALUES = ['학생', '보호자', '담임교사', '보건교사', '기타 교직원'] as const
export const RELATION_TO_STUDENT_VALUES = ['본인', '부', '모', '보호자', '담임교사', '보건교사', '기타'] as const
export const TOPIC_VALUES = [
  '편식·균형 식생활',
  '아침식사·결식',
  '간식·단 음료',
  '체중·성장',
  '식품 알레르기',
  '식사습관',
  '기타',
] as const
export const PREFERRED_TIME_VALUES = ['상관없음', '점심시간', '방과 후', '영양교사와 협의'] as const
export const URGENCY_VALUES = ['일반', '가급적 빠른 확인'] as const

/** "상담접수" 탭이 아예 없거나(탭명 변경/삭제) intakeId 헤더 자체를 찾을 수 없을 때. */
export class IntakeSheetSchemaError extends Error {
  constructor(public readonly missingHeaders: string[]) {
    super(`intake sheet missing headers: ${missingHeaders.join(', ')}`)
    this.name = 'IntakeSheetSchemaError'
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
  headerIndex: Partial<Record<IntakeHeader, number>>
  rows: string[][]
}

function buildHeaderIndex(headers: string[]): Partial<Record<IntakeHeader, number>> {
  const headerIndex: Partial<Record<IntakeHeader, number>> = {}
  headers.forEach((header, index) => {
    if ((INTAKE_HEADERS as readonly string[]).includes(header)) {
      headerIndex[header as IntakeHeader] = index
    }
  })
  return headerIndex
}

async function loadSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const range = `${quoteSheetName(INTAKE_SHEET_NAME)}!A1:Z`
  const values = await getValues(accessToken, spreadsheetId, range)
  const headers = values[0] ?? []
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== ''))
  return { headers, headerIndex: buildHeaderIndex(headers), rows }
}

/**
 * 캐노니컬 헤더 중 시트에 없는 열이 있으면 뒤에 이어붙인다(studentSheet.ts의
 * `ensureHeaders`와 동일한 자가-치유 패턴). Milestone 2A 이전에 설치된 학교도
 * 다음 호출부터 확장된 헤더를 자동으로 갖게 된다.
 */
async function ensureHeaders(
  accessToken: string,
  spreadsheetId: string,
  sheet: LoadedSheet,
): Promise<LoadedSheet> {
  const missing = INTAKE_HEADERS.filter((header) => sheet.headerIndex[header] === undefined)
  if (missing.length === 0) return sheet

  const newHeaders = [...sheet.headers, ...missing]
  const range = `${quoteSheetName(INTAKE_SHEET_NAME)}!A1:${columnLetter(newHeaders.length - 1)}1`
  await updateValues(accessToken, spreadsheetId, range, [newHeaders])

  await recordSchemaVersion(accessToken, spreadsheetId, INTAKE_SCHEMA_VERSION, 'intakeSchemaVersion').catch(
    (error) => {
      console.error('[intakes] intakeSchemaVersion 기록 실패(무시하고 계속 진행)', error)
    },
  )

  return { headers: newHeaders, headerIndex: buildHeaderIndex(newHeaders), rows: sheet.rows }
}

async function loadWritableSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const sheet = await loadSheet(accessToken, spreadsheetId)
  return ensureHeaders(accessToken, spreadsheetId, sheet)
}

function rowToRecord(row: string[], headerIndex: Partial<Record<IntakeHeader, number>>): IntakeRecord {
  const get = (header: IntakeHeader): string => {
    const index = headerIndex[header]
    if (index === undefined) return ''
    const value = row[index]
    return value === undefined || value === null ? '' : String(value)
  }
  return {
    intakeId: get('intakeId'),
    tenantId: get('tenantId'),
    applicantType: get('applicantType'),
    applicantName: get('applicantName'),
    relationToStudent: get('relationToStudent'),
    schoolYear: get('schoolYear'),
    grade: get('grade'),
    class: get('class'),
    studentNumber: get('studentNumber'),
    name: get('name'),
    topic: get('topic'),
    content: get('content'),
    preferredTime: get('preferredTime'),
    urgency: get('urgency'),
    contactInfo: get('contactInfo'),
    privacyConsent: get('privacyConsent'),
    note: get('note'),
    studentUuid: get('studentUuid'),
    status: get('status'),
    submittedAt: get('submittedAt'),
    updatedAt: get('updatedAt'),
  }
}

function recordToRow(record: IntakeRecord, headers: string[]): string[] {
  const byHeader = record as unknown as Record<string, string>
  return headers.map((header) => byHeader[header] ?? '')
}

/** 최신 제출 우선(submittedAt 내림차순). ISO 문자열이므로 문자열 비교로 충분하다. */
function compareIntakes(a: IntakeRecord, b: IntakeRecord): number {
  return b.submittedAt.localeCompare(a.submittedAt)
}

export interface ListIntakesOptions {
  status?: string
  /** 학생명/신청자명 부분 일치 검색(공백 무시). */
  q?: string
}

export async function listIntakes(
  accessToken: string,
  spreadsheetId: string,
  options: ListIntakesOptions = {},
): Promise<IntakeRecord[]> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  let records = sheet.rows.map((row) => rowToRecord(row, sheet.headerIndex))

  if (options.status) records = records.filter((intake) => intake.status === options.status)
  if (options.q) {
    const query = options.q.trim().replace(/\s+/g, '').toLowerCase()
    records = records.filter((intake) => {
      const haystack = `${intake.name}${intake.applicantName}`.replace(/\s+/g, '').toLowerCase()
      return haystack.includes(query)
    })
  }

  return records.sort(compareIntakes)
}

export async function getIntake(
  accessToken: string,
  spreadsheetId: string,
  intakeId: string,
): Promise<IntakeRecord | null> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.intakeId
  if (idColumn === undefined) return null
  const row = sheet.rows.find((row) => row[idColumn] === intakeId)
  return row ? rowToRecord(row, sheet.headerIndex) : null
}

export interface CreateIntakeInput {
  tenantId: string
  applicantType: string
  applicantName: string
  relationToStudent: string
  schoolYear: string
  grade: string
  class: string
  studentNumber: string
  name: string
  topic: string
  content: string
  preferredTime: string
  urgency: string
  contactInfo: string
  privacyConsent: string
  note: string
}

/** 공개 상담신청 제출(POST /api/public/intakes/:schoolPublicId). 항상 status='신규'로 생성한다. */
export async function createIntake(
  accessToken: string,
  spreadsheetId: string,
  input: CreateIntakeInput,
): Promise<IntakeRecord> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const now = new Date().toISOString()
  const record: IntakeRecord = {
    intakeId: crypto.randomUUID(),
    tenantId: input.tenantId,
    applicantType: input.applicantType,
    applicantName: input.applicantName,
    relationToStudent: input.relationToStudent,
    schoolYear: input.schoolYear,
    grade: input.grade,
    class: input.class,
    studentNumber: input.studentNumber,
    name: input.name,
    topic: input.topic,
    content: input.content,
    preferredTime: input.preferredTime,
    urgency: input.urgency,
    contactInfo: input.contactInfo,
    privacyConsent: input.privacyConsent,
    note: input.note,
    studentUuid: '',
    status: INTAKE_STATUS_NEW,
    submittedAt: now,
    updatedAt: now,
  }
  const row = recordToRow(record, sheet.headers)
  await appendValues(accessToken, spreadsheetId, `${quoteSheetName(INTAKE_SHEET_NAME)}!A1`, [row])
  return record
}

export type TransitionIntakeStatusResult =
  | { ok: true; intake: IntakeRecord }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'invalid_transition'; currentStatus: string }

/**
 * 상태 전이를 원자적으로(같은 행을 다시 읽고 확인 후 쓰기) 처리한다. `allowedFrom`에
 * 없는 현재 상태면 거부한다 — 예: 이미 `승인`/`반려`된 접수를 다시 승인/반려하지
 * 않는다(counseling-workflow-v1.md 5절 규칙5 "승인 처리는 멱등이어야 한다"와 동일한
 * 원칙을 검토/승인/반려 전체에 적용).
 */
export async function transitionIntakeStatus(
  accessToken: string,
  spreadsheetId: string,
  intakeId: string,
  allowedFrom: readonly string[],
  to: string,
): Promise<TransitionIntakeStatusResult> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.intakeId
  if (idColumn === undefined) return { ok: false, error: 'not_found' }

  const rowOffset = sheet.rows.findIndex((row) => row[idColumn] === intakeId)
  if (rowOffset === -1) return { ok: false, error: 'not_found' }

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  if (!allowedFrom.includes(current.status)) {
    return { ok: false, error: 'invalid_transition', currentStatus: current.status }
  }

  const updated: IntakeRecord = { ...current, status: to, updatedAt: new Date().toISOString() }
  const row = recordToRow(updated, sheet.headers)

  const sheetRowNumber = rowOffset + 2 // 1행은 헤더, 이후 1-based 행 번호
  const range = `${quoteSheetName(INTAKE_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, intake: updated }
}

export type ApproveIntakeResult =
  | { ok: true; intake: IntakeRecord; alreadyApproved: boolean }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'invalid_transition'; currentStatus: string }

/**
 * 상담접수 승인 전용 갱신 — `status`와 `studentUuid`를 한 번에 쓴다(승인 시 학생
 * 매칭/생성 결과를 상담접수 행에도 남겨야 하므로 `transitionIntakeStatus`만으로는
 * 부족하다). 이미 `승인` 상태면 다시 쓰지 않고 그대로 반환한다(alreadyApproved=true) —
 * 승인 재시도 시 학생/케이스/동의를 다시 만들지 않는다는 원칙(counseling-workflow-v1.md
 * 5절 규칙5)을 상담접수 행 자체의 갱신에도 동일하게 적용한다. `반려`된 접수는 승인할
 * 수 없다.
 */
export async function approveIntakeWithStudent(
  accessToken: string,
  spreadsheetId: string,
  intakeId: string,
  studentUuid: string,
): Promise<ApproveIntakeResult> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.intakeId
  if (idColumn === undefined) return { ok: false, error: 'not_found' }

  const rowOffset = sheet.rows.findIndex((row) => row[idColumn] === intakeId)
  if (rowOffset === -1) return { ok: false, error: 'not_found' }

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)

  if (current.status === INTAKE_STATUS_APPROVED) {
    return { ok: true, intake: current, alreadyApproved: true }
  }
  if (!(INTAKE_STATUS_NEW === current.status || INTAKE_STATUS_REVIEWING === current.status)) {
    return { ok: false, error: 'invalid_transition', currentStatus: current.status }
  }

  const updated: IntakeRecord = {
    ...current,
    status: INTAKE_STATUS_APPROVED,
    studentUuid,
    updatedAt: new Date().toISOString(),
  }
  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(INTAKE_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, intake: updated, alreadyApproved: false }
}
