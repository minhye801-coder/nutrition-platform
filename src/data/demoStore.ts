import {
  DEMO_STUDENTS,
  DEMO_CASES,
  DEMO_CASE_SEARCH_ITEMS,
  DEMO_CASE_DETAILS,
  DEMO_CONSENT_LIST_ITEMS,
  DEMO_CONSENT_DETAILS,
  DEMO_ASSESSMENTS,
  DEMO_INTAKES,
} from '@/data/demoFixtures'
import type { CreateStudentInput, Student, StudentListFilters, UpdateStudentInput } from '@/types/student'
import type { CaseDetail, CaseSearchFilters, CaseSearchItem } from '@/types/case'
import type { Consent, ConsentDetail, ConsentListItem } from '@/types/consent'
import { ASSESSMENT_EXTRACTED_FIELDS } from '@/types/assessment'
import type { Assessment, AssessmentExtractedFields, AssessmentListItem } from '@/types/assessment'
import type { Intake, IntakeListFilters } from '@/types/intake'

/**
 * PERSONAL_ACCOUNT_BLOCKED/WORKSPACE_CONFIRMATION_REQUIRED/DEMO_GUEST 계정이 화면을 조작할 때 실제로 쓰는 인메모리
 * 저장소. 페이지를 새로고침하면 시드로 초기화된다 — 서버(D1/Sheets/Drive) 어디에도
 * 쓰지 않는다(요구사항 3절 "실제 상담자료 Google Drive/Sheets 저장 차단"을 구조적으로
 * 만족). 실제 서비스 함수와 시그니처를 최대한 맞춰서, src/services/*.ts의 분기
 * 로직이 최소한이 되게 한다.
 */

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

let students = clone(DEMO_STUDENTS)
const caseSearchItems = clone(DEMO_CASE_SEARCH_ITEMS)
const caseDetails = clone(DEMO_CASE_DETAILS)
const consentListItems = clone(DEMO_CONSENT_LIST_ITEMS)
const consentDetails = clone(DEMO_CONSENT_DETAILS)
let assessments = clone(DEMO_ASSESSMENTS)
const intakes = clone(DEMO_INTAKES)

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase()
}

function demoId(prefix: string): string {
  return `DEMO-${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export const demoStudentStore = {
  async list(filters: StudentListFilters = {}): Promise<Student[]> {
    let result = students
    if (!filters.status || filters.status === 'active') {
      result = result.filter((s) => s.enrollmentStatus !== '비활성')
    } else if (filters.status !== 'all') {
      result = result.filter((s) => s.enrollmentStatus === filters.status)
    }
    if (filters.schoolYear) result = result.filter((s) => s.schoolYear === filters.schoolYear)
    if (filters.grade) result = result.filter((s) => s.grade === filters.grade)
    if (filters.class) result = result.filter((s) => s.class === filters.class)
    if (filters.q) {
      const q = normalize(filters.q)
      result = result.filter((s) => normalize(s.name).includes(q))
    }
    return clone(result)
  },

  /**
   * 데모 모드에서는 화면이 자유 이름 입력란 자체를 렌더링하지 않지만(StudentsPage
   * 참고), 서버 API를 우회해 직접 호출하는 경우까지 대비해 여기서도 실명으로 보이는
   * 입력을 막지는 않는 대신 — 애초에 이 저장소가 진짜 Drive/Sheets에 쓰지 않으므로
   * 어떤 값을 넣어도 실제 학생 자료가 되지 않는다(요구사항 3절의 핵심은 "저장소
   * 자체가 실제 학교 데이터베이스가 아닌 것").
   */
  async create(input: CreateStudentInput): Promise<Student> {
    const now = new Date().toISOString()
    const record: Student = {
      studentUuid: demoId('STU'),
      tenantId: 'demo',
      schoolYear: input.schoolYear,
      name: input.name,
      grade: input.grade,
      class: input.class,
      studentNumber: input.studentNumber ?? '',
      enrollmentStatus: '재학',
      createdAt: now,
      updatedAt: now,
    }
    students = [...students, record]
    return clone(record)
  },

  async update(studentUuid: string, patch: UpdateStudentInput): Promise<Student> {
    const index = students.findIndex((s) => s.studentUuid === studentUuid)
    if (index === -1) throw new Error('not_found')
    students[index] = { ...students[index], ...patch, updatedAt: new Date().toISOString() }
    return clone(students[index])
  },

  async setEnrollmentStatus(studentUuid: string, status: string): Promise<Student> {
    const index = students.findIndex((s) => s.studentUuid === studentUuid)
    if (index === -1) throw new Error('not_found')
    students[index] = { ...students[index], enrollmentStatus: status, updatedAt: new Date().toISOString() }
    return clone(students[index])
  },
}

export const demoCaseStore = {
  async list(filters: CaseSearchFilters = {}): Promise<CaseSearchItem[]> {
    let result = caseSearchItems
    if (filters.status) result = result.filter((c) => c.status === filters.status)
    if (filters.keyword) {
      const q = normalize(filters.keyword)
      result = result.filter((c) => normalize(c.studentName).includes(q) || normalize(c.topic).includes(q))
    }
    return clone(result)
  },
  async detail(caseId: string): Promise<CaseDetail> {
    const detail = caseDetails[caseId]
    if (!detail) throw new Error('not_found')
    return clone(detail)
  },
}

export const demoConsentStore = {
  async list(): Promise<ConsentListItem[]> {
    return clone(consentListItems)
  },
  async detail(caseId: string): Promise<ConsentDetail> {
    const detail = consentDetails[caseId]
    if (!detail) throw new Error('not_found')
    return clone(detail)
  },
  async saveStudentAssent(caseId: string, studentAssent: string): Promise<Consent> {
    const detail = consentDetails[caseId]
    if (!detail) throw new Error('not_found')
    detail.consent.studentAssent = studentAssent
    detail.consent.updatedAt = new Date().toISOString()
    const listItem = consentListItems.find((item) => item.consent.caseId === caseId)
    if (listItem) listItem.consent.studentAssent = studentAssent
    return clone(detail.consent)
  },
  async sendConsentLink(caseId: string): Promise<{ consent: Consent; alreadySent: boolean }> {
    const detail = consentDetails[caseId]
    if (!detail) throw new Error('not_found')
    const alreadySent = detail.consent.status !== '미발송'
    if (!alreadySent) {
      detail.consent.status = '동의 요청'
      detail.consent.requestedAt = new Date().toISOString()
    }
    return { consent: clone(detail.consent), alreadySent }
  },
  async confirmConsent(caseId: string): Promise<{ consent: Consent; alreadyConfirmed: boolean }> {
    const detail = consentDetails[caseId]
    if (!detail) throw new Error('not_found')
    const alreadyConfirmed = detail.consent.status === '동의 완료'
    if (!alreadyConfirmed) {
      detail.consent.status = '동의 완료'
      detail.consent.confirmedAt = new Date().toISOString()
      detail.consent.confirmedBy = '체험 모드'
    }
    return { consent: clone(detail.consent), alreadyConfirmed }
  },
}

/** 체험 모드 assessments 배열을 case/student 시드와 StudentID로 조인한다 — 실제
 * API(GET /api/assessments, GET /api/assessments/:id)와 동일한 조인 방식이라, 새로 등록한
 * 데모 검사결과도 곧바로 올바른 학생 이름으로 보인다(별도 고정 목록을 두지 않는다). */
function joinAssessment(assessment: Assessment): AssessmentListItem {
  const caseRecord = DEMO_CASES.find((c) => c.caseId === assessment.caseId)
  const student = students.find((s) => s.studentUuid === assessment.studentUuid)
  return {
    assessment,
    caseTopic: caseRecord?.topic ?? '',
    caseStatus: caseRecord?.status ?? '',
    studentName: student?.name ?? '',
    grade: student?.grade ?? '',
    studentClass: student?.class ?? '',
    studentNumber: student?.studentNumber ?? '',
  }
}

export const demoAssessmentStore = {
  async list(): Promise<AssessmentListItem[]> {
    return assessments.map((a) => clone(joinAssessment(a)))
  },
  async detail(assessmentId: string): Promise<AssessmentListItem> {
    const found = assessments.find((a) => a.assessmentId === assessmentId)
    if (!found) throw new Error('not_found')
    return clone(joinAssessment(found))
  },
  /**
   * 체험 모드는 원본 파일을 실제로 읽지 않는다 — 항상 준비된 샘플 결과만 돌려준다.
   * 실제 ensureAssessment(functions/_lib/assessmentSheet.ts)와 동일하게 같은
   * caseId+timepoint 기록이 이미 있으면 새로 만들지 않고 그대로 돌려준다(요구사항
   * 3·8절 — 체험 모드에서도 중복 등록이 재현되지 않아야 한다).
   */
  async uploadSample(caseId: string, round: string, timepoint: string): Promise<Assessment> {
    const existing = assessments.find((a) => a.caseId === caseId && a.timepoint === timepoint)
    if (existing) return clone(existing)

    // 실제 ensureAssessment/createAssessment와 동일하게 처음에는 38개 필드를 전부
    // 빈 값으로 시작한다(assessmentSheet.ts emptyExtractedFields) — 다른 학생의 샘플
    // 진단값을 복사해 오면 "PDF 선택 전인데 값이 이미 채워져 있는" 잘못된 상태가 된다.
    const emptyFields = {} as AssessmentExtractedFields
    for (const key of ASSESSMENT_EXTRACTED_FIELDS) emptyFields[key] = ''

    const now = new Date().toISOString()
    const studentUuid = DEMO_CASES.find((c) => c.caseId === caseId)?.studentUuid ?? ''
    const record: Assessment = {
      ...emptyFields,
      assessmentId: demoId('ASSESS'),
      tenantId: 'demo',
      caseId,
      studentUuid,
      round,
      timepoint,
      fileUrl: '',
      fileId: '',
      fileName: '',
      uploadedAt: now,
      uploadedBy: 'demo@example.com',
      status: '검토 대기',
      reviewNote: '',
      reviewedAt: '',
      reviewedBy: '',
      createdAt: now,
      updatedAt: now,
      extractionStatus: '수동 입력',
      extractedAt: '',
      caseRequestId: '',
      warnings: '',
      responseHighlights: '',
      reviewFlags: '',
      mergedIntoAssessmentId: '',
    }
    assessments = [...assessments, record]
    return clone(record)
  },
  async extractSample(assessmentId: string): Promise<Assessment> {
    const index = assessments.findIndex((a) => a.assessmentId === assessmentId)
    if (index === -1) throw new Error('not_found')
    const sampleFields = clone(assessments[0])
    assessments[index] = {
      ...assessments[index],
      ...sampleFields,
      assessmentId,
      status: '검토 대기',
      extractionStatus: 'AI 추출',
      extractedAt: new Date().toISOString(),
      responseHighlights: '체험 모드 샘플 분석 결과입니다. 실제 Gemini 호출은 발생하지 않았습니다.',
    }
    return clone(assessments[index])
  },
  async review(
    assessmentId: string,
    payload: Partial<Assessment> & { confirm: boolean; reviewFlagCodes?: string[] },
  ): Promise<{ assessment: Assessment; confirmed: boolean }> {
    const index = assessments.findIndex((a) => a.assessmentId === assessmentId)
    if (index === -1) throw new Error('not_found')
    const { reviewFlagCodes, ...rest } = payload
    assessments[index] = {
      ...assessments[index],
      ...rest,
      reviewFlags: reviewFlagCodes ? reviewFlagCodes.join('\n') : assessments[index].reviewFlags,
      status: payload.confirm ? '확인 완료' : assessments[index].status,
      reviewedAt: payload.confirm ? new Date().toISOString() : assessments[index].reviewedAt,
      updatedAt: new Date().toISOString(),
    }
    return { assessment: clone(assessments[index]), confirmed: payload.confirm }
  },
}

export const demoIntakeStore = {
  async list(filters: IntakeListFilters = {}): Promise<Intake[]> {
    let result = intakes
    if (filters.status) result = result.filter((i) => i.status === filters.status)
    if (filters.q) {
      const q = normalize(filters.q)
      result = result.filter((i) => normalize(i.name).includes(q))
    }
    return clone(result)
  },
  async detail(intakeId: string): Promise<Intake> {
    const found = intakes.find((i) => i.intakeId === intakeId)
    if (!found) throw new Error('not_found')
    return clone(found)
  },
  async setStatus(intakeId: string, status: string): Promise<Intake> {
    const index = intakes.findIndex((i) => i.intakeId === intakeId)
    if (index === -1) throw new Error('not_found')
    intakes[index] = { ...intakes[index], status, updatedAt: new Date().toISOString() }
    return clone(intakes[index])
  },
}
