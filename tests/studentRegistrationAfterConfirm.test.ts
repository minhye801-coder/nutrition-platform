import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireSchoolWorkspaceAccessMock = vi.fn()
const findPotentialDuplicateMock = vi.fn()
const createStudentMock = vi.fn()

vi.mock('../functions/_lib/requireInstalledAccess', () => ({
  requireSchoolWorkspaceAccess: (...args: unknown[]) => requireSchoolWorkspaceAccessMock(...args),
  isAccessError: (result: unknown) => !!result && typeof result === 'object' && 'error' in (result as object),
}))

vi.mock('../functions/_lib/studentSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/studentSheet')>('../functions/_lib/studentSheet')
  return {
    ...actual,
    findPotentialDuplicate: (...args: unknown[]) => findPotentialDuplicateMock(...args),
    createStudent: (...args: unknown[]) => createStudentMock(...args),
  }
})

describe('POST /api/students — after workspace confirmation', () => {
  beforeEach(() => {
    requireSchoolWorkspaceAccessMock.mockReset()
    findPotentialDuplicateMock.mockReset().mockResolvedValue(null)
    createStudentMock.mockReset().mockResolvedValue({ studentUuid: 'STU-AAAA-AAAA-AAAA' })
  })

  it('allows student registration once the account is SCHOOL_WORKSPACE (confirmed)', async () => {
    // 요구사항 9절 테스트 12: Workspace 확인 이후 학생 등록 가능.
    requireSchoolWorkspaceAccessMock.mockResolvedValue({
      session: { accountMode: 'SCHOOL_WORKSPACE', hostedDomain: 'school.go.kr', schoolUseConfirmed: true },
      installation: {},
      accessToken: 'token',
      spreadsheetId: 'sheet-1',
      identitySpreadsheetId: 'identity-1',
    })
    const { onRequestPost } = await import('../functions/api/students/index')
    const request = new Request('https://example.com/api/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '김민수', schoolYear: '2026', grade: '5', class: '2', studentNumber: '15' }),
    })
    const response = await onRequestPost({ request, env: {} as never, params: {} } as never)
    expect(response.status).toBe(201)
    expect(createStudentMock).toHaveBeenCalledTimes(1)
  })

  it('blocks student registration before confirmation (WORKSPACE_CONFIRMATION_REQUIRED)', async () => {
    requireSchoolWorkspaceAccessMock.mockResolvedValue({ error: 'school_workspace_required', status: 403 })
    const { onRequestPost } = await import('../functions/api/students/index')
    const request = new Request('https://example.com/api/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '김민수', schoolYear: '2026', grade: '5', class: '2', studentNumber: '15' }),
    })
    const response = await onRequestPost({ request, env: {} as never, params: {} } as never)
    expect(response.status).toBe(403)
    expect(createStudentMock).not.toHaveBeenCalled()
  })
})
