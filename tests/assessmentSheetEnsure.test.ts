import { describe, expect, it, vi, beforeEach } from 'vitest'

const getValuesMock = vi.fn()
const appendValuesMock = vi.fn()
const updateValuesMock = vi.fn()

vi.mock('../functions/_lib/googleSheets', () => ({
  getValues: (...args: unknown[]) => getValuesMock(...args),
  appendValues: (...args: unknown[]) => appendValuesMock(...args),
  updateValues: (...args: unknown[]) => updateValuesMock(...args),
}))

import {
  ASSESSMENT_HEADERS,
  ensureAssessment,
  findAssessmentByCaseAndTimepoint,
  getAssessment,
  type CreateAssessmentInput,
} from '../functions/_lib/assessmentSheet'

/**
 * legacy `ensureDiagnosisRecord_`(counseling-manager/code.gs.txt:3859-3885)와 동일한
 * caseId+timepoint 유일성 규칙을 이 저장소의 ensureAssessment가 그대로 지키는지 검증한다
 * (요구사항 3·8절, 회귀 테스트 4/5/15).
 */
describe('ensureAssessment — caseId+timepoint 유일성(중복 등록 방지)', () => {
  let rows: string[][]

  beforeEach(() => {
    rows = [[...ASSESSMENT_HEADERS]]
    getValuesMock.mockReset().mockImplementation(async () => rows)
    appendValuesMock.mockReset().mockImplementation(async (_token: string, _sheetId: string, _range: string, values: string[][]) => {
      rows.push(...values)
    })
    // 실제 Sheets API처럼 range의 행 번호(A{n}:...)를 파싱해 그 행을 실제로 덮어쓴다 —
    // collapseDuplicates가 남긴 mergedIntoAssessmentId 표시가 다음 조회에도 반영되려면
    // 이 스텁이 진짜 쓰기처럼 동작해야 한다(그냥 resolve만 하면 병합 표시가 사라진다).
    updateValuesMock.mockReset().mockImplementation(async (_token: string, _sheetId: string, range: string, values: string[][]) => {
      const match = range.match(/!A(\d+):/)
      if (!match) return
      const rowIndex = Number(match[1]) - 1 // 1-based sheet row -> 0-based rows[] index
      rows[rowIndex] = values[0]
    })
  })

  const baseInput: CreateAssessmentInput = {
    tenantId: 'SCHOOL-1',
    caseId: 'CASE-1',
    studentUuid: 'STU-AAAA-AAAA-AAAA',
    round: '1차',
    timepoint: '사전',
    uploadedBy: 'teacher@example.com',
  }

  it('creates exactly one row across repeated calls for the same caseId+timepoint (double click / page refresh / retry)', async () => {
    const first = await ensureAssessment('token', 'sheet-1', baseInput)
    const second = await ensureAssessment('token', 'sheet-1', baseInput)
    const third = await ensureAssessment('token', 'sheet-1', baseInput)

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(third.created).toBe(false)
    expect(second.assessment.assessmentId).toBe(first.assessment.assessmentId)
    expect(third.assessment.assessmentId).toBe(first.assessment.assessmentId)
    expect(appendValuesMock).toHaveBeenCalledTimes(1)
    // 헤더 행 + 데이터 행 1개만 존재해야 한다.
    expect(rows).toHaveLength(2)
  })

  it('keeps 사전 and 사후 as two separate records for the same case', async () => {
    const pre = await ensureAssessment('token', 'sheet-1', { ...baseInput, timepoint: '사전' })
    const post = await ensureAssessment('token', 'sheet-1', { ...baseInput, round: '2차', timepoint: '사후' })

    expect(pre.assessment.assessmentId).not.toBe(post.assessment.assessmentId)
    expect(appendValuesMock).toHaveBeenCalledTimes(2)
    expect(rows).toHaveLength(3) // 헤더 + 사전 1행 + 사후 1행

    // 사후를 다시 등록해도 새 행이 생기지 않는다.
    const postAgain = await ensureAssessment('token', 'sheet-1', { ...baseInput, round: '2차', timepoint: '사후' })
    expect(postAgain.assessment.assessmentId).toBe(post.assessment.assessmentId)
    expect(appendValuesMock).toHaveBeenCalledTimes(2)
  })

  it('keeps different cases fully independent even with the same timepoint', async () => {
    const caseA = await ensureAssessment('token', 'sheet-1', { ...baseInput, caseId: 'CASE-A' })
    const caseB = await ensureAssessment('token', 'sheet-1', { ...baseInput, caseId: 'CASE-B' })

    expect(caseA.assessment.assessmentId).not.toBe(caseB.assessment.assessmentId)
    expect(appendValuesMock).toHaveBeenCalledTimes(2)
  })

  /**
   * 요구사항 1절 "동일 요청을 동시에 2회 실행하는 통합 테스트" — 진짜 경합을 흉내낸다.
   * Promise.all로 두 ensureAssessment 호출을 동시에 시작하면, 둘 다 append 전에 같은
   * (비어 있는) 시트 상태를 읽을 수 있다(마이크로태스크 타이밍상). assessmentId가
   * caseId+timepoint로 결정적이므로 두 응답이 같은 ID로 수렴하거나, 설령 두 행이 모두
   * 생겼더라도 저장 직후 재조회(collapseDuplicates)가 하나만 남기고 숨긴다 — 최종적으로
   * 어느 쪽 응답을 손에 쥐고 있어도 항상 같은 canonical 기록을 가리켜야 한다.
   */
  it('two concurrent ensureAssessment calls for the same caseId+timepoint converge to exactly one visible record', async () => {
    const [a, b] = await Promise.all([
      ensureAssessment('token', 'sheet-1', baseInput),
      ensureAssessment('token', 'sheet-1', baseInput),
    ])

    const visible = await findAssessmentByCaseAndTimepoint('token', 'sheet-1', baseInput.caseId, baseInput.timepoint)
    expect(visible).not.toBeNull()

    // 어느 응답의 assessmentId로 다시 조회해도(패배한 쪽이라도) canonical 기록으로 귀결된다.
    const resolvedA = await getAssessment('token', 'sheet-1', a.assessment.assessmentId)
    const resolvedB = await getAssessment('token', 'sheet-1', b.assessment.assessmentId)
    expect(resolvedA?.assessmentId).toBe(visible!.assessmentId)
    expect(resolvedB?.assessmentId).toBe(visible!.assessmentId)

    // 시트에 물리적으로 몇 행이 생겼든(경합이 실제로 일어났다면 2행), 목록/조회에는
    // 정확히 하나만 노출돼야 한다 — 요구사항 "나머지는 사용자에게 노출하지 않기".
    const dataRowCount = rows.length - 1
    expect(dataRowCount).toBeGreaterThanOrEqual(1)
  })

  /**
   * 요구사항 1절 "저장 직전 동일 진단기록 재조회" + "중복이 발견되면 최신 정상 기록
   * 하나만 유지" — 이미(예: 과거 버그나 수동 편집으로) 중복 행이 들어있는 시트를
   * ensureAssessment가 열었을 때 스스로 정리하는지 확인한다.
   */
  it('self-heals a pre-existing duplicate by keeping only the most recently updated row and hiding the rest', async () => {
    await ensureAssessment('token', 'sheet-1', baseInput)

    const headerRow = rows[0]
    const assessmentIdCol = headerRow.indexOf('assessmentId')
    const updatedAtCol = headerRow.indexOf('updatedAt')
    const caseCol = headerRow.indexOf('caseId')
    const timepointCol = headerRow.indexOf('timepoint')
    const dupRow = [...rows[1]]
    dupRow[assessmentIdCol] = 'ASSESS-LEGACY-DUP'
    dupRow[updatedAtCol] = new Date(Date.now() + 60_000).toISOString() // 기존 행보다 더 최신
    expect(dupRow[caseCol]).toBe(baseInput.caseId)
    expect(dupRow[timepointCol]).toBe(baseInput.timepoint)
    rows.push(dupRow)

    const result = await ensureAssessment('token', 'sheet-1', baseInput)
    expect(result.created).toBe(false)
    expect(result.assessment.assessmentId).toBe('ASSESS-LEGACY-DUP') // 더 최신 쪽이 canonical

    const visible = await findAssessmentByCaseAndTimepoint('token', 'sheet-1', baseInput.caseId, baseInput.timepoint)
    expect(visible?.assessmentId).toBe('ASSESS-LEGACY-DUP')
  })
})
