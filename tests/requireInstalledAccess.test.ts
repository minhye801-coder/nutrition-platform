import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireSessionMock = vi.fn()
const ensureDriveAccessTokenMock = vi.fn()
const getInstallationMock = vi.fn()

vi.mock('../functions/_lib/requireSession', () => ({
  requireSession: (...args: unknown[]) => requireSessionMock(...args),
}))

vi.mock('../functions/_lib/googleAccessToken', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/googleAccessToken')>(
    '../functions/_lib/googleAccessToken',
  )
  return { ...actual, ensureDriveAccessToken: (...args: unknown[]) => ensureDriveAccessTokenMock(...args) }
})

vi.mock('../functions/_lib/stores', () => ({
  getInstallationStore: () => ({ get: (...args: unknown[]) => getInstallationMock(...args) }),
}))

describe('requireSchoolWorkspaceAccess — account mode gating', () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    ensureDriveAccessTokenMock.mockReset().mockResolvedValue('access-token')
    getInstallationMock.mockReset().mockResolvedValue({ spreadsheetId: 'sheet-1', identitySpreadsheetId: 'identity-1' })
  })

  it('rejects a PERSONAL_ACCOUNT_BLOCKED session even if it somehow has a completed installation', async () => {
    requireSessionMock.mockResolvedValue({
      googleSub: 'sub-1',
      accountMode: 'PERSONAL_ACCOUNT_BLOCKED',
      hostedDomain: null,
      schoolUseConfirmed: false,
    })
    const { requireSchoolWorkspaceAccess, isAccessError } = await import(
      '../functions/_lib/requireInstalledAccess'
    )
    const result = await requireSchoolWorkspaceAccess(new Request('https://example.com/api/assessments'), {} as never)
    expect(isAccessError(result)).toBe(true)
    if (isAccessError(result)) {
      expect(result.error).toBe('school_workspace_required')
      expect(result.status).toBe(403)
    }
  })

  it('rejects a WORKSPACE_CONFIRMATION_REQUIRED session (hosted domain present but not yet confirmed)', async () => {
    requireSessionMock.mockResolvedValue({
      googleSub: 'sub-2',
      accountMode: 'WORKSPACE_CONFIRMATION_REQUIRED',
      hostedDomain: 'school.go.kr',
      schoolUseConfirmed: false,
    })
    const { requireSchoolWorkspaceAccess, isAccessError } = await import(
      '../functions/_lib/requireInstalledAccess'
    )
    const result = await requireSchoolWorkspaceAccess(new Request('https://example.com/api/assessments'), {} as never)
    expect(isAccessError(result)).toBe(true)
  })

  it('allows a confirmed SCHOOL_WORKSPACE session through', async () => {
    requireSessionMock.mockResolvedValue({
      googleSub: 'sub-3',
      accountMode: 'SCHOOL_WORKSPACE',
      hostedDomain: 'school.go.kr',
      schoolUseConfirmed: true,
    })
    const { requireSchoolWorkspaceAccess, isAccessError } = await import(
      '../functions/_lib/requireInstalledAccess'
    )
    const result = await requireSchoolWorkspaceAccess(new Request('https://example.com/api/assessments'), {} as never)
    expect(isAccessError(result)).toBe(false)
  })

  it('ignores a client-supplied accountMode override — only the server session value counts', async () => {
    // 클라이언트가 요청 헤더/바디에 accountMode=SCHOOL_WORKSPACE를 억지로 넣어도
    // requireSession이 돌려주는 세션(서버가 D1에서 읽은 진짜 값)만 신뢰해야 한다.
    requireSessionMock.mockResolvedValue({
      googleSub: 'sub-4',
      accountMode: 'PERSONAL_ACCOUNT_BLOCKED',
      hostedDomain: null,
      schoolUseConfirmed: false,
    })
    const { requireSchoolWorkspaceAccess, isAccessError } = await import(
      '../functions/_lib/requireInstalledAccess'
    )
    const request = new Request('https://example.com/api/assessments', {
      headers: { 'X-Account-Mode': 'SCHOOL_WORKSPACE' },
    })
    const result = await requireSchoolWorkspaceAccess(request, {} as never)
    expect(isAccessError(result)).toBe(true)
  })
})
