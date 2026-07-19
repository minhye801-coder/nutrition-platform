import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireSchoolWorkspaceAccessMock = vi.fn()
const getCaseMock = vi.fn()
const transitionCaseStatusMock = vi.fn()
const ensureAssessmentMock = vi.fn()
const uploadFileMock = vi.fn()
const ensureAssessmentFolderMock = vi.fn()

vi.mock('../functions/_lib/requireInstalledAccess', () => ({
  requireSchoolWorkspaceAccess: (...args: unknown[]) => requireSchoolWorkspaceAccessMock(...args),
  isAccessError: (result: unknown) => !!result && typeof result === 'object' && 'error' in (result as object),
}))

vi.mock('../functions/_lib/caseSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/caseSheet')>('../functions/_lib/caseSheet')
  return { ...actual, getCase: (...args: unknown[]) => getCaseMock(...args), transitionCaseStatus: (...args: unknown[]) => transitionCaseStatusMock(...args) }
})

vi.mock('../functions/_lib/assessmentSheet', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/assessmentSheet')>('../functions/_lib/assessmentSheet')
  return { ...actual, ensureAssessment: (...args: unknown[]) => ensureAssessmentMock(...args), listAssessmentsByCase: vi.fn() }
})

vi.mock('../functions/_lib/googleDrive', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/googleDrive')>('../functions/_lib/googleDrive')
  return { ...actual, uploadFile: (...args: unknown[]) => uploadFileMock(...args) }
})

vi.mock('../functions/_lib/caseFolder', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/caseFolder')>('../functions/_lib/caseFolder')
  return { ...actual, ensureAssessmentFolder: (...args: unknown[]) => ensureAssessmentFolderMock(...args) }
})

const FAKE_ACCESS = {
  session: { email: 'teacher@example.com', googleSub: 'sub-1', accountMode: 'SCHOOL_WORKSPACE', schoolUseConfirmed: true },
  installation: { schoolPublicId: 'SCHOOL-1', rootFolderId: 'root-folder' },
  accessToken: 'token',
  spreadsheetId: 'sheet-1',
  identitySpreadsheetId: 'identity-sheet-1',
}

describe('진단검사 원본 PDF — Drive 업로드 함수가 호출되지 않는다', () => {
  beforeEach(() => {
    requireSchoolWorkspaceAccessMock.mockReset().mockResolvedValue(FAKE_ACCESS)
    getCaseMock.mockReset().mockResolvedValue({ caseId: 'CASE-1', studentUuid: 'STU-AAAA-BBBB-CCCC', driveFolderUrl: 'https://drive.google.com/drive/folders/root-folder' })
    transitionCaseStatusMock.mockReset().mockResolvedValue({ ok: true, transitioned: true })
    ensureAssessmentMock.mockReset().mockResolvedValue({ assessment: { assessmentId: 'ASSESS-1' }, created: true })
    uploadFileMock.mockReset()
    ensureAssessmentFolderMock.mockReset()
  })

  it('creating an assessment record never calls Drive uploadFile or the 03_공식진단 folder helper', async () => {
    // 요구사항 9절 테스트 7: 진단검사 원본 PDF Drive 업로드 함수 미호출.
    const { onRequestPost } = await import('../functions/api/cases/[caseId]/assessments/index')
    const request = new Request('https://example.com/api/cases/CASE-1/assessments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ round: '1차', timepoint: '사전' }),
    })
    const response = await onRequestPost({ request, env: {} as never, params: { caseId: 'CASE-1' } } as never)
    expect(response.status).toBe(200)
    expect(uploadFileMock).not.toHaveBeenCalled()
    expect(ensureAssessmentFolderMock).not.toHaveBeenCalled()
  })
})

describe('보호자동의서 PDF — 지정된 Drive 폴더에만 저장된다', () => {
  it('googleDocs.createTextPdf is the only place uploadFile is called for PDFs, and it targets the folder passed to it', async () => {
    // 요구사항 4절 A/9절 테스트 8: 보호자동의서 PDF만 지정 폴더(ensureConsentPdfFolder가
    // 만든 폴더)에 저장된다 — createTextPdf(accessToken, targetFolderId, title, body)의
    // targetFolderId 인자가 그대로 uploadFile의 parentId로 전달되는지 확인한다.
    vi.resetModules()
    const uploadFileSpy = vi.fn().mockResolvedValue({ id: 'file-1', webViewLink: 'https://drive.google.com/file/d/file-1/view' })
    const moveFileToRootFolderSpy = vi.fn().mockResolvedValue(undefined)
    const trashFileSpy = vi.fn().mockResolvedValue(undefined)

    vi.doMock('../functions/_lib/googleDrive', () => ({
      uploadFile: uploadFileSpy,
      moveFileToRootFolder: moveFileToRootFolderSpy,
      trashFile: trashFileSpy,
    }))

    const originalFetch = global.fetch
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes('docs.googleapis.com') && !url.includes('batchUpdate')) {
        return { ok: true, json: async () => ({ documentId: 'doc-1' }) } as Response
      }
      if (url.includes('batchUpdate')) {
        return { ok: true, json: async () => ({}) } as Response
      }
      if (url.includes('/export')) {
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as typeof fetch

    try {
      const { createTextPdf } = await import('../functions/_lib/googleDocs')
      const result = await createTextPdf('token', 'consent-folder-id', 'STU-AAAA-BBBB-CCCC_보호자동의서_20260718', ['본문'])
      expect(uploadFileSpy).toHaveBeenCalledTimes(1)
      const [, , parentId, mimeType] = uploadFileSpy.mock.calls[0]
      expect(parentId).toBe('consent-folder-id')
      expect(mimeType).toBe('application/pdf')
      expect(result.fileId).toBe('file-1')
    } finally {
      global.fetch = originalFetch
      vi.doUnmock('../functions/_lib/googleDrive')
    }
  })
})
