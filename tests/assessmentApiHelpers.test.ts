import { describe, expect, it } from 'vitest'
import { isRawFileUploadRequest } from '../functions/_lib/assessmentApiHelpers'

describe('isRawFileUploadRequest', () => {
  it('rejects multipart/form-data (raw PDF file upload) requests', () => {
    const request = new Request('https://example.com/api/cases/CASE-1/assessments', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=----abc' },
    })
    expect(isRawFileUploadRequest(request)).toBe(true)
  })

  it('rejects application/pdf requests', () => {
    const request = new Request('https://example.com/api/cases/CASE-1/assessments', {
      method: 'POST',
      headers: { 'content-type': 'application/pdf' },
    })
    expect(isRawFileUploadRequest(request)).toBe(true)
  })

  it('accepts application/json requests', () => {
    const request = new Request('https://example.com/api/cases/CASE-1/assessments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ round: '1차', timepoint: '사전' }),
    })
    expect(isRawFileUploadRequest(request)).toBe(false)
  })
})
