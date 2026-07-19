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

export interface AssessmentFieldGroup {
  title: string
  fields: { key: AssessmentExtractedFieldKey; label: string }[]
}

/**
 * "공식 진단결과" 카드용 — 검토 화면 순서(요구사항 3·5절) 중 ③에 해당한다. legacy
 * mapExtractedDiagnosis_(counseling-manager/code.gs.txt:4120-4230)와 대조 확인 결과, 이
 * 34개 필드는 원본이 다루던 항목을 전부 포함한다(재식별 위험이 큰 studentName/schoolType/
 * age/examDate 4개만 의도적으로 제외 — assessmentSheet.ts 참고). 원본에 있었는데 지금 빠진
 * 필드는 없다.
 */
export const OFFICIAL_RESULT_FIELD_GROUPS: AssessmentFieldGroup[] = [
  {
    title: '검사 기본정보',
    fields: [
      { key: 'gradeBand', label: '학년군(초등 저학년/고학년)' },
      { key: 'sex', label: '성별' },
      { key: 'heightCm', label: '신장(cm)' },
      { key: 'heightPercentile', label: '신장 백분위' },
      { key: 'weightKg', label: '체중(kg)' },
      { key: 'weightPercentile', label: '체중 백분위' },
      { key: 'bmi', label: 'BMI' },
      { key: 'bmiPercentile', label: 'BMI 백분위' },
    ],
  },
  {
    title: '영역별 점수와 판정',
    fields: [
      { key: 'totalLevel', label: '종합 등급' },
      { key: 'totalScore', label: '종합 점수' },
      { key: 'balanceLevel', label: '균형 등급' },
      { key: 'balanceScore', label: '균형 점수' },
      { key: 'moderationLevel', label: '절제 등급' },
      { key: 'moderationScore', label: '절제 점수' },
      { key: 'practiceLevel', label: '실천 등급' },
      { key: 'practiceScore', label: '실천 점수' },
      { key: 'eatingAttitude', label: '섭식태도' },
      { key: 'eatingAttitudeScore', label: '섭식태도 점수' },
    ],
  },
]

/**
 * "응답내역" 카드용 — 검토 화면 순서 ④에 해당한다. responseHighlights(AI가 정리한 주요
 * 응답 요약)와는 별개로, 원본 필드 하나하나를 영역별로 나눠 보여준다(요구사항 3절).
 * "신체활동" 관련 필드는 원본(legacy Gemini 스키마)에도 없었다 — 새로 빠뜨린 게 아니라
 * 애초에 추출 대상이 아니었다(보고 대상, 복원할 원본 필드 없음).
 */
export const RESPONSE_DETAIL_FIELD_GROUPS: AssessmentFieldGroup[] = [
  {
    title: '식생활 주요 응답',
    fields: [
      { key: 'mealFrequency', label: '식사빈도' },
      { key: 'regularMealTime', label: '규칙적인 식사 시간' },
      { key: 'eatingSpeed', label: '식사속도' },
      { key: 'mealAmount', label: '식사량' },
      { key: 'bodyImage', label: '체형 인식' },
    ],
  },
  {
    title: '생활습관 주요 응답',
    fields: [
      { key: 'subjectiveHealth', label: '주관적 건강상태' },
      { key: 'mentalHealth', label: '정신건강 판정' },
    ],
  },
  {
    title: '수면 관련 응답',
    fields: [
      { key: 'sleepLevel', label: '수면습관 판정' },
      { key: 'sleepDuration', label: '수면시간' },
    ],
  },
  {
    title: '스마트폰·신체활동 관련 응답',
    fields: [
      { key: 'smartphoneUsageLevel', label: '스마트폰 사용 습관' },
      { key: 'weekdaySmartphoneHours', label: '주중 하루 평균 사용시간' },
      { key: 'weekendSmartphoneHours', label: '주말 하루 평균 사용시간' },
      { key: 'smartphoneOverdependence', label: '스마트폰 과의존' },
    ],
  },
  {
    title: '알레르기·질환 등 상담 참고사항',
    fields: [
      { key: 'allergy', label: '식품 알레르기' },
      { key: 'disease', label: '질환' },
      { key: 'additionalRequest', label: '영양상담 추가 요청사항' },
    ],
  },
]

/** 두 카드(공식 진단결과/응답내역)를 합친 전체 필드 그룹 — fields 순회가 필요한 곳에서 재사용. */
export const ASSESSMENT_FIELD_GROUPS: AssessmentFieldGroup[] = [
  ...OFFICIAL_RESULT_FIELD_GROUPS,
  ...RESPONSE_DETAIL_FIELD_GROUPS,
]

/**
 * 브라우저에서 리다크션 전 원문 대조로 판단한 "확인 필요" 상태를 코드로만 저장한다
 * (요구사항 2절) — 실제 학생 이름, PDF 원문, 비교에 쓰인 문자열은 절대 여기 담기지 않는다.
 * functions/_lib/assessmentSheet.ts의 REVIEW_FLAG_CODES와 동일한 값·순서.
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

/** 검토 화면에 표시할 때만 한국어로 번역한다 — 저장은 항상 코드로만 한다. */
export const REVIEW_FLAG_LABELS: Record<ReviewFlagCode, string> = {
  STUDENT_NAME_MISMATCH: '학생 이름 불일치',
  GRADE_MISMATCH: '학년 불일치',
  TEST_DATE_MISMATCH: '검사일 확인 필요',
  RESULT_PDF_MISSING: '진단결과 PDF 미제공',
  RESPONSE_PDF_MISSING: '응답내역 PDF 미제공',
  PDF_TEXT_EXTRACTION_FAILED: 'PDF 텍스트 판독 실패',
  MANUAL_REVIEW_REQUIRED: '교사 직접 확인 필요',
}

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
  /** 줄바꿈으로 구분된 ReviewFlagCode 값들. */
  reviewFlags: string
  /** 비어있지 않으면 이 레코드는 숨겨진 중복이다 — 화면은 이 값이 있는 레코드를 절대 보여주지 않는다. */
  mergedIntoAssessmentId: string
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
