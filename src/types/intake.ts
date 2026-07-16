export const INTAKE_STATUS_NEW = '신규'
export const INTAKE_STATUS_REVIEWING = '검토중'
export const INTAKE_STATUS_APPROVED = '승인'
export const INTAKE_STATUS_REJECTED = '반려'

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

export interface Intake {
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
  note: string
  studentUuid: string
  status: string
  submittedAt: string
  updatedAt: string
}

export interface IntakeListFilters {
  status?: string
  q?: string
}

export interface SubmitIntakeInput {
  website?: string
  applicantType: string
  applicantName: string
  relationToStudent: string
  schoolYear: string
  grade: string
  class: string
  studentNumber?: string
  name: string
  topic: string
  content: string
  preferredTime?: string
  urgency?: string
  contactInfo: string
  privacyConsent: boolean
  note?: string
}
