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

/**
 * 브라우저에서 탐지한 "확인 필요" 상태를 코드로만 저장한다(요구사항 2절) — 실제 학생
 * 이름, PDF 원문, 비교에 쓰인 문자열은 절대 저장하지 않는다. 코드가 무엇을 의미하는지는
 * src/types/assessment.ts의 REVIEW_FLAG_LABELS(한국어 라벨)가 화면에 표시할 때만 번역한다.
 */
export const REVIEW_FLAG_CODES = [
  'STUDENT_NAME_MISMATCH',
  'GRADE_MISMATCH',
  'TEST_DATE_MISMATCH',
  'RESULT_PDF_MISSING',
  'RESPONSE_PDF_MISSING',
  'PDF_TEXT_EXTRACTION_FAILED',
  'MANUAL_REVIEW_REQUIRED',
] as const

export type ReviewFlagCode = (typeof REVIEW_FLAG_CODES)[number]

export function isReviewFlagCode(value: string): value is ReviewFlagCode {
  return (REVIEW_FLAG_CODES as readonly string[]).includes(value)
}

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
  /** 줄바꿈으로 구분된 REVIEW_FLAG_CODES 값들 — 실제 이름/PDF 원문은 절대 담지 않는다. */
  'reviewFlags',
  /**
   * 값이 있으면 이 행은 더 이상 "정상" 기록이 아니라, 같은 caseId+timepoint의 다른 행으로
   * 병합됐다는 뜻이다(요구사항 3절 "중복이 발견되면 최신 정상 기록 하나만 유지하고 나머지는
   * 사용자에게 노출하지 않기") — 모든 조회 함수가 이 값이 채워진 행을 걸러낸다.
   */
  'mergedIntoAssessmentId',
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
  /** 줄바꿈으로 구분된 ReviewFlagCode 값들. */
  reviewFlags: string
  /** 비어있지 않으면 이 행은 숨겨진 중복이고, 이 값이 가리키는 assessmentId가 정상 기록이다. */
  mergedIntoAssessmentId: string
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
    reviewFlags: get('reviewFlags'),
    mergedIntoAssessmentId: get('mergedIntoAssessmentId'),
  }
}

function recordToRow(record: AssessmentRecord, headers: string[]): string[] {
  const byHeader = record as unknown as Record<string, string>
  return headers.map((header) => byHeader[header] ?? '')
}

/** mergedIntoAssessmentId가 채워진 행(숨겨진 중복)을 걸러낸다 — 모든 목록 조회가 공유하는 필터. */
function isVisible(row: string[], headerIndex: Partial<Record<AssessmentHeader, number>>): boolean {
  const mergedColumn = headerIndex.mergedIntoAssessmentId
  if (mergedColumn === undefined) return true
  return !row[mergedColumn]
}

/** 관리 화면(`/assessments`) 목록용 — 필터 없이 전체를 반환한다(숨겨진 중복 제외). */
export async function listAssessments(accessToken: string, spreadsheetId: string): Promise<AssessmentRecord[]> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  return sheet.rows
    .filter((row) => isVisible(row, sheet.headerIndex))
    .map((row) => rowToRecord(row, sheet.headerIndex))
}

export async function listAssessmentsByCase(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
): Promise<AssessmentRecord[]> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const caseColumn = sheet.headerIndex.caseId
  if (caseColumn === undefined) return []
  return sheet.rows
    .filter((row) => row[caseColumn] === caseId && isVisible(row, sheet.headerIndex))
    .map((row) => rowToRecord(row, sheet.headerIndex))
}

/**
 * 단건 조회 — assessmentId가 이미 병합되어 숨겨진 행을 가리키면(요청 경합으로 "패배한"
 * 쪽 ID를 클라이언트가 들고 있었던 경우) 조용히 정상(canonical) 기록을 대신 돌려준다.
 * 죽은 링크를 만들지 않기 위해서다 — 교사 입장에서는 어느 ID로 열든 항상 같은 최신 기록을
 * 본다.
 */
export async function getAssessment(
  accessToken: string,
  spreadsheetId: string,
  assessmentId: string,
): Promise<AssessmentRecord | null> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const idColumn = sheet.headerIndex.assessmentId
  if (idColumn === undefined) return null
  const row = sheet.rows.find((row) => row[idColumn] === assessmentId)
  if (!row) return null
  const record = rowToRecord(row, sheet.headerIndex)
  if (!record.mergedIntoAssessmentId) return record
  return getAssessment(accessToken, spreadsheetId, record.mergedIntoAssessmentId)
}

/**
 * legacy `ensureDiagnosisRecord_`(counseling-manager/code.gs.txt:3859-3885)와 동일한 유일성
 * 규칙: 같은 caseId+timepoint(평가시점) 행은 하나만 존재한다(숨겨진 중복 제외). Sheets에는
 * 유니크 인덱스가 없으므로 이 조회가 유일성의 유일한 근거다 — 이 함수를 거치지 않고 새
 * 행을 append하면 중복이 생긴다(요구사항 3·8절).
 */
export async function findAssessmentByCaseAndTimepoint(
  accessToken: string,
  spreadsheetId: string,
  caseId: string,
  timepoint: string,
): Promise<AssessmentRecord | null> {
  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const caseColumn = sheet.headerIndex.caseId
  const timepointColumn = sheet.headerIndex.timepoint
  if (caseColumn === undefined || timepointColumn === undefined) return null
  const row = sheet.rows.find(
    (row) => row[caseColumn] === caseId && row[timepointColumn] === timepoint && isVisible(row, sheet.headerIndex),
  )
  return row ? rowToRecord(row, sheet.headerIndex) : null
}

export interface CreateAssessmentInput {
  tenantId: string
  caseId: string
  studentUuid: string
  round: string
  timepoint: string
  /**
   * 더 이상 원본 PDF를 Drive에 올리지 않으므로 항상 빈 값이다(개인정보 보호 구조
   * 확정 사항) — 필드 자체는 과거 레코드/시트 스키마와의 호환을 위해 남겨 둔다.
   */
  fileUrl?: string
  fileId?: string
  fileName?: string
  uploadedBy: string
}

/**
 * 같은 caseId+timepoint는 항상 같은 값을 낸다 — 이 값 자체가 요구사항 1절의
 * "idempotency key"이자 assessmentId다. 두 요청이 정확히 같은 순간에 들어와도 서로 다른
 * 임의 UUID(crypto.randomUUID())가 아니라 이 같은 값으로 수렴하므로, append가 두 번
 * 일어나더라도(Sheets에 진짜 트랜잭션이 없어서 가능) 두 행의 assessmentId가 같아 사실상
 * 하나의 기록으로 취급된다. FNV-1a 32bit — 암호학적 강도가 아니라 "같은 입력→같은 출력"
 * 재현성만 필요하다(비밀값이 아님, caseId도 학생 이름이 아니다).
 */
export function deriveAssessmentIdempotencyKey(caseId: string, timepoint: string): string {
  let hash = 0x811c9dc5
  const input = `${caseId}|${timepoint}`
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `ASSESS-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

/**
 * 같은 caseId+timepoint로 보이는 "정상"(mergedIntoAssessmentId 없음) 행이 2개 이상이면
 * 하나만 남기고 나머지는 mergedIntoAssessmentId를 채워 숨긴다(요구사항 1절 "저장 직후
 * 같은 caseId+evaluationPoint 중복 행 검사"와 "중복이 발견되면 최신 정상 기록 하나만
 * 유지"). 정렬 기준은 updatedAt 내림차순(최신 우선), 동률이면 assessmentId 오름차순으로
 * 완전히 결정적이다 — 동시에 두 요청이 이 함수를 각자 호출해도 항상 같은 행을 canonical로
 * 고른다(서로 다른 결과로 갈라지지 않는다). 행을 물리적으로 삭제하지 않는다 — Sheets API로
 * 행을 지우려면 탭의 내부 sheetId를 알아야 해서 위험이 더 크고, 숨기는 것만으로 "나머지는
 * 사용자에게 노출하지 않기" 요건을 만족한다.
 */
async function collapseDuplicates(
  accessToken: string,
  spreadsheetId: string,
  sheet: LoadedSheet,
  caseId: string,
  timepoint: string,
): Promise<AssessmentRecord | null> {
  const caseColumn = sheet.headerIndex.caseId
  const timepointColumn = sheet.headerIndex.timepoint
  if (caseColumn === undefined || timepointColumn === undefined) return null

  const matches = sheet.rows
    .map((row, offset) => ({ row, offset }))
    .filter(({ row }) => row[caseColumn] === caseId && row[timepointColumn] === timepoint && isVisible(row, sheet.headerIndex))
  if (matches.length === 0) return null

  const records = matches.map(({ row, offset }) => ({ offset, record: rowToRecord(row, sheet.headerIndex) }))
  if (records.length === 1) return records[0].record

  records.sort((a, b) => {
    const byUpdated = b.record.updatedAt.localeCompare(a.record.updatedAt)
    if (byUpdated !== 0) return byUpdated
    return a.record.assessmentId.localeCompare(b.record.assessmentId)
  })
  const [canonical, ...extras] = records

  for (const extra of extras) {
    if (extra.record.assessmentId === canonical.record.assessmentId) continue // 같은 ID로 수렴한 경우(정상 케이스) — 병합 표시가 필요 없다.
    const merged: AssessmentRecord = { ...extra.record, mergedIntoAssessmentId: canonical.record.assessmentId }
    const row = recordToRow(merged, sheet.headers)
    const sheetRowNumber = extra.offset + 2
    const range = `${quoteSheetName(ASSESSMENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
    await updateValues(accessToken, spreadsheetId, range, [row])
  }

  return canonical.record
}

export interface EnsureAssessmentResult {
  assessment: AssessmentRecord
  /** false면 이미 있던 caseId+timepoint 행을 그대로 돌려준 것 — 새로 만들지 않았다. */
  created: boolean
}

/**
 * 검사결과 등록의 유일한 진입점(요구사항 1·8절). 흐름:
 *   1) 저장 직전 재조회 — findAssessmentByCaseAndTimepoint 대신 collapseDuplicates를 먼저
 *      태워서, 과거에 이미 중복이 생겨 있었다면 이 시점에 정리하고 그 정상 기록을 그대로
 *      돌려준다(새로 만들지 않음).
 *   2) 없으면 assessmentId를 caseId+timepoint로부터 결정적으로 만들어(idempotency key)
 *      append한다.
 *   3) 저장 직후 재조회 — 우리 append와 "동시에 2회 실행"된 다른 요청의 append가 둘 다
 *      반영됐는지 다시 확인하고, 있었다면 collapseDuplicates로 하나만 남긴다.
 * 버튼을 여러 번 눌러도, 새로고침 후 같은 시점을 다시 등록해도, 두 요청이 진짜 동시에
 * 들어와도 최종적으로는 항상 같은 하나의 기록으로 수렴한다 — legacy `ensureDiagnosisRecord_`
 * 규칙(caseId+timepoint 유일성)을 Sheets API의 트랜잭션 부재 위에서도 지키기 위한 구조다.
 * PII나 StudentID 매핑은 이 로직 어디에도 D1을 쓰지 않는다 — 전부 학교 Sheets 안에서만 처리한다.
 */
export async function ensureAssessment(
  accessToken: string,
  spreadsheetId: string,
  input: CreateAssessmentInput,
): Promise<EnsureAssessmentResult> {
  const beforeSheet = await loadWritableSheet(accessToken, spreadsheetId)
  const existing = await collapseDuplicates(accessToken, spreadsheetId, beforeSheet, input.caseId, input.timepoint)
  if (existing) return { assessment: existing, created: false }

  const sheet = await loadWritableSheet(accessToken, spreadsheetId)
  const now = new Date().toISOString()
  const record: AssessmentRecord = {
    ...emptyExtractedFields(),
    assessmentId: deriveAssessmentIdempotencyKey(input.caseId, input.timepoint),
    tenantId: input.tenantId,
    caseId: input.caseId,
    studentUuid: input.studentUuid,
    round: input.round,
    timepoint: input.timepoint,
    fileUrl: input.fileUrl ?? '',
    fileId: input.fileId ?? '',
    fileName: input.fileName ?? '',
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
    reviewFlags: '',
    mergedIntoAssessmentId: '',
  }
  const row = recordToRow(record, sheet.headers)
  await appendValues(accessToken, spreadsheetId, `${quoteSheetName(ASSESSMENT_SHEET_NAME)}!A1`, [row])

  const afterSheet = await loadWritableSheet(accessToken, spreadsheetId)
  const canonical = (await collapseDuplicates(accessToken, spreadsheetId, afterSheet, input.caseId, input.timepoint)) ?? record
  return { assessment: canonical, created: canonical.assessmentId === record.assessmentId }
}

/**
 * assessmentId로 행을 찾고, 그 행이 병합되어 숨겨진 것이면(mergedIntoAssessmentId 있음)
 * canonical 행을 찾을 때까지 따라간다 — applyExtraction/reviewAssessment가 옛(숨겨진) ID로
 * 잘못 쓰는 것을 막는다(getAssessment의 조회 시점 리다이렉트와 같은 원칙).
 */
function resolveCanonicalRow(
  sheet: LoadedSheet,
  assessmentId: string,
): { offset: number; record: AssessmentRecord } | null {
  const idColumn = sheet.headerIndex.assessmentId
  if (idColumn === undefined) return null
  const offset = sheet.rows.findIndex((row) => row[idColumn] === assessmentId)
  if (offset === -1) return null
  const record = rowToRecord(sheet.rows[offset], sheet.headerIndex)
  if (record.mergedIntoAssessmentId) {
    return resolveCanonicalRow(sheet, record.mergedIntoAssessmentId)
  }
  return { offset, record }
}

export interface ApplyExtractionInput {
  extracted: AssessmentExtractedFields
  warnings: string[]
  responseHighlights: string[]
  rawJson: string
  caseRequestId: string
  /** REVIEW_FLAG_CODES 값만 담는다 — 이름/PDF 원문은 절대 여기 들어오지 않는다(요구사항 2절). */
  reviewFlagCodes: string[]
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
  const resolved = resolveCanonicalRow(sheet, assessmentId)
  if (!resolved) return { ok: false, error: 'not_found' }
  const { offset: rowOffset, record: current } = resolved
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
    reviewFlags: input.reviewFlagCodes.join('\n'),
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
  /** 넘기지 않으면 기존 reviewFlags를 그대로 둔다 — AI 분석 없이 직접 입력만 하고 저장한
   * 경우에도, 그 세션 동안 PDF 단계에서 계산된 플래그가 있으면 여기로 함께 저장할 수 있다. */
  reviewFlagCodes?: string[]
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
  const resolved = resolveCanonicalRow(sheet, assessmentId)
  if (!resolved) return { ok: false, error: 'not_found' }
  const { offset: rowOffset, record: current } = resolved
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
    reviewFlags: input.reviewFlagCodes ? input.reviewFlagCodes.join('\n') : current.reviewFlags,
    updatedAt: now,
  }
  const row = recordToRow(updated, sheet.headers)
  const sheetRowNumber = rowOffset + 2
  const range = `${quoteSheetName(ASSESSMENT_SHEET_NAME)}!A${sheetRowNumber}:${columnLetter(sheet.headers.length - 1)}${sheetRowNumber}`
  await updateValues(accessToken, spreadsheetId, range, [row])
  return { ok: true, assessment: updated, confirmed: newlyConfirmed }
}
