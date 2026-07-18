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

/**
 * 보호자 이름/관계/연락처는 이 레코드에 없다 — 상담데이터에는 StudentID/동의상태/
 * 동의일/Drive 파일 참조만 저장한다(요구사항 5·7절). 보호자 정보는 제출 시점에
 * 생성되는 PDF 본문에만 있고, 화면에서 다시 보려면 그 PDF를 열어야 한다.
 */
export interface Consent {
  consentId: string
  tenantId: string
  intakeId: string
  caseId: string
  studentUuid: string
  consentToken: string
  status: string
  studentAssent: string
  counselingConsent: string
  personalInfoConsent: string
  sensitiveInfoConsent: string
  diagnosisUseConsent: string
  aiNoticeConfirmed: string
  requestedAt: string
  respondedAt: string
  consentedAt: string
  /** Drive fileId만 내려온다(URL 아님) — 화면에서 `https://drive.google.com/file/d/{id}/view`로 연다. */
  consentPdfFileId: string
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
