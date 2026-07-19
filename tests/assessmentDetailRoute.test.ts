import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireSchoolWorkspaceAccessMock = vi.fn()
const getAssessmentMock = vi.fn()
const getCaseMock = vi.fn()
const getStudentByUuidMock = vi.fn()
const reviewAssessmentMock = vi.fn()
const transitionCaseStatusMock = vi.fn()

vi.mock('../functions/_lib/requireInstalledAccess', () => ({
  requireSchoolWorkspaceAccess: (...args: unknown[]) => requireSchoolWorkspaceAccessMock(...args),
  isAccessError: (result: unknown) => !!result && typeof result === 'object' && 'error' in (result as object),
}))

vi.mock('../functions/_lib/assessmentSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/assessmentSheet')>(
    '../functions/_lib/assessmentSheet',
  )
  return {
    ...actual,
    getAssessment: (...args: unknown[]) => getAssessmentMock(...args),
    reviewAssessment: (...args: unknown[]) => reviewAssessmentMock(...args),
  }
})

vi.mock('../functions/_lib/caseSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/caseSheet')>('../functions/_lib/caseSheet')
  return {
    ...actual,
    getCase: (...args: unknown[]) => getCaseMock(...args),
    transitionCaseStatus: (...args: unknown[]) => transitionCaseStatusMock(...args),
  }
})

vi.mock('../functions/_lib/studentSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/studentSheet')>(
    '../functions/_lib/studentSheet',
  )
  return { ...actual, getStudentByUuid: (...args: unknown[]) => getStudentByUuidMock(...args) }
})

const FAKE_ACCESS = {
  session: { email: 'teacher@example.com', googleSub: 'sub-1', accountMode: 'SCHOOL_WORKSPACE', schoolUseConfirmed: true },
  installation: { schoolPublicId: 'SCHOOL-1' },
  accessToken: 'token',
  spreadsheetId: 'sheet-1',
  identitySpreadsheetId: 'identity-sheet-1',
}

describe('GET /api/assessments/:assessmentId — StudentID로 학생 조인', () => {
  beforeEach(() => {
    requireSchoolWorkspaceAccessMock.mockReset().mockResolvedValue(FAKE_ACCESS)
    getCaseMock.mockReset().mockResolvedValue({ caseId: 'CASE-1', topic: '편식·균형 식생활', status: '결과 확인' })
  })

  it('shows the correct student name by StudentID even when another student on the same case list shares the name', async () => {
    // 요구사항 2·10절 테스트 1: 진단대상 이름이 StudentID 식별표의 학생과 일치해야 한다 —
    // 두 학생이 이름이 같아도(동명이인) studentUuid로 정확한 학생과 연결돼야 한다.
    getStudentByUuidMock.mockImplementation(async (_token: string, _sheetId: string, studentUuid: string) => {
      if (studentUuid === 'STU-BBBB-BBBB-BBBB') {
        return { studentUuid, name: '김민수', grade: '3', class: '1', studentNumber: '7' }
      }
      return null
    })
    getAssessmentMock.mockResolvedValue({
      assessmentId: 'ASSESS-1',
      caseId: 'CASE-1',
      studentUuid: 'STU-BBBB-BBBB-BBBB',
    })

    const { onRequestGet } = await import('../functions/api/assessments/[assessmentId]/index')
    const response = await onRequestGet({
      request: new Request('https://example.com/api/assessments/ASSESS-1'),
      env: {} as never,
      params: { assessmentId: 'ASSESS-1' },
    } as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.studentName).toBe('김민수')
    expect(body.grade).toBe('3')
    expect(body.studentClass).toBe('1')
    expect(body.studentNumber).toBe('7')
    expect(getStudentByUuidMock).toHaveBeenCalledWith('token', 'identity-sheet-1', 'STU-BBBB-BBBB-BBBB')
  })

  it('returns empty student fields (not a stale/wrong name) when the StudentID no longer resolves', async () => {
    getStudentByUuidMock.mockResolvedValue(null)
    getAssessmentMock.mockResolvedValue({ assessmentId: 'ASSESS-1', caseId: 'CASE-1', studentUuid: 'STU-ZZZZ-ZZZZ-ZZZZ' })

    const { onRequestGet } = await import('../functions/api/assessments/[assessmentId]/index')
    const response = await onRequestGet({
      request: new Request('https://example.com/api/assessments/ASSESS-1'),
      env: {} as never,
      params: { assessmentId: 'ASSESS-1' },
    } as never)
    const body = await response.json()

    expect(body.studentName).toBe('')
  })
})

describe('PATCH /api/assessments/:assessmentId — 교사 확인 후 단계 전환', () => {
  beforeEach(() => {
    requireSchoolWorkspaceAccessMock.mockReset().mockResolvedValue(FAKE_ACCESS)
    transitionCaseStatusMock.mockReset().mockResolvedValue({ ok: true, transitioned: true })
  })

  it('transitions the case from 결과 확인 to 상담 예정 once the teacher confirms the review', async () => {
    // 요구사항 7·10절 테스트 11: 교사 검토 완료 후 다음 단계로 정상 전환된다.
    reviewAssessmentMock.mockReset().mockResolvedValue({
      ok: true,
      confirmed: true,
      assessment: { assessmentId: 'ASSESS-1', caseId: 'CASE-1', status: '확인 완료' },
    })

    const { onRequestPatch } = await import('../functions/api/assessments/[assessmentId]/index')
    const request = new Request('https://example.com/api/assessments/ASSESS-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })
    const response = await onRequestPatch({
      request,
      env: {} as never,
      params: { assessmentId: 'ASSESS-1' },
    } as never)

    expect(response.status).toBe(200)
    expect(transitionCaseStatusMock).toHaveBeenCalledWith('token', 'sheet-1', 'CASE-1', ['결과 확인'], '상담 예정')
  })

  it('does not transition the case when the teacher only saves a draft (confirm=false)', async () => {
    reviewAssessmentMock.mockReset().mockResolvedValue({
      ok: true,
      confirmed: false,
      assessment: { assessmentId: 'ASSESS-1', caseId: 'CASE-1', status: '검토 대기' },
    })

    const { onRequestPatch } = await import('../functions/api/assessments/[assessmentId]/index')
    const request = new Request('https://example.com/api/assessments/ASSESS-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: false }),
    })
    const response = await onRequestPatch({
      request,
      env: {} as never,
      params: { assessmentId: 'ASSESS-1' },
    } as never)

    expect(response.status).toBe(200)
    expect(transitionCaseStatusMock).not.toHaveBeenCalled()
  })
})
