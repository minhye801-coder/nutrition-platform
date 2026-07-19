import { describe, expect, it, vi, beforeEach } from 'vitest'

const getValuesMock = vi.fn()
const appendValuesMock = vi.fn()
const updateValuesMock = vi.fn()

vi.mock('../functions/_lib/googleSheets', () => ({
  getValues: (...args: unknown[]) => getValuesMock(...args),
  appendValues: (...args: unknown[]) => appendValuesMock(...args),
  updateValues: (...args: unknown[]) => updateValuesMock(...args),
}))

import { ASSESSMENT_HEADERS, ensureAssessment, type CreateAssessmentInput } from '../functions/_lib/assessmentSheet'

/**
 * legacy `ensureDiagnosisRecord_`(counseling-manager/code.gs.txt:3859-3885)와 동일한
 * caseId+timepoint 유일성 규칙을 이 저장소의 ensureAssessment가 그대로 지키는지 검증한다
 * (요구사항 3·8절, 회귀 테스트 4/5/15).
 */
describe('ensureAssessment — caseId+timepoint 유일성(중복 등록 방지)', () => {
  let rows: string[][]

  beforeEach(() => {
    rows = [[...ASSESSMENT_HEADERS]]
    getValuesMock.mockReset().mockImplementation(async () => rows)
    appendValuesMock.mockReset().mockImplementation(async (_token: string, _sheetId: string, _range: string, values: string[][]) => {
      rows.push(...values)
    })
    updateValuesMock.mockReset().mockResolvedValue(undefined)
  })

  const baseInput: CreateAssessmentInput = {
    tenantId: 'SCHOOL-1',
    caseId: 'CASE-1',
    studentUuid: 'STU-AAAA-AAAA-AAAA',
    round: '1차',
    timepoint: '사전',
    uploadedBy: 'teacher@example.com',
  }

  it('creates exactly one row across repeated calls for the same caseId+timepoint (double click / page refresh / retry)', async () => {
    const first = await ensureAssessment('token', 'sheet-1', baseInput)
    const second = await ensureAssessment('token', 'sheet-1', baseInput)
    const third = await ensureAssessment('token', 'sheet-1', baseInput)

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(third.created).toBe(false)
    expect(second.assessment.assessmentId).toBe(first.assessment.assessmentId)
    expect(third.assessment.assessmentId).toBe(first.assessment.assessmentId)
    expect(appendValuesMock).toHaveBeenCalledTimes(1)
    // 헤더 행 + 데이터 행 1개만 존재해야 한다.
    expect(rows).toHaveLength(2)
  })

  it('keeps 사전 and 사후 as two separate records for the same case', async () => {
    const pre = await ensureAssessment('token', 'sheet-1', { ...baseInput, timepoint: '사전' })
    const post = await ensureAssessment('token', 'sheet-1', { ...baseInput, round: '2차', timepoint: '사후' })

    expect(pre.assessment.assessmentId).not.toBe(post.assessment.assessmentId)
    expect(appendValuesMock).toHaveBeenCalledTimes(2)
    expect(rows).toHaveLength(3) // 헤더 + 사전 1행 + 사후 1행

    // 사후를 다시 등록해도 새 행이 생기지 않는다.
    const postAgain = await ensureAssessment('token', 'sheet-1', { ...baseInput, round: '2차', timepoint: '사후' })
    expect(postAgain.assessment.assessmentId).toBe(post.assessment.assessmentId)
    expect(appendValuesMock).toHaveBeenCalledTimes(2)
  })

  it('keeps different cases fully independent even with the same timepoint', async () => {
    const caseA = await ensureAssessment('token', 'sheet-1', { ...baseInput, caseId: 'CASE-A' })
    const caseB = await ensureAssessment('token', 'sheet-1', { ...baseInput, caseId: 'CASE-B' })

    expect(caseA.assessment.assessmentId).not.toBe(caseB.assessment.assessmentId)
    expect(appendValuesMock).toHaveBeenCalledTimes(2)
  })
})
