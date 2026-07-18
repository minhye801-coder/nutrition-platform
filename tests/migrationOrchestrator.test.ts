import { describe, expect, it } from 'vitest'
import { validateMigration } from '../functions/_lib/migrationOrchestrator'
import { STUDENT_HEADERS } from '../functions/_lib/studentSheet'
import { INTAKE_HEADERS } from '../functions/_lib/intakeSheet'
import { CASE_HEADERS } from '../functions/_lib/caseSheet'
import { ASSESSMENT_HEADERS } from '../functions/_lib/assessmentSheet'

const STUDENT_HEADER_LIST = [...STUDENT_HEADERS]
const INTAKE_HEADER_LIST = [...INTAKE_HEADERS]
const CASE_HEADER_LIST = [...CASE_HEADERS]
const ASSESSMENT_HEADER_LIST = [...ASSESSMENT_HEADERS]

function studentRow(overrides: Partial<Record<(typeof STUDENT_HEADERS)[number], string>>): string[] {
  const base: Record<string, string> = {
    studentUuid: 'STU-AAAA-BBBB-CCCC',
    tenantId: 'school-1',
    schoolYear: '2026',
    name: '김민수',
    grade: '5',
    class: '2',
    studentNumber: '15',
    enrollmentStatus: '재학',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  return STUDENT_HEADER_LIST.map((h) => base[h] ?? '')
}

function caseRow(overrides: Partial<Record<(typeof CASE_HEADERS)[number], string>>): string[] {
  const base: Record<string, string> = {
    caseId: 'CASE-1',
    tenantId: 'school-1',
    studentUuid: 'STU-AAAA-BBBB-CCCC',
    intakeId: 'INTAKE-1',
    schoolYear: '2026',
    topic: '편식',
    referralType: '보호자 신청',
    status: '상담 예정',
    nextScheduledAt: '',
    managerEmail: 'teacher@example.com',
    driveFolderUrl: '',
    openedAt: '2026-01-01T00:00:00.000Z',
    closedAt: '',
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  return CASE_HEADER_LIST.map((h) => base[h] ?? '')
}

function intakeRow(overrides: Partial<Record<(typeof INTAKE_HEADERS)[number], string>>): string[] {
  const base: Record<string, string> = {
    intakeId: 'INTAKE-1',
    tenantId: 'school-1',
    applicantType: '보호자',
    applicantName: '보호자',
    relationToStudent: '모',
    schoolYear: '2026',
    grade: '5',
    class: '2',
    studentNumber: '15',
    name: '김민수',
    topic: '편식',
    content: '',
    preferredTime: '',
    urgency: '일반',
    contactInfo: '',
    privacyConsent: '동의',
    note: '',
    studentUuid: 'STU-AAAA-BBBB-CCCC',
    status: '승인',
    submittedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  return INTAKE_HEADER_LIST.map((h) => base[h] ?? '')
}

function assessmentRow(overrides: Record<string, string>): string[] {
  const base: Record<string, string> = { studentUuid: 'STU-AAAA-BBBB-CCCC' }
  return ASSESSMENT_HEADER_LIST.map((h) => overrides[h] ?? base[h] ?? '')
}

describe('validateMigration', () => {
  it('reports everything linked and COMPLETED when every reference resolves', () => {
    const result = validateMigration(
      { headers: STUDENT_HEADER_LIST, rows: [studentRow({})] },
      { headers: INTAKE_HEADER_LIST, rows: [intakeRow({})] },
      { headers: CASE_HEADER_LIST, rows: [caseRow({})] },
      { headers: ASSESSMENT_HEADER_LIST, rows: [] },
    )
    expect(result.status).toBe('COMPLETED')
    expect(result.unresolvedRecords).toHaveLength(0)
    expect(result.linkedRecords).toBe(result.totalRecords)
    expect(result.totalStudents).toBe(1)
  })

  it('flags a case referencing a StudentID that does not exist in the identity sheet as unresolved', () => {
    const result = validateMigration(
      { headers: STUDENT_HEADER_LIST, rows: [studentRow({})] },
      { headers: INTAKE_HEADER_LIST, rows: [] },
      { headers: CASE_HEADER_LIST, rows: [caseRow({ studentUuid: 'STU-ZZZZ-ZZZZ-ZZZZ' })] },
      { headers: ASSESSMENT_HEADER_LIST, rows: [] },
    )
    expect(result.status).toBe('NEEDS_REVIEW')
    expect(result.unresolvedRecords).toHaveLength(1)
    expect(result.unresolvedRecords[0]).toMatchObject({
      source: '상담케이스',
      reason: 'not_found_in_identity_sheet',
    })
    // 전체 값이 아니라 마스킹된 값만 담아야 한다.
    expect(result.unresolvedRecords[0].studentIdMasked).not.toBe('STU-ZZZZ-ZZZZ-ZZZZ')
    expect(result.unresolvedRecords[0].studentIdMasked).toContain('****')
  })

  it('flags empty and malformed StudentID references separately', () => {
    const result = validateMigration(
      { headers: STUDENT_HEADER_LIST, rows: [studentRow({})] },
      { headers: INTAKE_HEADER_LIST, rows: [] },
      { headers: CASE_HEADER_LIST, rows: [] },
      {
        headers: ASSESSMENT_HEADER_LIST,
        rows: [assessmentRow({ studentUuid: '' }), assessmentRow({ studentUuid: 'not-a-valid-id' })],
      },
    )
    expect(result.unresolvedRecords).toHaveLength(2)
    expect(result.unresolvedRecords.map((r) => r.reason).sort()).toEqual(['empty_student_id', 'invalid_format'])
  })

  it('treats an approved intake with no StudentID as an unmigrated name-based reference', () => {
    const result = validateMigration(
      { headers: STUDENT_HEADER_LIST, rows: [] },
      { headers: INTAKE_HEADER_LIST, rows: [intakeRow({ studentUuid: '', status: '승인' })] },
      { headers: CASE_HEADER_LIST, rows: [] },
      { headers: ASSESSMENT_HEADER_LIST, rows: [] },
    )
    expect(result.unresolvedRecords).toHaveLength(1)
    expect(result.unresolvedRecords[0].reason).toBe('name_based_reference_not_migrated')
    expect(result.unresolvedRecords[0].namePartialMasked).toBe('김**')
  })

  it('does not treat unapproved intakes without a StudentID as unresolved', () => {
    const result = validateMigration(
      { headers: STUDENT_HEADER_LIST, rows: [] },
      { headers: INTAKE_HEADER_LIST, rows: [intakeRow({ studentUuid: '', status: '신규' })] },
      { headers: CASE_HEADER_LIST, rows: [] },
      { headers: ASSESSMENT_HEADER_LIST, rows: [] },
    )
    expect(result.unresolvedRecords).toHaveLength(0)
    expect(result.totalRecords).toBe(0)
    expect(result.status).toBe('COMPLETED')
  })

  it('counts exact duplicate StudentID values in the identity sheet', () => {
    const result = validateMigration(
      {
        headers: STUDENT_HEADER_LIST,
        rows: [studentRow({ name: '김민수' }), studentRow({ name: '이서연', studentUuid: 'STU-AAAA-BBBB-CCCC' })],
      },
      { headers: INTAKE_HEADER_LIST, rows: [] },
      { headers: CASE_HEADER_LIST, rows: [] },
      { headers: ASSESSMENT_HEADER_LIST, rows: [] },
    )
    expect(result.duplicateStudentIdCount).toBe(2)
  })

  it('flags same-name-and-year students with different grade/class/number as review candidates', () => {
    const result = validateMigration(
      {
        headers: STUDENT_HEADER_LIST,
        rows: [
          studentRow({ name: '김민수', grade: '5', class: '2', studentNumber: '15', studentUuid: 'STU-AAAA-AAAA-AAAA' }),
          studentRow({ name: '김민수', grade: '3', class: '1', studentNumber: '7', studentUuid: 'STU-BBBB-BBBB-BBBB' }),
        ],
      },
      { headers: INTAKE_HEADER_LIST, rows: [] },
      { headers: CASE_HEADER_LIST, rows: [] },
      { headers: ASSESSMENT_HEADER_LIST, rows: [] },
    )
    expect(result.samenameReviewCandidates).toBe(2)
    expect(result.duplicateCandidates).toBe(0)
  })
})
