import { describe, expect, it, vi, afterEach } from 'vitest'
import { extractFromDeidentifiedText } from '../functions/_lib/geminiClient'
import { ASSESSMENT_EXTRACTED_FIELDS } from '../functions/_lib/assessmentSheet'

describe('extractFromDeidentifiedText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends only the deidentified text to Gemini — no separate name/school fields', async () => {
    let capturedBody: Record<string, unknown> | null = null
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ warnings: [], responseHighlights: [] }) }] } }],
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const deidentifiedText = '키 165cm, 몸무게 55kg'
    await extractFromDeidentifiedText('fake-api-key', deidentifiedText)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = capturedBody as unknown as { contents: { parts: { text: string }[] }[]; generationConfig: unknown }

    // 요청 본문 최상위 키는 contents/generationConfig뿐이어야 한다 — studentName/schoolName
    // 같은 별도 필드가 존재하면 안 된다.
    expect(Object.keys(body).sort()).toEqual(['contents', 'generationConfig'])
    expect(JSON.stringify(body)).not.toContain('studentName')
    expect(JSON.stringify(body)).not.toContain('schoolName')

    // 프롬프트에 이어붙인 텍스트는 교사가 확인한 비식별화 텍스트 그대로여야 한다.
    expect(body.contents[0].parts[0].text.endsWith(deidentifiedText)).toBe(true)
  })

  it('never asks Gemini for the four re-identification-risk fields', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      const schemaProps = Object.keys(body.generationConfig.responseSchema.properties)
      expect(schemaProps).not.toContain('studentName')
      expect(schemaProps).not.toContain('schoolType')
      expect(schemaProps).not.toContain('age')
      expect(schemaProps).not.toContain('examDate')
      for (const field of ASSESSMENT_EXTRACTED_FIELDS) {
        expect(schemaProps).toContain(field)
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ warnings: [], responseHighlights: [] }) }] } }],
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    await extractFromDeidentifiedText('fake-api-key', 'sample text')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
