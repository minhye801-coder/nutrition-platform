import { appendValues, getValues, updateValues } from './googleSheets'
import { recordSchemaVersion, ASSESSMENT_SCHEMA_VERSION } from './settingsSheet'

/**
 * legacy `진단결과` 탭(counseling-manager/code.gs.txt `saveDiagnosis`:4232,
 * `mapExtractedDiagnosis_`:4120, `extractDiagnosisWithGemini_`:4015)의 38개 추출
 * 필드를 그대로 옮긴다(사용자 확인 — legacy 필드 유지, "구조화 필드 없음" 결정 철회).
 * 기존에 이 세션에서 먼저 만든 17개 컬럼(assessmentId~updatedAt)은 그대로 두고
 * 오른쪽에 38개 필드 + 부가 메타데이터(fileId/extractionStatus/extractedAt/
 * extractedRawJson/warnings/responseHighlights)만 추가한다 — 삭제·이름변경 없음.
 * `extractedSummary`(자유서술 요약)는 더 이상 새로 채우지 않지만 컬럼 자체는 남긴다.
 */
export const ASSESSMENT_SHEET_NAME = '진단결과'

/**
 * legacy Gemini `responseSchema`(4046-4087줄) 34개 키에서 재식별 위험이 큰 4개
 * (studentName/schoolType/age/examDate)를 뺐다 — Gemini에는 애초에 이 값들을 요청하지
 * 않는다(functions/_lib/geminiClient.ts). `grade`는 구체적 학년 대신 학년군(초등
 * 저학년/고학년)만 받도록 `gradeBand`로 이름을 바꿨다(요구사항 10절 "학년·반·번호의
 * 구체적 조합" 전송 금지).
 */
export const ASSESSMENT_EXTRACTED_FIELDS = [
  'gradeBand',
  'sex',
  'heightCm',
  'heightPercentile',
  'weightKg',
  'weightPercentile',
  'bmi',
  'bmiPercentile',
  'subjectiveHealth',
  'bodyImage',
  'mealFrequency',
  'regularMealTime',
  'eatingSpeed',
  'mealAmount',
  'totalLevel',
  'totalScore',
  'balanceLevel',
  'balanceScore',
  'moderationLevel',
  'moderationScore',
  'practiceLevel',
  'practiceScore',
  'eatingAttitude',
  'eatingAttitudeScore',
  'allergy',
  'disease',
  'sleepLevel',
  'sleepDuration',
  'mentalHealth',
  'smartphoneUsageLevel',
  'weekdaySmartphoneHours',
  'weekendSmartphoneHours',
  'smartphoneOverdependence',
  'additionalRequest',
] as const

export type AssessmentExtractedFieldKey = (typeof ASSESSMENT_EXTRACTED_FIELDS)[number]

/** 값을 아직 채우지 않았을 때(미업로드/미확인)의 기본 레코드 — 전부 빈 문자열. */
export type AssessmentExtractedFields = Record<AssessmentExtractedFieldKey, string>

export const ASSESSMENT_HEADERS = [
  'assessmentId',
  'tenantId',
  'caseId',
  'studentUuid',
  'round',
  'timepoint',
  'fileUrl',
  'fileName',
  'uploadedAt',
  'uploadedBy',
  'status',
  'extractedSummary',
  'reviewNote',
  'reviewedAt',
  'reviewedBy',
  'createdAt',
  'updatedAt',
  'fileId',
  'extractionStatus',
  'extractedAt',
  'extractedRawJson',
  /** 이 AI 요청에 발급된 일회성 식별자(요구사항 10절) — 응답을 저장할 때 서버가
   * studentUuid 상담건과 연결한다. Gemini 요청 자체에는 studentUuid를 싣지 않는다. */
  'caseRequestId',
  ...ASSESSMENT_EXTRACTED_FIELDS,
  'warnings',
  'responseHighlights',
] as const

type AssessmentHeader = (typeof ASSESSMENT_HEADERS)[number]

export interface AssessmentRecord extends AssessmentExtractedFields {
  assessmentId: string
  tenantId: string
  caseId: string
  studentUuid: string
  /** legacy 검사차수(예: '1차'). */
  round: string
  /** legacy 평가시점 — '사전'/'사후' 등 자유 입력. */
  timepoint: string
  /** Drive 원본 PDF 링크(webViewLink). */
  fileUrl: string
  /** Drive 파일 ID — AI 자동확인 단계에서 원본 PDF를 다시 읽어올 때 쓴다. */
  fileId: string
  fileName: string
  uploadedAt: string
  uploadedBy: string
  status: string
  /** @deprecated 더 이상 채우지 않는다(컬럼만 보존) — 대신 개별 필드 + extractedRawJson 사용. */
  extractedSummary: string
  reviewNote: string
  reviewedAt: string
  reviewedBy: string
  createdAt: string
  updatedAt: string
  /** '수동 입력' | 'AI 추출' — legacy AI추출상태와 동일한 목적. */
  extractionStatus: string
  extractedAt: string
  /** Gemini 원본 응답 JSON 그대로(legacy AI추출원문). */
  extractedRawJson: string
  /** 이 추출 요청의 일회성 식별자(CASE-YYYYMMDD-XXXX). AI 미사용이면 빈 값. */
  caseRequestId: string
  /** 줄바꿈으로 구분된 텍스트(JSON 배열 아님) — legacy 이상값경고와 동일한 표현 방식. */
  warnings: string
  /** 줄바꿈으로 구분된 텍스트 — legacy 응답내역 하이라이트. */
  responseHighlights: string
}

export const ASSESSMENT_STATUS_PENDING_REVIEW = '검토 대기'
export const ASSESSMENT_STATUS_CONFIRMED = '확인 완료'
export const ASSESSMENT_STATUS_VALUES = [ASSESSMENT_STATUS_PENDING_REVIEW, ASSESSMENT_STATUS_CONFIRMED] as const

export const EXTRACTION_STATUS_MANUAL = '수동 입력'
export const EXTRACTION_STATUS_AI = 'AI 추출'

/** "진단결과" 탭이 아예 없거나 assessmentId 헤더 자체를 찾을 수 없을 때. */
export class AssessmentSheetSchemaError extends Error {
  constructor(public readonly missingHeaders: string[]) {
    super(`assessment sheet missing headers: ${missingHeaders.join(', ')}`)
    this.name = 'AssessmentSheetSchemaError'
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
  headerIndex: Partial<Record<AssessmentHeader, number>>
  rows: string[][]
}

function buildHeaderIndex(headers: string[]): Partial<Record<AssessmentHeader, number>> {
  const headerIndex: Partial<Record<AssessmentHeader, number>> = {}
  headers.forEach((header, index) => {
    if ((ASSESSMENT_HEADERS as readonly string[]).includes(header)) {
      headerIndex[header as AssessmentHeader] = index
    }
  })
  return headerIndex
}

async function loadSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  // 헤더가 60개를 넘으므로(A1:Z로는 26개까지만 읽힘) 넉넉하게 ZZ까지 읽는다.
  const range = `${quoteSheetName(ASSESSMENT_SHEET_NAME)}!A1:ZZ`
  const values = await getValues(accessToken, spreadsheetId, range)
  const headers = values[0] ?? []
  const rows = values.slice(1).filter((row) => row.some((cell) => cell !== ''))
  return { headers, headerIndex: buildHeaderIndex(headers), rows }
}

/** caseSheet.ts/consentSheet.ts와 동일한 자가-치유 패턴 — 기존 열은 그대로 두고 없는 것만 뒤에 추가한다. */
async function ensureHeaders(
  accessToken: string,
  spreadsheetId: string,
  sheet: LoadedSheet,
): Promise<LoadedSheet> {
  const missing = ASSESSMENT_HEADERS.filter((header) => sheet.headerIndex[header] === undefined)
  if (missing.length === 0) return sheet

  const newHeaders = [...sheet.headers, ...missing]
  const range = `${quoteSheetName(ASSESSMENT_SHEET_NAME)}!A1:${columnLetter(newHeaders.length - 1)}1`
  await updateValues(accessToken, spreadsheetId, range, [newHeaders])

  await recordSchemaVersion(accessToken, spreadsheetId, ASSESSMENT_SCHEMA_VERSION, 'assessmentSchemaVersion').catch(
    (error) => {
      console.error('[assessments] assessmentSchemaVersion 기록 실패(무시하고 계속 진행)', error)
    },
  )

  return { headers: newHeaders, headerIndex: buildHeaderIndex(newHeaders), rows: sheet.rows }
}

async function loadWritableSheet(accessToken: string, spreadsheetId: string): Promise<LoadedSheet> {
  const sheet = await loadSheet(accessToken, spreadsheetId)
  return ensureHeaders(accessToken, spreadsheetId, sheet)
}

function emptyExtractedFields(): AssessmentExtractedFields {
  const fields = {} as AssessmentExtractedFields
  for (const key of ASSESSMENT_EXTRACTED_FIELDS) fields[key] = ''
  return fields
}

function rowToRecord(row: string[], headerIndex: Partial<Record<AssessmentHeader, number>>): AssessmentRecord {
  const get = (header: AssessmentHeader): string => {
    const index = headerIndex[header]
    if (index === undefined) return ''
    const value = row[index]
    return value === undefined || value === null ? '' : String(value)
  }
  const extracted = emptyExtractedFields()
  for (const key of ASSESSMENT_EXTRACTED_FIELDS) extracted[key] = get(key)

  return {
    ...extracted,
    assessmentId: get('assessmentId'),
    tenantId: get('tenantId'),
    caseId: get('caseId'),
    studentUuid: get('studentUuid'),
    round: get('round'),
    timepoint: get('timepoint'),
    fileUrl: get('fileUrl'),
    fileId: get('fileId'),
    fileName: get('fileName'),
    uploadedAt: get('uploadedAt'),
    uploadedBy: get('uploadedBy'),
    status: get('status'),
    extractedSummary: get('extractedSummary'),
    reviewNote: get('reviewNote'),
    reviewedAt: get('reviewedAt'),
    reviewedBy: get('reviewedBy'),
    createdAt: get('createdAt'),
    updatedAt: get('updatedAt'),
    extractionStatus: get('extractionStatus'),
    extractedAt: get('extractedAt'),
    extractedRawJson: get('extractedRawJson'),
    caseRequestId: get('caseRequestId'),
    warnings: get('warnings'),
    responseHighlights: get('responseHighlights'),
  }
}

function recordToRow(record: AssessmentRecord, headers: string[]): string[] {
  const byHeader = record as unknown as Record<string, string>
  return headers.map((header) => byHeader[header] ?? '')
}

/** 관리 화면(`/assessments`) 목록용 — 필터 없이 전체를 반환한다. */
export async function listAssessments(accessToken: string, spreadsheetId: string): Promise<AssessmentRecord[]> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  return sheet.rows.map((row) => rowToRecord(row, sheet.headerIndex))
}

export async function listAssessmentsByCase(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
): Promise<AssessmentRecord[]> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const caseColumn = sheet.headerIndex.caseId
  if (caseColumn === undefined) return []
  return sheet.rows.filter((row) => row[caseColumn] === caseId).map((row) => rowToRecord(row, sheet.headerIndex))
}

export async function getAssessment(
  accessToken: string,
  spreadsheetId: string,
  assessmentId: string,
): Promise<AssessmentRecord | null> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.assessmentId
  if (idColumn === undefined) return null
  const row = sheet.rows.find((row) => row[idColumn] === assessmentId)
  return row ? rowToRecord(row, sheet.headerIndex) : null
}

export interface CreateAssessmentInput {
  tenantId: string
  caseId: string
  studentUuid: string
  round: string
  timepoint: string
  fileUrl: string
  fileId: string
  fileName: string
  uploadedBy: string
}

/**
 * PDF 업로드 직후 호출(functions/api/cases/[caseId]/assessments/index.ts). 이 시점엔
 * Gemini를 호출하지 않는다 — AI 자동확인은 별도 액션(applyExtraction)이고, 교사가 아예
 * 안 쓸 수도 있다(직접 입력 경로, 사용자 확인). 그래서 38개 필드는 전부 빈 값으로
 * 시작하고 `extractionStatus`도 '수동 입력'으로 시작한다.
 */
export async function createAssessment(
  accessToken: string,
  spreadsheetId: string,
  input: CreateAssessmentInput,
): Promise<AssessmentRecord> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const now = new Date().toISOString()
  const record: AssessmentRecord = {
    ...emptyExtractedFields(),
    assessmentId: crypto.randomUUID(),
    tenantId: input.tenantId,
    caseId: input.caseId,
    studentUuid: input.studentUuid,
    round: input.round,
    timepoint: input.timepoint,
    fileUrl: input.fileUrl,
    fileId: input.fileId,
    fileName: input.fileName,
    uploadedAt: now,
    uploadedBy: input.uploadedBy,
    status: ASSESSMENT_STATUS_PENDING_REVIEW,
    extractedSummary: '',
    reviewNote: '',
    reviewedAt: '',
    reviewedBy: '',
    createdAt: now,
    updatedAt: now,
    extractionStatus: EXTRACTION_STATUS_MANUAL,
    extractedAt: '',
    extractedRawJson: '',
    caseRequestId: '',
    warnings: '',
    responseHighlights: '',
  }
  const row = recordToRow(record, sheet.headers)
  await appendValues(accessToken, spreadsheetId, `${quoteSheetName(ASSESSMENT_SHEET_NAME)}!A1`, [row])
  return record
}

export interface ApplyExtractionInput {
  extracted: AssessmentExtractedFields
  warnings: string[]
  responseHighlights: string[]
  rawJson: string
  caseRequestId: string
}

export type ApplyExtractionResult =
  | { ok: true; assessment: AssessmentRecord }
  | { ok: false; error: 'not_found' }

/**
 * "AI로 자동 확인" 성공 시 호출(functions/api/cases/[caseId]/assessments/[assessmentId]/extract.ts).
 * `status`/`reviewedAt`/`reviewedBy`는 건드리지 않는다 — AI 추출은 초안일 뿐, 최종 확정은
 * 교사가 reviewAssessment(PATCH)로 confirm할 때만 일어난다(사용자 확인 조건 7).
 */
export async function applyExtraction(
  accessToken: string,
  spreadsheetId: string,
  assessmentId: string,
  input: ApplyExtractionInput,
): Promise<ApplyExtractionResult> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.assessmentId
  if (idColumn === undefined) return { ok: false, error: 'not_found' }
  const rowOffset = sheet.rows.findIndex((row) => row[idColumn] === assessmentId)
  if (rowOffset === -1) return { ok: false, error: 'not_found' }

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  const now = new Date().toISOString()
  const updated: AssessmentRecord = {
    ...current,
    ...input.extracted,
    extractionStatus: EXTRACTION_STATUS_AI,
    extractedAt: now,
    extractedRawJson: input.rawJson,
    caseRequestId: input.caseRequestId,
    warnings: input.warnings.join('\n'),
    responseHighlights: input.responseHighlights.join('\n'),
    updatedAt: now,
  }
  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(ASSESSMENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, assessment: updated }
}

export type ReviewAssessmentInput = Partial<AssessmentExtractedFields> & {
  reviewNote?: string
  reviewedBy: string
  confirm: boolean
}

export type ReviewAssessmentResult =
  | { ok: true; assessment: AssessmentRecord; confirmed: boolean }
  | { ok: false; error: 'not_found' }

/**
 * 교사 검토/수정 저장(PATCH /api/cases/:caseId/assessments/:assessmentId) — AI가 채웠든
 * 교사가 직접 입력했든 동일한 경로. `confirm`이 true이고 아직 `검토 대기`일 때만
 * `확인 완료`로 전이하며 그때만 reviewedAt/reviewedBy를 채운다(이미 확인된 건을 다시
 * 저장해도 확인 시각이 덮어써지지 않음). `confirmed`가 true일 때만 호출부가 케이스
 * 자동전이(결과 확인→상담 예정)를 시도한다.
 */
export async function reviewAssessment(
  accessToken: string,
  spreadsheetId: string,
  assessmentId: string,
  input: ReviewAssessmentInput,
): Promise<ReviewAssessmentResult> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.assessmentId
  if (idColumn === undefined) return { ok: false, error: 'not_found' }
  const rowOffset = sheet.rows.findIndex((row) => row[idColumn] === assessmentId)
  if (rowOffset === -1) return { ok: false, error: 'not_found' }

  const current = rowToRecord(sheet.rows[rowOffset], sheet.headerIndex)
  const now = new Date().toISOString()
  const newlyConfirmed = input.confirm && current.status !== ASSESSMENT_STATUS_CONFIRMED

  const extractedOverrides: Partial<AssessmentExtractedFields> = {}
  for (const key of ASSESSMENT_EXTRACTED_FIELDS) {
    if (input[key] !== undefined) extractedOverrides[key] = input[key]
  }

  const updated: AssessmentRecord = {
    ...current,
    ...extractedOverrides,
    reviewNote: input.reviewNote ?? current.reviewNote,
    status: input.confirm ? ASSESSMENT_STATUS_CONFIRMED : current.status,
    reviewedAt: newlyConfirmed ? now : current.reviewedAt,
    reviewedBy: newlyConfirmed ? input.reviewedBy : current.reviewedBy,
    updatedAt: now,
  }
  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(ASSESSMENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, assessment: updated, confirmed: newlyConfirmed }
}
