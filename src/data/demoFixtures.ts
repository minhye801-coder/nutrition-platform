import type { Student } from '@/types/student'
import type { Case, CaseDetail, CaseSearchItem } from '@/types/case'
import type { Consent, ConsentDetail, ConsentListItem } from '@/types/consent'
import type { Assessment } from '@/types/assessment'
import type { Intake } from '@/types/intake'

/**
 * PERSONAL_ACCOUNT_BLOCKED/WORKSPACE_CONFIRMATION_REQUIRED/DEMO_GUEST 계정이 보는 가상 데이터. 학생 이름은 전부
 * 가공인물이고 studentUuid는 실제 발급 포맷(STU-XXXX-XXXX-XXXX, functions/_lib/crypto.ts
 * generateStudentId)과 겹치지 않도록 "STU-DEMO-"로 시작한다 — 실제 학생 데이터와
 * 절대 섞이지 않게 하기 위한 구분자다. 이 파일의 배열은 읽기 전용 시드이고, 실제
 * 조회/등록은 이 시드를 복제해 쓰는 src/data/demoStore.ts가 담당한다.
 */

export const DEMO_STUDENTS: Student[] = [
  {
    studentUuid: 'STU-DEMO-0001',
    tenantId: 'demo',
    schoolYear: '2026',
    name: '김민수',
    grade: '5',
    class: '2',
    studentNumber: '15',
    enrollmentStatus: '재학',
    createdAt: '2026-03-04T00:00:00.000Z',
    updatedAt: '2026-03-04T00:00:00.000Z',
  },
  {
    studentUuid: 'STU-DEMO-0002',
    tenantId: 'demo',
    schoolYear: '2026',
    name: '이서연',
    grade: '4',
    class: '1',
    studentNumber: '8',
    enrollmentStatus: '재학',
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: '2026-03-10T00:00:00.000Z',
  },
  {
    studentUuid: 'STU-DEMO-0003',
    tenantId: 'demo',
    schoolYear: '2026',
    name: '박도윤',
    grade: '6',
    class: '3',
    studentNumber: '22',
    enrollmentStatus: '재학',
    createdAt: '2026-04-02T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
  },
]

export const DEMO_CASES: Case[] = [
  {
    caseId: 'DEMO-CASE-0001',
    tenantId: 'demo',
    studentUuid: 'STU-DEMO-0001',
    intakeId: 'DEMO-INTAKE-0001',
    schoolYear: '2026',
    topic: '편식·균형 식생활',
    referralType: '보호자 신청',
    status: '상담 예정',
    nextScheduledAt: '2026-07-25T05:00:00.000Z',
    managerEmail: 'demo@example.com',
    driveFolderUrl: '',
    openedAt: '2026-07-10T00:00:00.000Z',
    closedAt: '',
    note: '체험 모드 샘플 케이스입니다.',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  },
  {
    caseId: 'DEMO-CASE-0002',
    tenantId: 'demo',
    studentUuid: 'STU-DEMO-0002',
    intakeId: 'DEMO-INTAKE-0002',
    schoolYear: '2026',
    topic: '체중·성장',
    referralType: '담임교사 의뢰',
    status: '진단 대기',
    nextScheduledAt: '',
    managerEmail: 'demo@example.com',
    driveFolderUrl: '',
    openedAt: '2026-07-14T00:00:00.000Z',
    closedAt: '',
    note: '체험 모드 샘플 케이스입니다.',
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
  },
]

export const DEMO_CASE_SEARCH_ITEMS: CaseSearchItem[] = [
  {
    caseId: 'DEMO-CASE-0001',
    studentUuid: 'STU-DEMO-0001',
    gradeClass: '5학년 2반 15번',
    studentName: '김민수',
    topic: '편식·균형 식생활',
    status: '상담 예정',
    sessionCount: 1,
    lastSessionDate: '2026-07-18',
    nextDate: '2026-07-25',
    latestGoal: '저녁 식사에 채소 한 가지 이상 포함하기',
  },
  {
    caseId: 'DEMO-CASE-0002',
    studentUuid: 'STU-DEMO-0002',
    gradeClass: '4학년 1반 8번',
    studentName: '이서연',
    topic: '체중·성장',
    status: '진단 대기',
    sessionCount: 0,
    lastSessionDate: '',
    nextDate: '',
    latestGoal: '',
  },
]

export const DEMO_CASE_DETAILS: Record<string, CaseDetail> = {
  'DEMO-CASE-0001': {
    case: DEMO_CASES[0],
    studentName: '김민수',
    gradeClass: '5학년 2반 15번',
    consentStatus: '동의 완료',
  },
  'DEMO-CASE-0002': {
    case: DEMO_CASES[1],
    studentName: '이서연',
    gradeClass: '4학년 1반 8번',
    consentStatus: '동의 요청',
  },
}

const DEMO_CONSENT_BASE: Omit<Consent, 'status' | 'caseId' | 'studentUuid' | 'consentId'> = {
  tenantId: 'demo',
  intakeId: '',
  consentToken: '',
  studentAssent: '미확인',
  counselingConsent: '',
  personalInfoConsent: '',
  sensitiveInfoConsent: '',
  diagnosisUseConsent: '',
  aiNoticeConfirmed: '',
  requestedAt: '',
  respondedAt: '',
  consentedAt: '',
  consentPdfFileId: '',
  confirmedAt: '',
  confirmedBy: '',
  note: '',
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
}

export const DEMO_CONSENTS: Consent[] = [
  {
    ...DEMO_CONSENT_BASE,
    consentId: 'DEMO-CONSENT-0001',
    caseId: 'DEMO-CASE-0001',
    studentUuid: 'STU-DEMO-0001',
    status: '동의 완료',
    requestedAt: '2026-07-10T00:00:00.000Z',
    respondedAt: '2026-07-11T00:00:00.000Z',
    consentedAt: '2026-07-11T00:00:00.000Z',
    confirmedAt: '2026-07-12T00:00:00.000Z',
    confirmedBy: 'demo@example.com',
  },
  {
    ...DEMO_CONSENT_BASE,
    consentId: 'DEMO-CONSENT-0002',
    caseId: 'DEMO-CASE-0002',
    studentUuid: 'STU-DEMO-0002',
    status: '동의 요청',
    requestedAt: '2026-07-14T00:00:00.000Z',
  },
]

export const DEMO_CONSENT_LIST_ITEMS: ConsentListItem[] = [
  {
    consent: DEMO_CONSENTS[0],
    caseTopic: '편식·균형 식생활',
    caseStatus: '상담 예정',
    caseOpenedAt: DEMO_CASES[0].openedAt,
    studentName: '김민수',
    gradeClass: '5학년 2반 15번',
    grade: '5',
    studentClass: '2',
    studentNumber: '15',
  },
  {
    consent: DEMO_CONSENTS[1],
    caseTopic: '체중·성장',
    caseStatus: '진단 대기',
    caseOpenedAt: DEMO_CASES[1].openedAt,
    studentName: '이서연',
    gradeClass: '4학년 1반 8번',
    grade: '4',
    studentClass: '1',
    studentNumber: '8',
  },
]

export const DEMO_CONSENT_DETAILS: Record<string, ConsentDetail> = {
  'DEMO-CASE-0001': {
    caseId: 'DEMO-CASE-0001',
    studentName: '김민수',
    gradeClass: '5학년 2반 15번',
    topic: '편식·균형 식생활',
    caseStatus: '상담 예정',
    consent: DEMO_CONSENTS[0],
  },
  'DEMO-CASE-0002': {
    caseId: 'DEMO-CASE-0002',
    studentName: '이서연',
    gradeClass: '4학년 1반 8번',
    topic: '체중·성장',
    caseStatus: '진단 대기',
    consent: DEMO_CONSENTS[1],
  },
}

const DEMO_EXTRACTED_FIELDS: Assessment = {
  assessmentId: 'DEMO-ASSESS-0001',
  tenantId: 'demo',
  caseId: 'DEMO-CASE-0001',
  studentUuid: 'STU-DEMO-0001',
  round: '1',
  timepoint: '사전',
  fileUrl: '',
  fileId: '',
  fileName: '샘플_진단결과.pdf',
  uploadedAt: '2026-07-15T00:00:00.000Z',
  uploadedBy: 'demo@example.com',
  status: '확인 완료',
  reviewNote: '',
  reviewedAt: '2026-07-16T00:00:00.000Z',
  reviewedBy: 'demo@example.com',
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z',
  extractionStatus: 'AI 추출',
  extractedAt: '2026-07-15T00:10:00.000Z',
  caseRequestId: 'CASE-20260715-DEMO',
  warnings: '',
  responseHighlights: '아침 결식이 잦다는 응답이 확인됩니다(샘플).',
  gradeBand: '초등 고학년',
  sex: '남',
  heightCm: '142.3',
  heightPercentile: '55',
  weightKg: '36.8',
  weightPercentile: '60',
  bmi: '18.2',
  bmiPercentile: '58',
  subjectiveHealth: '보통',
  bodyImage: '보통',
  mealFrequency: '3회',
  regularMealTime: '보통',
  eatingSpeed: '빠름',
  mealAmount: '보통',
  totalLevel: '양호',
  totalScore: '78',
  balanceLevel: '보통',
  balanceScore: '72',
  moderationLevel: '양호',
  moderationScore: '80',
  practiceLevel: '보통',
  practiceScore: '75',
  eatingAttitude: '보통',
  eatingAttitudeScore: '74',
  allergy: '없음',
  disease: '없음',
  sleepLevel: '양호',
  sleepDuration: '8시간',
  mentalHealth: '양호',
  smartphoneUsageLevel: '보통',
  weekdaySmartphoneHours: '2',
  weekendSmartphoneHours: '4',
  smartphoneOverdependence: '주의',
  additionalRequest: '균형 잡힌 식습관 형성을 돕고 싶습니다(샘플 데이터).',
}

export const DEMO_ASSESSMENTS: Assessment[] = [DEMO_EXTRACTED_FIELDS]

export const DEMO_INTAKES: Intake[] = [
  {
    intakeId: 'DEMO-INTAKE-0003',
    tenantId: 'demo',
    applicantType: '보호자',
    applicantName: '(체험 모드 샘플 보호자)',
    relationToStudent: '모',
    schoolYear: '2026',
    grade: '6',
    class: '3',
    studentNumber: '22',
    name: '박도윤',
    topic: '간식·단 음료',
    content: '단 음료 섭취가 잦아 상담을 요청합니다(샘플 데이터).',
    preferredTime: '점심시간',
    urgency: '일반',
    contactInfo: '010-0000-0000',
    privacyConsent: '동의',
    note: '',
    studentUuid: '',
    status: '신규',
    submittedAt: '2026-07-17T00:00:00.000Z',
    updatedAt: '2026-07-17T00:00:00.000Z',
  },
]
