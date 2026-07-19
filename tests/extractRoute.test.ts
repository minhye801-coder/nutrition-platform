import { describe, expect, it, vi, beforeEach } from 'vitest'

const requireSchoolWorkspaceAccessMock = vi.fn()
const getAssessmentMock = vi.fn()
const applyExtractionMock = vi.fn()
const getGeminiApiKeyMock = vi.fn()
const decryptTokenMock = vi.fn()
const extractFromDeidentifiedTextMock = vi.fn()

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
    applyExtraction: (...args: unknown[]) => applyExtractionMock(...args),
  }
})

vi.mock('../functions/_lib/stores', () => ({
  getInstallationStore: () => ({ getGeminiApiKey: (...args: unknown[]) => getGeminiApiKeyMock(...args) }),
}))

vi.mock('../functions/_lib/tokenCipher', () => ({
  decryptToken: (...args: unknown[]) => decryptTokenMock(...args),
}))

vi.mock('../functions/_lib/geminiClient', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/geminiClient')>(
    '../functions/_lib/geminiClient',
  )
  return {
    ...actual,
    extractFromDeidentifiedText: (...args: unknown[]) => extractFromDeidentifiedTextMock(...args),
  }
})

const FAKE_ACCESS = {
  session: { email: 'teacher@example.com', googleSub: 'sub-1' },
  installation: {},
  accessToken: 'token',
  spreadsheetId: 'sheet-1',
  identitySpreadsheetId: 'identity-sheet-1',
}

describe('POST /api/assessments/:assessmentId/extract', () => {
  beforeEach(() => {
    requireSchoolWorkspaceAccessMock.mockReset().mockResolvedValue(FAKE_ACCESS)
    getAssessmentMock.mockReset().mockResolvedValue({ assessmentId: 'ASSESS-1' })
    getGeminiApiKeyMock.mockReset().mockResolvedValue('encrypted-key')
    decryptTokenMock.mockReset().mockResolvedValue('plain-key')
    extractFromDeidentifiedTextMock.mockReset().mockResolvedValue({
      extracted: {},
      warnings: [],
      responseHighlights: [],
      rawJson: '{}',
    })
    applyExtractionMock.mockReset().mockResolvedValue({ ok: true, assessment: { assessmentId: 'ASSESS-1' } })
  })

  it('rejects a request with no diagnosisText', async () => {
    const { onRequestPost } = await import('../functions/api/assessments/[assessmentId]/extract')
    const request = new Request('https://example.com/api/assessments/ASSESS-1/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseRequestId: 'CASE-20260718-AB12' }),
    })
    const response = await onRequestPost({ request, env: {} as never, params: { assessmentId: 'ASSESS-1' } } as never)
    expect(response.status).toBe(400)
    expect(extractFromDeidentifiedTextMock).not.toHaveBeenCalled()
  })

  it('rejects a request with a malformed caseRequestId', async () => {
    const { onRequestPost } = await import('../functions/api/assessments/[assessmentId]/extract')
    const request = new Request('https://example.com/api/assessments/ASSESS-1/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ diagnosisText: '키 165cm, 몸무게 55kg', caseRequestId: 'not-valid' }),
    })
    const response = await onRequestPost({ request, env: {} as never, params: { assessmentId: 'ASSESS-1' } } as never)
    expect(response.status).toBe(400)
    expect(extractFromDeidentifiedTextMock).not.toHaveBeenCalled()
  })

  it('processes a valid diagnosisText-only payload and forwards only that text to Gemini', async () => {
    const { onRequestPost } = await import('../functions/api/assessments/[assessmentId]/extract')
    const diagnosisText = '키 165cm, 몸무게 55kg, 아침 결식 잦음'
    const request = new Request('https://example.com/api/assessments/ASSESS-1/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ diagnosisText, caseRequestId: 'CASE-20260718-AB12' }),
    })
    const response = await onRequestPost({ request, env: {} as never, params: { assessmentId: 'ASSESS-1' } } as never)
    expect(response.status).toBe(200)
    // 요구사항 9절 테스트 12: caseRequestId는 서버 저장(applyExtraction)에만 쓰이고
    // Gemini 호출에는 절대 전달되지 않는다 — 정확히 (apiKey, diagnosisText, undefined)로만 호출됐는지 확인한다.
    expect(extractFromDeidentifiedTextMock).toHaveBeenCalledWith('plain-key', diagnosisText, undefined)
  })

  it('processes a valid diagnosisText+responseText payload and forwards both to Gemini', async () => {
    const { onRequestPost } = await import('../functions/api/assessments/[assessmentId]/extract')
    const diagnosisText = '키 165cm, 몸무게 55kg'
    const responseText = '아침 결식이 잦다는 응답'
    const request = new Request('https://example.com/api/assessments/ASSESS-1/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ diagnosisText, responseText, caseRequestId: 'CASE-20260718-AB12' }),
    })
    const response = await onRequestPost({ request, env: {} as never, params: { assessmentId: 'ASSESS-1' } } as never)
    expect(response.status).toBe(200)
    expect(extractFromDeidentifiedTextMock).toHaveBeenCalledWith('plain-key', diagnosisText, responseText)

    // 요구사항 3·6절 테스트 6: 진단결과와 응답내역이 하나의 diagnosisId(assessmentId)로만
    // 저장된다 — 별도 레코드가 아니라 같은 assessmentId에 대한 applyExtraction 호출 1회.
    expect(applyExtractionMock).toHaveBeenCalledTimes(1)
    expect(applyExtractionMock.mock.calls[0][2]).toBe('ASSESS-1')
  })
})
