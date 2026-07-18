import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireSchoolWorkspaceAccessMock = vi.fn()
const listAssessmentsMock = vi.fn()
const listCasesMock = vi.fn()
const listStudentsMock = vi.fn()

vi.mock('../functions/_lib/requireInstalledAccess', () => ({
  requireSchoolWorkspaceAccess: (...args: unknown[]) => requireSchoolWorkspaceAccessMock(...args),
  isAccessError: (result: unknown) => !!result && typeof result === 'object' && 'error' in (result as object),
}))

vi.mock('../functions/_lib/assessmentSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/assessmentSheet')>(
    '../functions/_lib/assessmentSheet',
  )
  return { ...actual, listAssessments: (...args: unknown[]) => listAssessmentsMock(...args) }
})

vi.mock('../functions/_lib/caseSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/caseSheet')>('../functions/_lib/caseSheet')
  return { ...actual, listCases: (...args: unknown[]) => listCasesMock(...args) }
})

vi.mock('../functions/_lib/studentSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/studentSheet')>(
    '../functions/_lib/studentSheet',
  )
  return { ...actual, listStudents: (...args: unknown[]) => listStudentsMock(...args) }
})

const FAKE_ACCESS = {
  session: {},
  installation: {},
  accessToken: 'token',
  spreadsheetId: 'sheet-1',
  identitySpreadsheetId: 'identity-sheet-1',
}

describe('GET /api/assessments — StudentID join', () => {
  beforeEach(() => {
    requireSchoolWorkspaceAccessMock.mockReset().mockResolvedValue(FAKE_ACCESS)
    listCasesMock.mockReset().mockResolvedValue([{ caseId: 'CASE-1', topic: '편식', status: '결과 확인' }])
  })

  it('matches a student to an assessment strictly by StudentID, even when two students share a name', async () => {
    listStudentsMock.mockResolvedValue([
      { studentUuid: 'STU-AAAA-AAAA-AAAA', name: '김민수', grade: '5', class: '2', studentNumber: '15' },
      { studentUuid: 'STU-BBBB-BBBB-BBBB', name: '김민수', grade: '3', class: '1', studentNumber: '7' },
    ])
    listAssessmentsMock.mockResolvedValue([
      {
        assessmentId: 'ASSESS-1',
        caseId: 'CASE-1',
        studentUuid: 'STU-BBBB-BBBB-BBBB',
        createdAt: '2026-07-18T00:00:00.000Z',
      },
    ])

    const { onRequestGet } = await import('../functions/api/assessments/index')
    const response = await onRequestGet({ request: new Request('https://example.com/api/assessments'), env: {} as never, params: {} } as never)
    const body = await response.json()

    expect(body.assessments).toHaveLength(1)
    // 이름만으로는 두 학생이 동일하지만, StudentID로 정확히 두 번째 학생(3학년 1반 7번)과 결합돼야 한다.
    expect(body.assessments[0].grade).toBe('3')
    expect(body.assessments[0].studentClass).toBe('1')
    expect(body.assessments[0].studentNumber).toBe('7')
  })

  it('leaves grade/class/number empty when the StudentID has no matching student', async () => {
    listStudentsMock.mockResolvedValue([])
    listAssessmentsMock.mockResolvedValue([
      { assessmentId: 'ASSESS-1', caseId: 'CASE-1', studentUuid: 'STU-ZZZZ-ZZZZ-ZZZZ', createdAt: '2026-07-18T00:00:00.000Z' },
    ])

    const { onRequestGet } = await import('../functions/api/assessments/index')
    const response = await onRequestGet({ request: new Request('https://example.com/api/assessments'), env: {} as never, params: {} } as never)
    const body = await response.json()

    expect(body.assessments[0].grade).toBe('')
    expect(body.assessments[0].studentName).toBe('')
  })
})
