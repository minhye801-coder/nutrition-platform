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
export const CONSENT_ITEM_AGREED = '동의'
export const CONSENT_ITEM_DECLINED = '비동의'

/** legacy `saveStudentAssent`(counseling-manager/code.gs.txt:3682, Index.html:1623)와 동일한 4개 값. */
export const STUDENT_ASSENT_UNCONFIRMED = '미확인'
export const STUDENT_ASSENT_WILLING = '참여 희망'
export const STUDENT_ASSENT_PENDING_EXPLANATION = '설명 후 결정'
export const STUDENT_ASSENT_UNWILLING = '참여하지 않음'
export const STUDENT_ASSENT_VALUES = [
  STUDENT_ASSENT_UNCONFIRMED,
  STUDENT_ASSENT_WILLING,
  STUDENT_ASSENT_PENDING_EXPLANATION,
  STUDENT_ASSENT_UNWILLING,
] as const

/** 보호자 제출 시 선택하는 두 값(intake-consent/code.gs.txt:110-181 `decision`). */
export const CONSENT_DECISION_AGREE = '동의'
export const CONSENT_DECISION_DECLINE = '비동의'

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

/** 관리 화면(`/consents`) 목록용 — 필터 없이 전체를 반환한다(케이스/학생 컨텍스트는 호출부에서 합친다). */
export async function listConsents(accessToken: string, spreadsheetId: string): Promise<ConsentRecord[]> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  return sheet.rows.map((row) => rowToRecord(row, sheet.headerIndex))
}

/** 공개 보호자동의 페이지(`/consent/:token`)가 토큰 하나만으로 레코드를 찾을 때 쓴다. */
export async function findConsentByToken(
  accessToken: string,
  spreadsheetId: string,
  token: string,
): Promise<ConsentRecord | null> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const tokenColumn = sheet.headerIndex.consentToken
  if (tokenColumn === undefined) return null
  const row = sheet.rows.find((row) => row[tokenColumn] === token)
  return row ? rowToRecord(row, sheet.headerIndex) : null
}

/**
 * `{schoolPublicId}.{32자 hex}` 형태로 만든다. 이번 플랫폼은 멀티테넌트라 `/consent/:token`
 * 라우트에 schoolPublicId가 없으므로(route-and-menu-plan.md 확정), 토큰 자체에 어느 학교
 * 스프레드시트를 찾아야 하는지 실어 보낸다(consentApiHelpers.ts의 parseConsentToken이 다시
 * 분리). schoolPublicId는 이미 `/intake/:schoolPublicId` 공개 링크에도 그대로 노출되는
 * 값이라 새로 감출 게 못 된다 — 유효기간 없는 토큰 설계(counseling-workflow-v1.md 7절
 * 미결정2, 사용자 확인 후 "만료 없음"으로 확정)와도 무관하게 안전하다.
 */
export function buildConsentToken(schoolPublicId: string): string {
  return `${schoolPublicId}.${crypto.randomUUID().replace(/-/g, '')}`
}

export type SendConsentResult =
  | { ok: true; consent: ConsentRecord; alreadySent: boolean }
  | { ok: false; error: 'not_found' }

/**
 * 동의 링크 생성 + 발송 처리(POST /api/cases/:caseId/consent/send)를 한 번에 한다 — legacy는
 * `generateConsentLink`/`markConsentSent` 두 액션이었지만, v1은 feature-priority-v1.md 3절
 * 확정안대로 하나로 합친다("링크 발송" 버튼 하나). 멱등: 이미 `미발송`이 아니면(=이미 한 번
 * 보냈으면) 아무것도 바꾸지 않고 기존 레코드를 그대로 반환한다(alreadySent=true) — 재발송/토큰
 * 재발급은 이번 범위에 없다.
 */
export async function generateAndSendConsentLink(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
  schoolPublicId: string,
): Promise<SendConsentResult> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const caseColumn = sheet.headerIndex.caseId
  if (caseColumn === undefined) return { ok: false, error: 'not_found' }
  const rowOffset = sheet.rows.findIndex((row) => row[caseColumn] === caseId)
  if (rowOffset === -1) return { ok: false, error: 'not_found' }

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  if (current.status !== CONSENT_STATUS_NOT_SENT) {
    return { ok: true, consent: current, alreadySent: true }
  }

  const now = new Date().toISOString()
  const updated: ConsentRecord = {
    ...current,
    consentToken: current.consentToken || buildConsentToken(schoolPublicId),
    status: CONSENT_STATUS_REQUESTED,
    requestedAt: current.requestedAt || now,
    updatedAt: now,
  }
  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(CONSENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, consent: updated, alreadySent: false }
}

export interface SubmitConsentInput {
  guardianName: string
  relationToStudent: string
  guardianContact: string
  decision: typeof CONSENT_DECISION_AGREE | typeof CONSENT_DECISION_DECLINE
  /** legacy `signatureName` — 보호자명과 공백/대소문자 무시하고 일치해야 한다(전자서명 확인). */
  signatureName: string
  counselingConsent?: boolean
  personalInfoConsent?: boolean
  sensitiveInfoConsent?: boolean
  diagnosisUseConsent?: boolean
  aiNoticeConfirmed?: boolean
}

export type SubmitConsentResult =
  | { ok: true; consent: ConsentRecord }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'already_submitted' }
  | { ok: false; error: 'signature_mismatch' }
  | { ok: false; error: 'items_incomplete' }

function normalizeGuardianName(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase()
}

/**
 * 보호자 제출(POST /api/public/consents/:token) — `동의 요청` 상태일 때만 받는다(그 전엔
 * 토큰이 아직 안 만들어졌고, 그 후엔 이미 제출된 것이므로 재제출 거부). `동의`일 때만
 * 5개 필수 항목 전부 확인을 요구한다(intake-migration-spec.md 8.4절) — `비동의`는 항목
 * 체크 없이도 제출 가능. PDF 생성은 이번 범위에 없다(별도 결정 필요, platform-v1-architecture.md
 * Apps Script 보조 서비스 미구현) — legacy도 PDF 실패 시 동의 데이터 자체는 저장했던 것과
 * 같은 원칙으로, 동의 데이터 저장을 PDF 유무에 의존시키지 않는다.
 */
export async function submitConsent(
  accessToken: string,
  spreadsheetId: string,
  token: string,
  input: SubmitConsentInput,
): Promise<SubmitConsentResult> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const tokenColumn = sheet.headerIndex.consentToken
  if (tokenColumn === undefined) return { ok: false, error: 'not_found' }
  const rowOffset = sheet.rows.findIndex((row) => row[tokenColumn] === token)
  if (rowOffset === -1) return { ok: false, error: 'not_found' }

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  if (current.status !== CONSENT_STATUS_REQUESTED) {
    return { ok: false, error: 'already_submitted' }
  }
  if (normalizeGuardianName(input.guardianName) !== normalizeGuardianName(input.signatureName)) {
    return { ok: false, error: 'signature_mismatch' }
  }

  const now = new Date().toISOString()
  const base = {
    ...current,
    guardianName: input.guardianName,
    relationToStudent: input.relationToStudent,
    guardianContact: input.guardianContact,
    respondedAt: now,
    updatedAt: now,
  }

  let updated: ConsentRecord
  if (input.decision === CONSENT_DECISION_AGREE) {
    if (
      !input.counselingConsent ||
      !input.personalInfoConsent ||
      !input.sensitiveInfoConsent ||
      !input.diagnosisUseConsent ||
      !input.aiNoticeConfirmed
    ) {
      return { ok: false, error: 'items_incomplete' }
    }
    updated = {
      ...base,
      counselingConsent: CONSENT_ITEM_AGREED,
      personalInfoConsent: CONSENT_ITEM_AGREED,
      sensitiveInfoConsent: CONSENT_ITEM_AGREED,
      diagnosisUseConsent: CONSENT_ITEM_AGREED,
      aiNoticeConfirmed: CONSENT_ITEM_AGREED,
      status: CONSENT_STATUS_NEEDS_REVIEW,
      consentedAt: now,
    }
  } else {
    updated = {
      ...base,
      counselingConsent: CONSENT_ITEM_DECLINED,
      personalInfoConsent: CONSENT_ITEM_DECLINED,
      sensitiveInfoConsent: CONSENT_ITEM_DECLINED,
      diagnosisUseConsent: CONSENT_ITEM_DECLINED,
      aiNoticeConfirmed: CONSENT_ITEM_DECLINED,
      status: CONSENT_STATUS_DECLINED,
      consentedAt: '',
    }
  }

  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(CONSENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, consent: updated }
}

export type ConfirmConsentResult =
  | { ok: true; consent: ConsentRecord; alreadyConfirmed: boolean }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'invalid_transition'; currentStatus: string }

/**
 * 교사 최종 확인(POST /api/cases/:caseId/consent/confirm) — `교사 확인 필요` 상태에서만
 * 통과한다. 5개 필수 항목이 전부 `동의`인지는 여기서 다시 검사하지 않는다 — submitConsent가
 * `동의`로 제출될 때만 상태를 `교사 확인 필요`로 만들므로, 그 상태 자체가 이미 그 불변식을
 * 보장한다(비동의 제출은 곧장 `비동의` 상태가 되어 이 함수의 대상이 아니다).
 * 이미 `동의 완료`면 멱등 응답만 돌려준다.
 */
export async function confirmConsent(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
  confirmedBy: string,
): Promise<ConfirmConsentResult> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const caseColumn = sheet.headerIndex.caseId
  if (caseColumn === undefined) return { ok: false, error: 'not_found' }
  const rowOffset = sheet.rows.findIndex((row) => row[caseColumn] === caseId)
  if (rowOffset === -1) return { ok: false, error: 'not_found' }

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  if (current.status === CONSENT_STATUS_CONFIRMED) {
    return { ok: true, consent: current, alreadyConfirmed: true }
  }
  if (current.status !== CONSENT_STATUS_NEEDS_REVIEW) {
    return { ok: false, error: 'invalid_transition', currentStatus: current.status }
  }

  const now = new Date().toISOString()
  const updated: ConsentRecord = {
    ...current,
    status: CONSENT_STATUS_CONFIRMED,
    confirmedAt: now,
    confirmedBy,
    updatedAt: now,
  }
  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(CONSENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, consent: updated, alreadyConfirmed: false }
}

export type SaveStudentAssentResult = { ok: true; consent: ConsentRecord } | { ok: false; error: 'not_found' }

/**
 * "학생 참여 의사" 저장(POST /api/cases/:caseId/consent/assent) — legacy `saveStudentAssent`
 * (counseling-manager/code.gs.txt:3682-3702)와 동일하게 보호자 제출/교사 확인과 완전히
 * 독립적인 액션이다. 상태 전이나 다른 필드에는 영향을 주지 않는다.
 */
export async function saveStudentAssent(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
  studentAssent: string,
): Promise<SaveStudentAssentResult> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const caseColumn = sheet.headerIndex.caseId
  if (caseColumn === undefined) return { ok: false, error: 'not_found' }
  const rowOffset = sheet.rows.findIndex((row) => row[caseColumn] === caseId)
  if (rowOffset === -1) return { ok: false, error: 'not_found' }

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  const updated: ConsentRecord = { ...current, studentAssent, updatedAt: new Date().toISOString() }
  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(CONSENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, consent: updated }
}

/**
 * 제출 직후 PDF 생성이 끝난 뒤(best-effort) 결과만 따로 기록한다 — legacy도 PDF 생성
 * 실패 시 동의 데이터 자체는 그대로 저장되는 것과 같은 원칙(intake-consent/
 * code.gs.txt:160-168). 토큰이 아니라 caseId로 찾는다(제출 직후 호출부가 caseId를
 * 이미 알고 있음).
 */
export async function setConsentPdfUrl(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
  consentPdfUrl: string,
): Promise<void> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const caseColumn = sheet.headerIndex.caseId
  if (caseColumn === undefined) return
  const rowOffset = sheet.rows.findIndex((row) => row[caseColumn] === caseId)
  if (rowOffset === -1) return

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  const updated: ConsentRecord = { ...current, consentPdfUrl, updatedAt: new Date().toISOString() }
  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(CONSENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
}
