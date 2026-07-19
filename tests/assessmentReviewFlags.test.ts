import { describe, expect, it, vi, beforeEach } from 'vitest'

const getValuesMock = vi.fn()
const appendValuesMock = vi.fn()
const updateValuesMock = vi.fn()

vi.mock('../functions/_lib/googleSheets', () => ({
  getValues: (...args: unknown[]) => getValuesMock(...args),
  appendValues: (...args: unknown[]) => appendValuesMock(...args),
  updateValues: (...args: unknown[]) => updateValuesMock(...args),
}))

import {
  ASSESSMENT_HEADERS,
  applyExtraction,
  ensureAssessment,
  getAssessment,
  isReviewFlagCode,
  type CreateAssessmentInput,
} from '../functions/_lib/assessmentSheet'

/**
 * 요구사항 2·10절: 비식별 경고코드(reviewFlags)가 저장되고, 진단기록을 다시 열었을 때도
 * (별도 GET 조회) 그대로 남아 있어야 한다 — 이름/PDF 원문이 아니라 코드만.
 */
describe('reviewFlags — 비식별 경고코드 저장/재조회', () => {
  let rows: string[][]

  beforeEach(() => {
    rows = [[...ASSESSMENT_HEADERS]]
    getValuesMock.mockReset().mockImplementation(async () => rows)
    appendValuesMock.mockReset().mockImplementation(async (_t: string, _s: string, _r: string, values: string[][]) => {
      rows.push(...values)
    })
    updateValuesMock.mockReset().mockImplementation(async (_t: string, _s: string, range: string, values: string[][]) => {
      const match = range.match(/!A(\d+):/)
      if (!match) return
      rows[Number(match[1]) - 1] = values[0]
    })
  })

  const baseInput: CreateAssessmentInput = {
    tenantId: 'SCHOOL-1',
    caseId: 'CASE-1',
    studentUuid: 'STU-AAAA-AAAA-AAAA',
    round: '1차',
    timepoint: '사전',
    uploadedBy: 'teacher@example.com',
  }

  it('validates isReviewFlagCode against the known enum', () => {
    expect(isReviewFlagCode('STUDENT_NAME_MISMATCH')).toBe(true)
    expect(isReviewFlagCode('GRADE_MISMATCH')).toBe(true)
    expect(isReviewFlagCode('김민수')).toBe(false)
    expect(isReviewFlagCode('')).toBe(false)
  })

  it('persists review flag codes through applyExtraction and returns them on a later getAssessment (reopen)', async () => {
    const created = await ensureAssessment('token', 'sheet-1', baseInput)

    await applyExtraction('token', 'sheet-1', created.assessment.assessmentId, {
      extracted: {} as never,
      warnings: [],
      responseHighlights: ['아침 결식 잦음'],
      rawJson: '{}',
      caseRequestId: 'CASE-20260719-AB12',
      reviewFlagCodes: ['STUDENT_NAME_MISMATCH', 'RESPONSE_PDF_MISSING'],
    })

    // "재조회"를 흉내낸다 — 완전히 새 GET 요청처럼 assessmentId만으로 다시 읽는다.
    const reopened = await getAssessment('token', 'sheet-1', created.assessment.assessmentId)
    expect(reopened?.reviewFlags.split('\n').sort()).toEqual(['RESPONSE_PDF_MISSING', 'STUDENT_NAME_MISMATCH'])

    // 실제 학생 이름이나 PDF 원문은 어디에도 저장되지 않는다 — reviewFlags의 모든 값이
    // 알려진 코드 중 하나여야 한다(자유 텍스트가 섞여 들어올 수 없다).
    for (const code of reopened!.reviewFlags.split('\n')) {
      expect(isReviewFlagCode(code)).toBe(true)
    }
  })
})
