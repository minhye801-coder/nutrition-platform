import { describe, expect, it } from 'vitest'
import { isValidStudentIdFormat, maskNamePartial, maskStudentId } from '../functions/_lib/maskId'

describe('maskStudentId', () => {
  it('keeps only the first group of a well-formed StudentID', () => {
    expect(maskStudentId('STU-K7P4-Q9XM-2R8D')).toBe('STU-K7P4-****-****')
  })

  it('returns empty string for empty input', () => {
    expect(maskStudentId('')).toBe('')
  })

  it('masks unknown-format ids by keeping only a short prefix', () => {
    expect(maskStudentId('legacy-uuid-1234567890')).toBe('legacy-u****')
    expect(maskStudentId('short')).toBe('****')
  })

  it('never includes the full original value for a valid id', () => {
    const original = 'STU-AB12-CD34-EF56'
    const masked = maskStudentId(original)
    expect(masked).not.toBe(original)
    expect(masked).toContain('****')
  })
})

describe('isValidStudentIdFormat', () => {
  it('accepts the STU-XXXX-XXXX-XXXX shape', () => {
    expect(isValidStudentIdFormat('STU-K7P4-Q9XM-2R8D')).toBe(true)
  })

  it('rejects empty, malformed, or legacy values', () => {
    expect(isValidStudentIdFormat('')).toBe(false)
    expect(isValidStudentIdFormat('STU-1234')).toBe(false)
    expect(isValidStudentIdFormat('not-a-student-id')).toBe(false)
  })
})

describe('maskNamePartial', () => {
  it('keeps only the first character', () => {
    expect(maskNamePartial('김민수')).toBe('김**')
  })

  it('masks single-character names entirely', () => {
    expect(maskNamePartial('김')).toBe('*')
  })

  it('returns empty string for empty input', () => {
    expect(maskNamePartial('')).toBe('')
  })
})
