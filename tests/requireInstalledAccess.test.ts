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

describe('requireSchoolWorkspaceAccess — PERSONAL_DEMO gating', () => {
  beforeEach(() => {
    requireSessionMock.mockReset()
    ensureDriveAccessTokenMock.mockReset().mockResolvedValue('access-token')
    getInstallationMock.mockReset().mockResolvedValue({ spreadsheetId: 'sheet-1', identitySpreadsheetId: 'identity-1' })
  })

  it('rejects a PERSONAL_DEMO session even if it somehow has a completed installation', async () => {
    requireSessionMock.mockResolvedValue({
      googleSub: 'sub-1',
      accountMode: 'PERSONAL_DEMO',
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

  it('rejects a SCHOOL_WORKSPACE session that has not confirmed school use yet', async () => {
    requireSessionMock.mockResolvedValue({
      googleSub: 'sub-2',
      accountMode: 'SCHOOL_WORKSPACE',
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
      schoolUseConfirmed: true,
    })
    const { requireSchoolWorkspaceAccess, isAccessError } = await import(
      '../functions/_lib/requireInstalledAccess'
    )
    const result = await requireSchoolWorkspaceAccess(new Request('https://example.com/api/assessments'), {} as never)
    expect(isAccessError(result)).toBe(false)
  })
})
