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

  it('has no parameter for a File/Blob/filename/caseId/studentUuid — only apiKey and text', () => {
    // 요구사항 9절 테스트 11: Gemini 요청에 원본 PDF·파일명이 없음. 함수 시그니처
    // 자체가 2개 문자열 인자(apiKey, deidentifiedText)만 받으므로 파일을 실어 보낼 수 없다.
    expect(extractFromDeidentifiedText.length).toBe(2)
  })

  it('never includes a STU-xxxx-xxxx-xxxx StudentID pattern in the outgoing request', async () => {
    // 요구사항 9절 테스트 10: Gemini 요청에 StudentID 없음.
    let capturedBody = ''
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ warnings: [], responseHighlights: [] }) }] } }],
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    // 비식별 텍스트 안에 우연히도 StudentID처럼 생긴 문자열이 없는 정상적인 입력을 보낸다.
    await extractFromDeidentifiedText('fake-api-key', '학년군: 초등 고학년, 식사빈도: 3회')
    expect(capturedBody).not.toMatch(/STU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/)
  })
})
