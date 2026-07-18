export const ASSESSMENT_STATUS_PENDING_REVIEW = '검토 대기'
export const ASSESSMENT_STATUS_CONFIRMED = '확인 완료'

export const EXTRACTION_STATUS_MANUAL = '수동 입력'
export const EXTRACTION_STATUS_AI = 'AI 추출'

/**
 * functions/_lib/assessmentSheet.ts의 ASSESSMENT_EXTRACTED_FIELDS와 동일한 키·순서.
 * studentName/schoolType/age/examDate는 재식별 위험이 커서 Gemini에 요청하지 않는다
 * (요구사항 10절) — grade도 구체 학년 대신 학년군만 받는 gradeBand로 바뀌었다.
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

export type AssessmentExtractedFields = Record<AssessmentExtractedFieldKey, string>

/** 화면 그룹핑 + 라벨(legacy stringProp 설명 문구 그대로). */
export const ASSESSMENT_FIELD_GROUPS: { title: string; fields: { key: AssessmentExtractedFieldKey; label: string }[] }[] = [
  {
    title: '검사 정보',
    fields: [
      { key: 'gradeBand', label: '학년군(초등 저학년/고학년)' },
      { key: 'sex', label: '성별' },
    ],
  },
  {
    title: '신체계측',
    fields: [
      { key: 'heightCm', label: '신장(cm)' },
      { key: 'heightPercentile', label: '신장 백분위' },
      { key: 'weightKg', label: '체중(kg)' },
      { key: 'weightPercentile', label: '체중 백분위' },
      { key: 'bmi', label: 'BMI' },
      { key: 'bmiPercentile', label: 'BMI 백분위' },
    ],
  },
  {
    title: '식습관/태도',
    fields: [
      { key: 'subjectiveHealth', label: '주관적 건강상태' },
      { key: 'bodyImage', label: '체형 인식' },
      { key: 'mealFrequency', label: '식사빈도' },
      { key: 'regularMealTime', label: '규칙적인 식사 시간' },
      { key: 'eatingSpeed', label: '식사속도' },
      { key: 'mealAmount', label: '식사량' },
      { key: 'eatingAttitude', label: '섭식태도' },
      { key: 'eatingAttitudeScore', label: '섭식태도 점수' },
    ],
  },
  {
    title: '영양지수 종합',
    fields: [
      { key: 'totalLevel', label: '종합 등급' },
      { key: 'totalScore', label: '종합 점수' },
      { key: 'balanceLevel', label: '균형 등급' },
      { key: 'balanceScore', label: '균형 점수' },
      { key: 'moderationLevel', label: '절제 등급' },
      { key: 'moderationScore', label: '절제 점수' },
      { key: 'practiceLevel', label: '실천 등급' },
      { key: 'practiceScore', label: '실천 점수' },
    ],
  },
  {
    title: '건강/생활습관',
    fields: [
      { key: 'allergy', label: '식품 알레르기' },
      { key: 'disease', label: '질환' },
      { key: 'sleepLevel', label: '수면습관 판정' },
      { key: 'sleepDuration', label: '수면시간' },
      { key: 'mentalHealth', label: '정신건강 판정' },
    ],
  },
  {
    title: '스마트폰 의존도',
    fields: [
      { key: 'smartphoneUsageLevel', label: '스마트폰 사용 습관' },
      { key: 'weekdaySmartphoneHours', label: '주중 하루 평균 사용시간' },
      { key: 'weekendSmartphoneHours', label: '주말 하루 평균 사용시간' },
      { key: 'smartphoneOverdependence', label: '스마트폰 과의존' },
    ],
  },
  {
    title: '기타',
    fields: [{ key: 'additionalRequest', label: '영양상담 추가 요청사항' }],
  },
]

export interface Assessment extends AssessmentExtractedFields {
  assessmentId: string
  tenantId: string
  caseId: string
  studentUuid: string
  round: string
  timepoint: string
  fileUrl: string
  fileId: string
  fileName: string
  uploadedAt: string
  uploadedBy: string
  status: string
  reviewNote: string
  reviewedAt: string
  reviewedBy: string
  createdAt: string
  updatedAt: string
  extractionStatus: string
  extractedAt: string
  /** 이 추출 요청의 일회성 식별자(CASE-YYYYMMDD-XXXX). AI 미사용이면 빈 값. */
  caseRequestId: string
  /** 줄바꿈으로 구분된 텍스트 — 표시할 땐 .split('\n').filter(Boolean)으로 나눈다. */
  warnings: string
  responseHighlights: string
}

export interface AssessmentListItem {
  assessment: Assessment
  caseTopic: string
  caseStatus: string
  studentName: string
  /** 학생식별정보 Spreadsheet에서 StudentID로 조회해 결합한 값(이름과 중복 저장하지 않음). */
  grade: string
  studentClass: string
  studentNumber: string
}
