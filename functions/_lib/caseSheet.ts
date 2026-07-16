import { appendValues, getValues, updateValues } from './googleSheets'
import { recordSchemaVersion, CASE_SCHEMA_VERSION } from './settingsSheet'

/**
 * legacy `상담케이스` 탭(counseling-manager/code.gs.txt:3013-3024 필드,
 * CASE_STATUS_VALUES:54-63)과 동일한 개념을 그대로 옮긴다. 기존에 이미 있던 6개
 * 컬럼(caseId/tenantId/studentUuid/status/openedAt/closedAt) 이름은 바꾸지 않고,
 * legacy에 있고 우리 스키마엔 없던 필드만 뒤에 추가한다(installTemplate.ts 최소
 * 골격 → 이 파일의 ensureHeaders가 기존 설치를 자가치유).
 */
export const CASE_SHEET_NAME = '상담케이스'

export const CASE_HEADERS = [
  'caseId',
  'tenantId',
  'studentUuid',
  'intakeId',
  'schoolYear',
  'topic',
  'referralType',
  'status',
  'nextScheduledAt',
  'managerEmail',
  'driveFolderUrl',
  'openedAt',
  'closedAt',
  'note',
  'createdAt',
  'updatedAt',
] as const

type CaseHeader = (typeof CASE_HEADERS)[number]

export interface CaseRecord {
  caseId: string
  tenantId: string
  studentUuid: string
  /** 이 케이스를 만든 상담접수 건. 승인 재시도 시 이 값으로 기존 케이스를 찾는다. */
  intakeId: string
  schoolYear: string
  /** legacy 주상담주제. */
  topic: string
  /** legacy 신청경로(=접수 시 신청자유형). */
  referralType: string
  /** legacy 현재단계. CASE_STATUS_VALUES 중 하나. */
  status: string
  nextScheduledAt: string
  managerEmail: string
  /** legacy Drive폴더URL — 케이스 전용 Drive 폴더(functions/_lib/caseFolder.ts). */
  driveFolderUrl: string
  /** legacy 접수일(케이스 생성일이 아니라 원본 상담접수 제출일). */
  openedAt: string
  closedAt: string
  note: string
  createdAt: string
  updatedAt: string
}

/** legacy CASE_STATUS_VALUES(counseling-manager/code.gs.txt:54-63)와 동일한 8단계, 동일한 순서. */
export const CASE_STATUS_CONSENT_PENDING = '동의 대기'
export const CASE_STATUS_DIAGNOSIS_PENDING = '진단 대기'
export const CASE_STATUS_RESULT_CHECK = '결과 확인'
export const CASE_STATUS_SESSION_SCHEDULED = '상담 예정'
export const CASE_STATUS_IN_PRACTICE = '실천 중'
export const CASE_STATUS_FOLLOWUP_SCHEDULED = '추적상담 예정'
export const CASE_STATUS_CLOSURE_REVIEW = '종결 검토'
export const CASE_STATUS_CLOSED = '종결'
export const CASE_STATUS_VALUES = [
  CASE_STATUS_CONSENT_PENDING,
  CASE_STATUS_DIAGNOSIS_PENDING,
  CASE_STATUS_RESULT_CHECK,
  CASE_STATUS_SESSION_SCHEDULED,
  CASE_STATUS_IN_PRACTICE,
  CASE_STATUS_FOLLOWUP_SCHEDULED,
  CASE_STATUS_CLOSURE_REVIEW,
  CASE_STATUS_CLOSED,
] as const

/** "상담케이스" 탭이 아예 없거나 caseId 헤더 자체를 찾을 수 없을 때. */
export class CaseSheetSchemaError extends Error {
  constructor(public readonly missingHeaders: string[]) {
    super(`case sheet missing headers: ${missingHeaders.join(', ')}`)
    this.name = 'CaseSheetSchemaError'
  }
}

function quoteSheetName(name: string): string {
  return `'${name}'`
}

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
  headerIndex: Partial<Record<CaseHeader, number>>
  rows: string[][]
}

function buildHeaderIndex(headers: string[]): Partial<Record<CaseHeader, number>> {
  const headerIndex: Partial<Record<CaseHeader, number>> = {}
  headers.forEach((header, index) => {
    if ((CASE_HEADERS as readonly string[]).includes(header)) {
      headerIndex[header as CaseHeader] = index
    }
  })
  return headerIndex
}

async function loadSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const range = `${quoteSheetName(CASE_SHEET_NAME)}!A1:Z`
  const values = await getValues(accessToken, spreadsheetId, range)
  const headers = values[0] ?? []
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== ''))
  return { headers, headerIndex: buildHeaderIndex(headers), rows }
}

/** intakeSheet.ts의 ensureHeaders와 동일한 자가-치유 패턴. */
async function ensureHeaders(
  accessToken: string,
  spreadsheetId: string,
  sheet: LoadedSheet,
): Promise<LoadedSheet> {
  const missing = CASE_HEADERS.filter((header) => sheet.headerIndex[header] === undefined)
  if (missing.length === 0) return sheet

  const newHeaders = [...sheet.headers, ...missing]
  const range = `${quoteSheetName(CASE_SHEET_NAME)}!A1:${columnLetter(newHeaders.length - 1)}1`
  await updateValues(accessToken, spreadsheetId, range, [newHeaders])

  await recordSchemaVersion(accessToken, spreadsheetId, CASE_SCHEMA_VERSION, 'caseSchemaVersion').catch((error) => {
    console.error('[cases] caseSchemaVersion 기록 실패(무시하고 계속 진행)', error)
  })

  return { headers: newHeaders, headerIndex: buildHeaderIndex(newHeaders), rows: sheet.rows }
}

async function loadWritableSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const sheet = await loadSheet(accessToken, spreadsheetId)
  return ensureHeaders(accessToken, spreadsheetId, sheet)
}

function rowToRecord(row: string[], headerIndex: Partial<Record<CaseHeader, number>>): CaseRecord {
  const get = (header: CaseHeader): string => {
    const index = headerIndex[header]
    if (index === undefined) return ''
    const value = row[index]
    return value === undefined || value === null ? '' : String(value)
  }
  return {
    caseId: get('caseId'),
    tenantId: get('tenantId'),
    studentUuid: get('studentUuid'),
    intakeId: get('intakeId'),
    schoolYear: get('schoolYear'),
    topic: get('topic'),
    referralType: get('referralType'),
    status: get('status'),
    nextScheduledAt: get('nextScheduledAt'),
    managerEmail: get('managerEmail'),
    driveFolderUrl: get('driveFolderUrl'),
    openedAt: get('openedAt'),
    closedAt: get('closedAt'),
    note: get('note'),
    createdAt: get('createdAt'),
    updatedAt: get('updatedAt'),
  }
}

function recordToRow(record: CaseRecord, headers: string[]): string[] {
  const byHeader = record as unknown as Record<string, string>
  return headers.map((header) => byHeader[header] ?? '')
}

/** 승인 재시도 시 이미 만든 케이스를 재사용하기 위한 조회(중복 생성 방지). */
export async function findCaseByIntakeId(
  accessToken: string,
  spreadsheetId: string,
  intakeId: string,
): Promise<CaseRecord | null> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.intakeId
  if (idColumn === undefined) return null
  const row = sheet.rows.find((row) => row[idColumn] === intakeId)
  return row ? rowToRecord(row, sheet.headerIndex) : null
}

/** `/consents` 관리 화면이 케이스 컨텍스트(주제/현재단계)를 같이 보여줄 때 쓴다. */
export async function listCases(accessToken: string, spreadsheetId: string): Promise<CaseRecord[]> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  return sheet.rows.map((row) => rowToRecord(row, sheet.headerIndex))
}

export async function getCase(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
): Promise<CaseRecord | null> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.caseId
  if (idColumn === undefined) return null
  const row = sheet.rows.find((row) => row[idColumn] === caseId)
  return row ? rowToRecord(row, sheet.headerIndex) : null
}

export interface CreateCaseInput {
  /** 케이스 전용 Drive 폴더 경로에 쓰이므로(caseFolder.ts) 시트에 쓰기 전에 호출부가 먼저 발급한다. */
  caseId: string
  tenantId: string
  studentUuid: string
  intakeId: string
  schoolYear: string
  topic: string
  referralType: string
  managerEmail: string
  driveFolderUrl: string
  /** legacy 접수일(케이스 생성 시각이 아니라 원본 상담접수 제출일). */
  openedAt: string
}

/** 상담접수 승인 시에만 호출한다. 항상 status=CASE_STATUS_CONSENT_PENDING('동의 대기')로 생성한다(legacy와 동일). */
export async function createCase(
  accessToken: string,
  spreadsheetId: string,
  input: CreateCaseInput,
): Promise<CaseRecord> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const now = new Date().toISOString()
  const record: CaseRecord = {
    caseId: input.caseId,
    tenantId: input.tenantId,
    studentUuid: input.studentUuid,
    intakeId: input.intakeId,
    schoolYear: input.schoolYear,
    topic: input.topic,
    referralType: input.referralType,
    status: CASE_STATUS_CONSENT_PENDING,
    nextScheduledAt: '',
    managerEmail: input.managerEmail,
    driveFolderUrl: input.driveFolderUrl,
    openedAt: input.openedAt,
    closedAt: '',
    note: '',
    createdAt: now,
    updatedAt: now,
  }
  const row = recordToRow(record, sheet.headers)
  await appendValues(accessToken, spreadsheetId, `${quoteSheetName(CASE_SHEET_NAME)}!A1`, [row])
  return record
}

export type TransitionCaseStatusResult =
  | { ok: true; case: CaseRecord; transitioned: boolean }
  | { ok: false; error: 'not_found' }

/**
 * 보호자동의 확인 완료 시 케이스를 `동의 대기 → 진단 대기`로 자동 전이하는 용도(그 외
 * 호출부는 아직 없다). `fromStatuses`에 현재 상태가 없으면 조용히 넘어간다(transitioned=false)
 * — intake-migration-spec.md 11.5절 "케이스 상태가 이미 동의 대기가 아니면 전이하지 않아야
 * 한다"를 그대로 따른다. 이건 사용자가 직접 요청한 액션이 아니라 부수효과라서, 전이 대상이
 * 아닐 때 에러를 내지 않고 호출부(confirm 액션) 자체는 계속 성공해야 한다.
 */
export async function transitionCaseStatus(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
  fromStatuses: readonly string[],
  toStatus: string,
): Promise<TransitionCaseStatusResult> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.caseId
  if (idColumn === undefined) return { ok: false, error: 'not_found' }
  const rowOffset = sheet.rows.findIndex((row) => row[idColumn] === caseId)
  if (rowOffset === -1) return { ok: false, error: 'not_found' }

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  if (!fromStatuses.includes(current.status)) {
    return { ok: true, case: current, transitioned: false }
  }

  const now = new Date().toISOString()
  const updated: CaseRecord = { ...current, status: toStatus, updatedAt: now }
  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(CASE_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, case: updated, transitioned: true }
}
