import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CASE_HEADERS } from '../functions/_lib/caseSheet'
import { ASSESSMENT_HEADERS } from '../functions/_lib/assessmentSheet'
import { CONSENT_HEADERS } from '../functions/_lib/consentSheet'

describe('상담데이터 Spreadsheet row shape — no student name column', () => {
  // 요구사항 1절 10번 / 9절 테스트 4: 상담데이터 row에 이름이 없음.
  it('상담케이스(cases) headers contain studentUuid but never a name field', () => {
    expect(CASE_HEADERS).toContain('studentUuid')
    expect(CASE_HEADERS).not.toContain('name')
    expect(CASE_HEADERS).not.toContain('studentName')
  })

  it('진단결과(assessments) headers contain studentUuid but never a name field', () => {
    expect(ASSESSMENT_HEADERS).toContain('studentUuid')
    expect(ASSESSMENT_HEADERS).not.toContain('name')
    expect(ASSESSMENT_HEADERS).not.toContain('studentName')
  })

  it('보호자동의(consents) headers contain studentUuid but never guardian identity fields', () => {
    expect(CONSENT_HEADERS).toContain('studentUuid')
    expect(CONSENT_HEADERS).not.toContain('name')
    expect(CONSENT_HEADERS).not.toContain('guardianName')
    expect(CONSENT_HEADERS).not.toContain('guardianContact')
  })

  it('example row: 상담데이터 record has studentId but no student name', () => {
    const counselingRow = {
      studentId: 'STU-K7P4-Q9XM-2R8D',
      caseId: 'CASE-20260718-0001',
      status: '상담 예정',
      counselingRecord: '',
    }
    expect(counselingRow).not.toHaveProperty('name')
    expect(counselingRow).not.toHaveProperty('studentName')
    expect(JSON.stringify(counselingRow)).not.toContain('홍길동')
  })
})

describe('Cloudflare D1 schema — never declares a student-data column (regression guard)', () => {
  // 요구사항 2절 6·7번 / 9절 테스트 5: D1에는 사용자/세션/설치/확인 기록 메타데이터만 저장된다.
  const FORBIDDEN_COLUMN_PATTERNS = [
    /student_name/i,
    /guardian_name/i,
    /guardian_contact/i,
    /counseling_record/i,
    /assessment_result/i,
    /pdf_text/i,
    /raw_text/i,
    /diagnosis_text/i,
  ]

  const migrationsDir = join(__dirname, '..', 'migrations')
  const sqlFiles = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'))

  it('at least the known migration files are present (sanity check on the scan itself)', () => {
    expect(sqlFiles.length).toBeGreaterThanOrEqual(9)
  })

  it.each(sqlFiles)('%s never declares a forbidden student-data column', (fileName) => {
    const sql = readFileSync(join(migrationsDir, fileName), 'utf-8')
    for (const pattern of FORBIDDEN_COLUMN_PATTERNS) {
      expect(sql).not.toMatch(pattern)
    }
  })
})
