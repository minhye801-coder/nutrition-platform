import { describe, expect, it } from 'vitest'
import { safeErrorMessage, sanitizeLogContext } from '../functions/_lib/logSafety'

describe('sanitizeLogContext', () => {
  it('drops known-sensitive keys entirely', () => {
    const result = sanitizeLogContext({
      studentName: '김민수',
      guardianName: '김보호',
      phoneNumber: '010-1234-5678',
      rawText: '민감한 PDF 추출 텍스트',
      deidentifiedText: '비식별 텍스트',
      caseId: 'CASE-1',
    })
    expect(result).not.toHaveProperty('studentName')
    expect(result).not.toHaveProperty('guardianName')
    expect(result).not.toHaveProperty('phoneNumber')
    expect(result).not.toHaveProperty('rawText')
    expect(result).not.toHaveProperty('deidentifiedText')
    expect(result.caseId).toBe('CASE-1')
  })

  it('masks any key that looks like a StudentID instead of dropping it', () => {
    const result = sanitizeLogContext({ studentUuid: 'STU-K7P4-Q9XM-2R8D' })
    expect(result.studentUuid).toBe('STU-K7P4-****-****')
  })

  it('leaves ordinary non-sensitive keys untouched', () => {
    const result = sanitizeLogContext({ userId: 'abc123', spreadsheetId: 'sheet-1', count: 3 })
    expect(result).toEqual({ userId: 'abc123', spreadsheetId: 'sheet-1', count: 3 })
  })
})

describe('safeErrorMessage', () => {
  it('extracts only the message from Error instances', () => {
    expect(safeErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('passes through plain strings', () => {
    expect(safeErrorMessage('already a string')).toBe('already a string')
  })

  it('falls back to a generic label for anything else', () => {
    expect(safeErrorMessage({ some: 'object' })).toBe('unknown_error')
    expect(safeErrorMessage(undefined)).toBe('unknown_error')
  })
})
