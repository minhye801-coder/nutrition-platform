import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireSchoolWorkspaceAccessMock = vi.fn()
const getCaseMock = vi.fn()
const transitionCaseStatusMock = vi.fn()
const createAssessmentMock = vi.fn()

vi.mock('../functions/_lib/requireInstalledAccess', () => ({
  requireSchoolWorkspaceAccess: (...args: unknown[]) => requireSchoolWorkspaceAccessMock(...args),
  isAccessError: (result: unknown) => !!result && typeof result === 'object' && 'error' in (result as object),
}))

vi.mock('../functions/_lib/caseSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/caseSheet')>('../functions/_lib/caseSheet')
  return {
    ...actual,
    getCase: (...args: unknown[]) => getCaseMock(...args),
    transitionCaseStatus: (...args: unknown[]) => transitionCaseStatusMock(...args),
  }
})

vi.mock('../functions/_lib/assessmentSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/assessmentSheet')>(
    '../functions/_lib/assessmentSheet',
  )
  return {
    ...actual,
    createAssessment: (...args: unknown[]) => createAssessmentMock(...args),
    listAssessmentsByCase: vi.fn(),
  }
})

const FAKE_ACCESS = {
  session: { email: 'teacher@example.com', googleSub: 'sub-1', accountMode: 'SCHOOL_WORKSPACE', schoolUseConfirmed: true },
  installation: { schoolPublicId: 'SCHOOL-1' },
  accessToken: 'token',
  spreadsheetId: 'sheet-1',
  identitySpreadsheetId: 'identity-sheet-1',
}

describe('POST /api/cases/:caseId/assessments', () => {
  beforeEach(() => {
    vi.resetModules()
    requireSchoolWorkspaceAccessMock.mockReset()
    getCaseMock.mockReset()
    transitionCaseStatusMock.mockReset()
    createAssessmentMock.mockReset()
    requireSchoolWorkspaceAccessMock.mockResolvedValue(FAKE_ACCESS)
    getCaseMock.mockResolvedValue({ caseId: 'CASE-1', studentUuid: 'STU-AAAA-BBBB-CCCC', driveFolderUrl: '' })
    transitionCaseStatusMock.mockResolvedValue({ ok: true, transitioned: true })
    createAssessmentMock.mockResolvedValue({ assessmentId: 'ASSESS-1' })
  })

  it('rejects a raw PDF (multipart) upload without creating a record', async () => {
    const { onRequestPost } = await import('../functions/api/cases/[caseId]/assessments/index')
    const formData = new FormData()
    formData.append('file', new File([new Uint8Array([1, 2, 3])], 'result.pdf', { type: 'application/pdf' }))
    formData.append('round', '1차')
    formData.append('timepoint', '사전')
    const request = new Request('https://example.com/api/cases/CASE-1/assessments', {
      method: 'POST',
      body: formData,
    })

    const response = await onRequestPost({
      request,
      env: {} as never,
      params: { caseId: 'CASE-1' },
    } as never)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('raw_pdf_upload_not_supported')
    expect(createAssessmentMock).not.toHaveBeenCalled()
  })

  it('rejects a request whose content-type is application/pdf directly', async () => {
    const { onRequestPost } = await import('../functions/api/cases/[caseId]/assessments/index')
    const request = new Request('https://example.com/api/cases/CASE-1/assessments', {
      method: 'POST',
      headers: { 'content-type': 'application/pdf' },
      body: new Uint8Array([1, 2, 3]),
    })

    const response = await onRequestPost({
      request,
      env: {} as never,
      params: { caseId: 'CASE-1' },
    } as never)

    expect(response.status).toBe(400)
    expect(createAssessmentMock).not.toHaveBeenCalled()
  })

  it('creates a bare assessment record from JSON round/timepoint with no file fields sent to Drive', async () => {
    const { onRequestPost } = await import('../functions/api/cases/[caseId]/assessments/index')
    const request = new Request('https://example.com/api/cases/CASE-1/assessments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ round: '1차', timepoint: '사전' }),
    })

    const response = await onRequestPost({
      request,
      env: {} as never,
      params: { caseId: 'CASE-1' },
    } as never)

    expect(response.status).toBe(200)
    expect(createAssessmentMock).toHaveBeenCalledTimes(1)
    const input = createAssessmentMock.mock.calls[0][2]
    expect(input.fileUrl).toBeUndefined()
    expect(input.fileId).toBeUndefined()
    expect(input.round).toBe('1차')
  })

  it('rejects non-SCHOOL_WORKSPACE accounts (blocked personal / unconfirmed workspace / guest) before touching any assessment data', async () => {
    requireSchoolWorkspaceAccessMock.mockResolvedValue({ error: 'school_workspace_required', status: 403 })
    const { onRequestPost } = await import('../functions/api/cases/[caseId]/assessments/index')
    const request = new Request('https://example.com/api/cases/CASE-1/assessments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ round: '1차', timepoint: '사전' }),
    })

    const response = await onRequestPost({
      request,
      env: {} as never,
      params: { caseId: 'CASE-1' },
    } as never)

    expect(response.status).toBe(403)
    expect(createAssessmentMock).not.toHaveBeenCalled()
  })
})
