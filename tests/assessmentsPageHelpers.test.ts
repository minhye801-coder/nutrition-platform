import { describe, expect, it } from 'vitest'
import { describeAssessmentStatus, formatGradeClassNumber } from '../src/pages/AssessmentsPage'
import { ASSESSMENT_STATUS_CONFIRMED, EXTRACTION_STATUS_AI, EXTRACTION_STATUS_MANUAL } from '../src/types/assessment'
import type { AssessmentListItem } from '../src/types/assessment'

function item(overrides: Partial<AssessmentListItem['assessment']> & { caseId: string }): AssessmentListItem {
  return {
    caseTopic: '',
    caseStatus: '',
    studentName: '',
    grade: '',
    studentClass: '',
    studentNumber: '',
    assessment: {
      assessmentId: 'A1',
      tenantId: 't',
      caseId: overrides.caseId,
      studentUuid: 'STU-AAAA-AAAA-AAAA',
      round: '1차',
      timepoint: '사전',
      fileUrl: '',
      fileId: '',
      fileName: '',
      uploadedAt: '2026-07-01T00:00:00.000Z',
      uploadedBy: '',
      status: '검토 대기',
      reviewNote: '',
      reviewedAt: '',
      reviewedBy: '',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      extractionStatus: EXTRACTION_STATUS_MANUAL,
      extractedAt: '',
      caseRequestId: '',
      warnings: '',
      responseHighlights: '',
      ...overrides,
    } as AssessmentListItem['assessment'],
  }
}

describe('formatGradeClassNumber', () => {
  it('joins grade/class/number into a single Korean label', () => {
    expect(formatGradeClassNumber('5', '2', '15')).toBe('5학년 2반 15번')
  })

  it('returns an empty string when nothing is known', () => {
    expect(formatGradeClassNumber('', '', '')).toBe('')
  })

  it('omits missing parts gracefully', () => {
    expect(formatGradeClassNumber('5', '', '')).toBe('5학년')
  })
})

describe('describeAssessmentStatus', () => {
  it('returns 미실시 when the case has no assessments yet', () => {
    expect(describeAssessmentStatus('CASE-1', [])).toBe('미실시')
  })

  it('returns 분석 대기 for a manually-entered, unconfirmed record', () => {
    const items = [item({ caseId: 'CASE-1', status: '검토 대기', extractionStatus: EXTRACTION_STATUS_MANUAL })]
    expect(describeAssessmentStatus('CASE-1', items)).toBe('분석 대기')
  })

  it('returns AI 분석 완료(검토 대기) once Gemini has filled the record but it is unconfirmed', () => {
    const items = [item({ caseId: 'CASE-1', status: '검토 대기', extractionStatus: EXTRACTION_STATUS_AI })]
    expect(describeAssessmentStatus('CASE-1', items)).toBe('AI 분석 완료(검토 대기)')
  })

  it('returns 확인 완료 once the teacher has confirmed it', () => {
    const items = [item({ caseId: 'CASE-1', status: ASSESSMENT_STATUS_CONFIRMED, extractionStatus: EXTRACTION_STATUS_AI })]
    expect(describeAssessmentStatus('CASE-1', items)).toBe('확인 완료')
  })

  it('only looks at the matching caseId', () => {
    const items = [item({ caseId: 'CASE-OTHER', status: ASSESSMENT_STATUS_CONFIRMED })]
    expect(describeAssessmentStatus('CASE-1', items)).toBe('미실시')
  })
})
