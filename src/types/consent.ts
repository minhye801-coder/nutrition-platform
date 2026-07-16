export const CONSENT_STATUS_NOT_SENT = '미발송'
export const CONSENT_STATUS_REQUESTED = '동의 요청'
export const CONSENT_STATUS_NEEDS_REVIEW = '교사 확인 필요'
export const CONSENT_STATUS_CONFIRMED = '동의 완료'
export const CONSENT_STATUS_DECLINED = '비동의'

export const CONSENT_DECISION_AGREE = '동의'
export const CONSENT_DECISION_DECLINE = '비동의'

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
}

export interface PublicConsentInfo {
  studentName: string
  topic: string
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
