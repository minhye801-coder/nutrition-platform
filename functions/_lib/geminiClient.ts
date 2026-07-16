import type { AssessmentExtractedFields } from './assessmentSheet'
import { ASSESSMENT_EXTRACTED_FIELDS } from './assessmentSheet'

/**
 * legacy `extractDiagnosisWithGemini_`(counseling-manager/code.gs.txt:4015-4118)를 그대로
 * 옮긴다 — PDF를 Gemini에 직접 첨부(inline_data)하고 `responseSchema`로 38개 필드를
 * 강제해 구조화된 JSON을 받는다(자유서술 요약이 아니다, 사용자 확인).
 *
 * 우리 쪽 API 호출 자체에는 studentUuid/이름 등 식별 메타데이터를 추가로 싣지 않는다
 * (legacy는 프롬프트에 `학생명=${student.학생명}` 등을 함께 보냈지만, 이번 구현은 그
 * 대조를 서버가 응답을 받은 뒤 studentUuid로 조회한 학생 레코드와 비교하는 방식으로
 * 대체한다 — assessments 업로드/확인 API 참고). 다만 **업로드된 PDF 원본 자체에는
 * 학생 이름 등 개인정보가 인쇄돼 있을 수 있으므로, 이 설계를 "익명 전송"이라고
 * 표현하지 않는다** — Gemini는 PDF 내용을 그대로 받는다.
 */
export class GeminiApiError extends Error {
  readonly status: number
  readonly detail: string
  constructor(status: number, detail: string) {
    super(`Gemini API error: ${status}`)
    this.name = 'GeminiApiError'
    this.status = status
    this.detail = detail
  }
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
/** 설정 화면에 모델 선택 UI가 생기기 전까지의 기본값 — 필요해지면 이 상수만 바꾸면 된다. */
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

/** legacy 프롬프트(4024-4032줄)와 동일한 취지 — 학생 식별 정보 문장만 뺐다(위 클래스 설명 참고). */
const EXTRACTION_PROMPT = `첨부 PDF는 학교 영양상담용 식생활·생활습관 진단 결과(및 응답내역)입니다.
PDF 화면에 명시적으로 표시된 값만 정확히 추출하세요. 추론하거나 새로운 판정을 만들지 마세요.
진단결과 PDF의 공식 판정과 점수를 우선 기준으로 사용하세요.
값이 없거나 읽을 수 없으면 빈 문자열을 반환하세요(추측 금지).
학년·이름·검사일 불일치, 비현실적인 수면시간 등 확인이 필요한 사항은 warnings 배열에 기록하세요.
상담에 참고할 만한 세부 응답이 있으면 responseHighlights 배열에 간단히 정리하세요.`

/** legacy properties 객체(4046-4086줄)의 설명 문구를 그대로 옮긴 것 — responseSchema용. */
const FIELD_DESCRIPTIONS: Record<(typeof ASSESSMENT_EXTRACTED_FIELDS)[number], string> = {
  studentName: '학생 이름',
  schoolType: '초등학교/중학교/고등학교',
  grade: '학년 숫자',
  sex: '성별',
  age: '나이',
  examDate: '검사일 YYYY-MM-DD',
  heightCm: '신장 cm',
  heightPercentile: '신장 백분위',
  weightKg: '체중 kg',
  weightPercentile: '체중 백분위',
  bmi: '체질량지수',
  bmiPercentile: '체질량지수 백분위',
  subjectiveHealth: '주관적 건강상태 판정',
  bodyImage: '체형 인식 판정',
  mealFrequency: '식사빈도 판정 또는 횟수',
  regularMealTime: '규칙적인 식사 시간 판정',
  eatingSpeed: '식사속도 판정',
  mealAmount: '식사량 판정',
  totalLevel: '영양지수 종합 등급',
  totalScore: '영양지수 종합 점수',
  balanceLevel: '균형 등급',
  balanceScore: '균형 점수',
  moderationLevel: '절제 등급',
  moderationScore: '절제 점수',
  practiceLevel: '실천 등급',
  practiceScore: '실천 점수',
  eatingAttitude: '섭식태도 판정',
  eatingAttitudeScore: '섭식태도 점수',
  allergy: '식품 알레르기 결과',
  disease: '질환 결과',
  sleepLevel: '수면습관 판정',
  sleepDuration: '수면시간',
  mentalHealth: '정신건강 판정',
  smartphoneUsageLevel: '스마트폰 사용 습관 판정',
  weekdaySmartphoneHours: '주중 하루 평균 스마트폰 사용시간',
  weekendSmartphoneHours: '주말 하루 평균 스마트폰 사용시간',
  smartphoneOverdependence: '스마트폰 과의존 판정',
  additionalRequest: '영양상담 추가 요청사항',
}

export interface AssessmentExtractionResult {
  extracted: AssessmentExtractedFields
  warnings: string[]
  responseHighlights: string[]
  /** Gemini 원본 응답 JSON 문자열 그대로(감사/재처리용, legacy AI추출원문과 동일 목적). */
  rawJson: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function buildResponseSchema() {
  const properties: Record<string, { type: string; description?: string; items?: { type: string } }> = {}
  for (const key of ASSESSMENT_EXTRACTED_FIELDS) {
    properties[key] = { type: 'string', description: FIELD_DESCRIPTIONS[key] }
  }
  properties.warnings = { type: 'array', items: { type: 'string' } }
  properties.responseHighlights = { type: 'array', items: { type: 'string' } }
  return {
    type: 'object',
    properties,
    required: [...ASSESSMENT_EXTRACTED_FIELDS, 'warnings', 'responseHighlights'],
  }
}

/** 실패 시 GeminiApiError를 던진다 — 호출부(assessments extract API)가 그대로 전달해 프런트에 에러로 보여준다. */
export async function extractAssessmentData(
  apiKey: string,
  pdfBytes: ArrayBuffer,
): Promise<AssessmentExtractionResult> {
  const response = await fetch(
    `${GEMINI_API_BASE}/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              { inline_data: { mime_type: 'application/pdf', data: arrayBufferToBase64(pdfBytes) } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: buildResponseSchema(),
        },
      }),
    },
  )
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new GeminiApiError(response.status, detail)
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new GeminiApiError(502, 'empty response')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new GeminiApiError(502, 'invalid JSON response')
  }

  const extracted = {} as AssessmentExtractedFields
  for (const key of ASSESSMENT_EXTRACTED_FIELDS) {
    const value = parsed[key]
    extracted[key] = typeof value === 'string' ? value : value == null ? '' : String(value)
  }
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map((item) => String(item)) : []
  const responseHighlights = Array.isArray(parsed.responseHighlights)
    ? parsed.responseHighlights.map((item) => String(item))
    : []

  return { extracted, warnings, responseHighlights, rawJson: text }
}
