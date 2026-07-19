import { describe, expect, it } from 'vitest'
import { detectGradeMismatch, detectPiiCandidates, hasNameMismatch } from '../src/lib/pdfDeidentify'

/** 요구사항 6절 D "학생 이름 불일치·학년 불일치" 경고, 회귀 테스트 9. */
describe('hasNameMismatch', () => {
  it('flags a mismatch when the PDF has a differently-named "이름:" label than the registered student', () => {
    const text = '이름: 박서준\n학년: 5학년'
    const candidates = detectPiiCandidates(text, '김민수')
    expect(hasNameMismatch(candidates)).toBe(true)
  })

  it('does not flag a mismatch when the PDF name matches the registered student', () => {
    const text = '이름: 김민수\n학년: 5학년'
    const candidates = detectPiiCandidates(text, '김민수')
    expect(hasNameMismatch(candidates)).toBe(false)
  })

  it('does not flag a mismatch when there is no known student name to compare against', () => {
    const text = '이름: 박서준'
    const candidates = detectPiiCandidates(text, undefined)
    expect(hasNameMismatch(candidates)).toBe(false)
  })
})

describe('detectGradeMismatch', () => {
  it('flags a mismatch when the PDF states a different grade than the registered student', () => {
    const result = detectGradeMismatch('본 검사는 3학년 학생을 대상으로 합니다.', '5')
    expect(result.mismatch).toBe(true)
    expect(result.foundGrades).toEqual(['3'])
  })

  it('does not flag a mismatch when the PDF grade matches', () => {
    const result = detectGradeMismatch('본 검사는 5학년 학생을 대상으로 합니다.', '5')
    expect(result.mismatch).toBe(false)
  })

  it('does not flag a mismatch when the PDF has no grade mention at all', () => {
    const result = detectGradeMismatch('식생활 진단 결과입니다.', '5')
    expect(result.mismatch).toBe(false)
    expect(result.foundGrades).toEqual([])
  })
})
