import { appendValues, getValues, updateValues } from './googleSheets'
import { recordSchemaVersion, CONSENT_SCHEMA_VERSION } from './settingsSheet'

/**
 * legacy `보호자동의` 탭(counseling-manager/code.gs.txt:3026-3046 필드,
 * markConsentSent/confirmGuardianConsent가 쓰는 상태값)과 동일한 개념을 옮긴다.
 * 기존 8개 컬럼(consentId/tenantId/intakeId/caseId/consentToken/status/
 * requestedAt/respondedAt) 이름은 바꾸지 않는다. `짧은코드`(legacy `?k=` 단축링크)는
 * 옮기지 않는다 — 그 라우팅 자체가 legacy에서도 깨져 있던 것으로 이미 확인됐고
 * (docs/intake-migration-spec.md 8.2절), 이번 플랫폼은 `/consent/{consentToken}`
 * 하나만 쓰기로 설계돼 있다.
 */
export const CONSENT_SHEET_NAME = '보호자동의'

export const CONSENT_HEADERS = [
  'consentId',
  'tenantId',
  'intakeId',
  'caseId',
  'studentUuid',
  'consentToken',
  'status',
  'guardianName',
  'relationToStudent',
  'guardianContact',
  'studentAssent',
  'counselingConsent',
  'personalInfoConsent',
  'sensitiveInfoConsent',
  'diagnosisUseConsent',
  'aiNoticeConfirmed',
  'requestedAt',
  'respondedAt',
  'consentedAt',
  'consentPdfUrl',
  'confirmedAt',
  'confirmedBy',
  'note',
  'createdAt',
  'updatedAt',
] as const

type ConsentHeader = (typeof CONSENT_HEADERS)[number]

export interface ConsentRecord {
  consentId: string
  tenantId: string
  intakeId: string
  caseId: string
  studentUuid: string
  /** 비어있으면 아직 "동의 링크 생성" 전(legacy와 동일 — 승인 시점엔 항상 빈 값). */
  consentToken: string
  status: string
  guardianName: string
  relationToStudent: string
  guardianContact: string
  studentAssent: string
  counselingConsent: string
  personalInfoConsent: string
  sensitiveInfoConsent: string
  diagnosisUseConsent: string
  aiNoticeConfirmed: string
  /** legacy 발송일. */
  requestedAt: string
  /** legacy 제출일시(동의/비동의 공통, 제출 시점에 항상 채움). */
  respondedAt: string
  /** legacy 동의일(동의를 선택했을 때만 채움, 비동의면 빈 값). */
  consentedAt: string
  consentPdfUrl: string
  confirmedAt: string
  confirmedBy: string
  note: string
  createdAt: string
  updatedAt: string
}

/** legacy 확인상태 5가지 값(counseling-manager/code.gs.txt 3038,3669,3768 / intake-consent 156) 그대로. */
export const CONSENT_STATUS_NOT_SENT = '미발송'
export const CONSENT_STATUS_REQUESTED = '동의 요청'
export const CONSENT_STATUS_NEEDS_REVIEW = '교사 확인 필요'
export const CONSENT_STATUS_CONFIRMED = '동의 완료'
export const CONSENT_STATUS_DECLINED = '비동의'
export const CONSENT_STATUS_VALUES = [
  CONSENT_STATUS_NOT_SENT,
  CONSENT_STATUS_REQUESTED,
  CONSENT_STATUS_NEEDS_REVIEW,
  CONSENT_STATUS_CONFIRMED,
  CONSENT_STATUS_DECLINED,
] as const

/** 미확인 항목 공통 기본값(legacy: 학생참여의사/상담동의/개인정보동의/민감정보동의/진단결과활용동의/AI보조안내확인). */
export const CONSENT_ITEM_UNCONFIRMED = '미확인'

/** "보호자동의" 탭이 아예 없거나 consentId 헤더 자체를 찾을 수 없을 때. */
export class ConsentSheetSchemaError extends Error {
  constructor(public readonly missingHeaders: string[]) {
    super(`consent sheet missing headers: ${missingHeaders.join(', ')}`)
    this.name = 'ConsentSheetSchemaError'
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
  headerIndex: Partial<Record<ConsentHeader, number>>
  rows: string[][]
}

function buildHeaderIndex(headers: string[]): Partial<Record<ConsentHeader, number>> {
  const headerIndex: Partial<Record<ConsentHeader, number>> = {}
  headers.forEach((header, index) => {
    if ((CONSENT_HEADERS as readonly string[]).includes(header)) {
      headerIndex[header as ConsentHeader] = index
    }
  })
  return headerIndex
}

async function loadSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const range = `${quoteSheetName(CONSENT_SHEET_NAME)}!A1:Z`
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
  const missing = CONSENT_HEADERS.filter((header) => sheet.headerIndex[header] === undefined)
  if (missing.length === 0) return sheet

  const newHeaders = [...sheet.headers, ...missing]
  const range = `${quoteSheetName(CONSENT_SHEET_NAME)}!A1:${columnLetter(newHeaders.length - 1)}1`
  await updateValues(accessToken, spreadsheetId, range, [newHeaders])

  await recordSchemaVersion(accessToken, spreadsheetId, CONSENT_SCHEMA_VERSION, 'consentSchemaVersion').catch(
    (error) => {
      console.error('[consents] consentSchemaVersion 기록 실패(무시하고 계속 진행)', error)
    },
  )

  return { headers: newHeaders, headerIndex: buildHeaderIndex(newHeaders), rows: sheet.rows }
}

async function loadWritableSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const sheet = await loadSheet(accessToken, spreadsheetId)
  return ensureHeaders(accessToken, spreadsheetId, sheet)
}

function rowToRecord(row: string[], headerIndex: Partial<Record<ConsentHeader, number>>): ConsentRecord {
  const get = (header: ConsentHeader): string => {
    const index = headerIndex[header]
    if (index === undefined) return ''
    const value = row[index]
    return value === undefined || value === null ? '' : String(value)
  }
  return {
    consentId: get('consentId'),
    tenantId: get('tenantId'),
    intakeId: get('intakeId'),
    caseId: get('caseId'),
    studentUuid: get('studentUuid'),
    consentToken: get('consentToken'),
    status: get('status'),
    guardianName: get('guardianName'),
    relationToStudent: get('relationToStudent'),
    guardianContact: get('guardianContact'),
    studentAssent: get('studentAssent'),
    counselingConsent: get('counselingConsent'),
    personalInfoConsent: get('personalInfoConsent'),
    sensitiveInfoConsent: get('sensitiveInfoConsent'),
    diagnosisUseConsent: get('diagnosisUseConsent'),
    aiNoticeConfirmed: get('aiNoticeConfirmed'),
    requestedAt: get('requestedAt'),
    respondedAt: get('respondedAt'),
    consentedAt: get('consentedAt'),
    consentPdfUrl: get('consentPdfUrl'),
    confirmedAt: get('confirmedAt'),
    confirmedBy: get('confirmedBy'),
    note: get('note'),
    createdAt: get('createdAt'),
    updatedAt: get('updatedAt'),
  }
}

function recordToRow(record: ConsentRecord, headers: string[]): string[] {
  const byHeader = record as unknown as Record<string, string>
  return headers.map((header) => byHeader[header] ?? '')
}

/** 승인 재시도 시 이미 만든 동의 레코드를 재사용하기 위한 조회(중복 생성 방지). */
export async function findConsentByCaseId(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
): Promise<ConsentRecord | null> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.caseId
  if (idColumn === undefined) return null
  const row = sheet.rows.find((row) => row[idColumn] === caseId)
  return row ? rowToRecord(row, sheet.headerIndex) : null
}

export interface CreateConsentSkeletonInput {
  tenantId: string
  intakeId: string
  caseId: string
  studentUuid: string
  /** legacy normalizeContactValue_(접수 연락처) — 보호자동의 링크 생성 전에도 연락 수단으로 미리 채워둔다. */
  guardianContact: string
}

/**
 * 상담접수 승인 시에만 호출한다. legacy `createCaseFromIntakeRow_`가 만드는 골격과
 * 동일하게 — 동의 링크는 아직 만들지 않는다(consentToken=''), 확인상태는 '미발송',
 * 나머지 동의 항목은 전부 '미확인'.
 */
export async function createConsentSkeleton(
  accessToken: string,
  spreadsheetId: string,
  input: CreateConsentSkeletonInput,
): Promise<ConsentRecord> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const now = new Date().toISOString()
  const record: ConsentRecord = {
    consentId: crypto.randomUUID(),
    tenantId: input.tenantId,
    intakeId: input.intakeId,
    caseId: input.caseId,
    studentUuid: input.studentUuid,
    consentToken: '',
    status: CONSENT_STATUS_NOT_SENT,
    guardianName: '',
    relationToStudent: '',
    guardianContact: input.guardianContact,
    studentAssent: CONSENT_ITEM_UNCONFIRMED,
    counselingConsent: CONSENT_ITEM_UNCONFIRMED,
    personalInfoConsent: CONSENT_ITEM_UNCONFIRMED,
    sensitiveInfoConsent: CONSENT_ITEM_UNCONFIRMED,
    diagnosisUseConsent: CONSENT_ITEM_UNCONFIRMED,
    aiNoticeConfirmed: CONSENT_ITEM_UNCONFIRMED,
    requestedAt: '',
    respondedAt: '',
    consentedAt: '',
    consentPdfUrl: '',
    confirmedAt: '',
    confirmedBy: '',
    note: '',
    createdAt: now,
    updatedAt: now,
  }
  const row = recordToRow(record, sheet.headers)
  await appendValues(accessToken, spreadsheetId, `${quoteSheetName(CONSENT_SHEET_NAME)}!A1`, [row])
  return record
}
