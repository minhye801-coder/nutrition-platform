export const CONSENT_STATUS_NOT_SENT = '미발송'
export const CONSENT_STATUS_REQUESTED = '동의 요청'
export const CONSENT_STATUS_NEEDS_REVIEW = '교사 확인 필요'
export const CONSENT_STATUS_CONFIRMED = '동의 완료'
export const CONSENT_STATUS_DECLINED = '비동의'

export const CONSENT_DECISION_AGREE = '동의'
export const CONSENT_DECISION_DECLINE = '비동의'

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

export interface Consent {
  consentId: string
  tenantId: string
  intakeId: string
  caseId: string
  studentUuid: string
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
  requestedAt: string
  respondedAt: string
  consentedAt: string
  consentPdfUrl: string
  confirmedAt: string
  confirmedBy: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface ConsentListItem {
  consent: Consent
  caseTopic: string
  caseStatus: string
  studentName: string
  gradeClass: string
}

export interface ConsentDetail {
  caseId: string
  studentName: string
  gradeClass: string
  topic: string
  caseStatus: string
  consent: Consent
}

export interface PublicConsentInfo {
  studentName: string
  topic: string
  /** legacy `getConsentPageData`(intake-consent/code.gs.txt:82-108)와 동일 — 상태 무관하게 조회는 되고, 이미 제출됐으면 이 플래그로 안내한다. */
  alreadySubmitted: boolean
  status: string
}

export interface SubmitConsentInput {
  guardianName: string
  relationToStudent: string
  guardianContact: string
  decision: typeof CONSENT_DECISION_AGREE | typeof CONSENT_DECISION_DECLINE
  signatureName: string
  counselingConsent?: boolean
  personalInfoConsent?: boolean
  sensitiveInfoConsent?: boolean
  diagnosisUseConsent?: boolean
  aiNoticeConfirmed?: boolean
}
