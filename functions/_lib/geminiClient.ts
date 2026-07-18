import type { AssessmentExtractedFields } from './assessmentSheet'
import { ASSESSMENT_EXTRACTED_FIELDS } from './assessmentSheet'

/**
 * legacy `extractDiagnosisWithGemini_`(counseling-manager/code.gs.txt:4015-4118)는 원본
 * PDF를 Gemini에 그대로 첨부(inline_data)했다 — 요구사항 9·10절에 따라 이 구현은 원본
 * PDF나 학생 이름을 Gemini에 절대 보내지 않는다. 브라우저에서 pdf.js로 텍스트를 뽑고
 * 교사가 이름/학교명/생년월일 등 직접 식별정보 후보를 확인·제거한 뒤(src/lib/
 * pdfDeidentify.ts, AssessmentDetailPage) 남은 텍스트만 여기로 들어온다. 이 함수 자체는
 * "비식별화가 완전하다"고 보장하지 않는다 — 그 확인은 교사 화면 책임이다.
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

/** 학생 식별 정보가 이미 제거된 텍스트만 받는다는 전제를 프롬프트에도 명시한다. */
const EXTRACTION_PROMPT = `아래 텍스트는 학교 영양상담용 식생활·생활습관 진단 결과에서 학생 이름·학교명·
생년월일·연락처 등 직접 식별정보를 제거한 뒤 남은 내용입니다. 텍스트에 명시적으로 표시된 값만
정확히 추출하세요. 추론하거나 새로운 판정을 만들지 마세요. 값이 없거나 읽을 수 없으면 빈 문자열을
반환하세요(추측 금지). 텍스트에 이름으로 보이는 고유명사나 연락처·주소가 남아 있다면 절대 그대로
반환하지 말고 warnings 배열에 "식별정보로 보이는 내용이 남아 있습니다"라고만 기록하세요. 비현실적인
수면시간 등 확인이 필요한 사항도 warnings 배열에 기록하세요. 상담에 참고할 만한 세부 응답이 있으면
responseHighlights 배열에 간단히 정리하세요.`

/** legacy properties 객체(4046-4086줄)의 설명 문구를 그대로 옮긴 것 — responseSchema용.
 * 재식별 위험이 큰 4개 필드(studentName/schoolType/age/examDate)는 요구사항 10절에 따라
 * Gemini에 요청하지 않는다 — assessmentSheet.ts의 ASSESSMENT_EXTRACTED_FIELDS 참고. */
const FIELD_DESCRIPTIONS: Record<(typeof ASSESSMENT_EXTRACTED_FIELDS)[number], string> = {
  gradeBand: '학년군(초등 저학년 또는 초등 고학년)',
  sex: '성별',
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

/**
 * 비식별화된 텍스트만 Gemini에 보낸다(inline_data 없음 — PDF 원본 바이트를 다루지
 * 않는다). 실패 시 GeminiApiError를 던진다 — 호출부(assessments extract API)가 그대로
 * 전달해 프런트에 에러로 보여준다. 요청 본문 자체를 로그로 출력하지 않는다(요구사항
 * 10절 "AI API 요청 내용을 디버그 로그에 그대로 출력하지 않는다").
 */
export async function extractFromDeidentifiedText(
  apiKey: string,
  deidentifiedText: string,
): Promise<AssessmentExtractionResult> {
  const response = await fetch(
    `${GEMINI_API_BASE}/models/${DEFAULT_GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${EXTRACTION_PROMPT}\n\n---\n${deidentifiedText}` }],
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
