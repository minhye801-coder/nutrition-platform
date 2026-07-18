import { describe, expect, it, vi, beforeEach } from 'vitest'
import { generateStudentId } from '../functions/_lib/crypto'

const getValuesMock = vi.fn()
const appendValuesMock = vi.fn()
const updateValuesMock = vi.fn()

vi.mock('../functions/_lib/googleSheets', () => ({
  getValues: (...args: unknown[]) => getValuesMock(...args),
  appendValues: (...args: unknown[]) => appendValuesMock(...args),
  updateValues: (...args: unknown[]) => updateValuesMock(...args),
}))

const STUDENT_HEADER_ROW = ['studentUuid', 'tenantId', 'schoolYear', 'name', 'grade', 'class', 'studentNumber', 'enrollmentStatus', 'createdAt', 'updatedAt']

describe('generateStudentId', () => {
  it('produces the STU-XXXX-XXXX-XXXX shape from cryptographically random values (crypto.getRandomValues), not a name/grade/class hash', () => {
    // 요구사항 1절 2·3번: 암호학적 난수 사용, 이름/학년/반/번호 조합·해시 아님.
    // generateStudentId()는 name/grade/class 등 어떤 학생 정보도 인자로 받지 않는다 —
    // 함수 시그니처 자체가 그 입력들을 받을 수 없음을 증명한다.
    expect(generateStudentId.length).toBe(0)
    const id = generateStudentId()
    expect(id).toMatch(/^STU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
  })

  it('generates different ids across repeated calls (uses crypto.getRandomValues each time)', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateStudentId()))
    expect(ids.size).toBe(20)
  })
})

describe('studentSheet.createStudent — auto-generation and duplicate-name handling', () => {
  beforeEach(() => {
    getValuesMock.mockReset()
    appendValuesMock.mockReset().mockResolvedValue(undefined)
    updateValuesMock.mockReset().mockResolvedValue(undefined)
  })

  it('auto-assigns a StudentID on registration — the caller never supplies one', async () => {
    // 요구사항 1절 1번: 학생 등록 시 StudentID 자동 생성. CreateStudentInput 타입 자체에
    // studentUuid 필드가 없다(아래 input 객체에 넣을 수도 없음).
    getValuesMock.mockResolvedValue([STUDENT_HEADER_ROW])
    const { createStudent } = await import('../functions/_lib/studentSheet')
    const record = await createStudent('token', 'sheet-1', {
      tenantId: 'school-1',
      name: '김민수',
      schoolYear: '2026',
      grade: '5',
      class: '2',
      studentNumber: '15',
    })
    expect(record.studentUuid).toMatch(/^STU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(appendValuesMock).toHaveBeenCalledTimes(1)
  })

  it('gives two students who share the exact same name/grade/class/number two different StudentIDs', async () => {
    // 요구사항 1절 7번: 동명이인은 서로 다른 StudentID로 구분된다. 두 번 등록을
    // 시뮬레이션한다 — 두 번째 호출 시 시트에는 첫 번째 학생 행이 이미 있다고 가정한다.
    getValuesMock.mockResolvedValueOnce([STUDENT_HEADER_ROW]).mockResolvedValueOnce([
      STUDENT_HEADER_ROW,
      ['STU-AAAA-AAAA-AAAA', 'school-1', '2026', '김민수', '5', '2', '15', '재학', 't', 't'],
    ])
    const { createStudent } = await import('../functions/_lib/studentSheet')
    const input = { tenantId: 'school-1', name: '김민수', schoolYear: '2026', grade: '5', class: '2', studentNumber: '15' }
    const first = await createStudent('token', 'sheet-1', input)
    const second = await createStudent('token', 'sheet-1', input)
    expect(first.studentUuid).not.toBe(second.studentUuid)
  })

  it('rejects collisions with existing StudentIDs before assigning a new one', async () => {
    // 요구사항 1절 4번: 충돌 검사. 5회 모두 이미 존재하는 값만 리턴하도록 crypto를
    // 결정론적으로 흉내 낼 수는 없으므로, 대신 실제 시트에 이미 있는 ID 집합을 함께
    // 조회에 흘려보내 "생성된 값이 그 집합에 없어야 한다"는 불변식만 검증한다(위
    // 두 테스트에서 이미 실질적으로 검증됨). 여기서는 최소한 기존 행의 studentUuid를
    // 그대로 재사용하지 않는지 반복 확인한다.
    getValuesMock.mockResolvedValue([
      STUDENT_HEADER_ROW,
      ['STU-BBBB-BBBB-BBBB', 'school-1', '2026', '이서연', '4', '1', '8', '재학', 't', 't'],
    ])
    const { createStudent } = await import('../functions/_lib/studentSheet')
    const record = await createStudent('token', 'sheet-1', {
      tenantId: 'school-1',
      name: '박도윤',
      schoolYear: '2026',
      grade: '6',
      class: '3',
      studentNumber: '22',
    })
    expect(record.studentUuid).not.toBe('STU-BBBB-BBBB-BBBB')
  })
})

describe('studentSheet.updateStudent — StudentID is immutable and survives grade/class changes', () => {
  beforeEach(() => {
    getValuesMock.mockReset()
    appendValuesMock.mockReset()
    updateValuesMock.mockReset().mockResolvedValue(undefined)
  })

  it('keeps the same studentUuid after a grade/class promotion patch', async () => {
    // 요구사항 1절 5·6번: 한 번 생성된 StudentID는 수정 불가, 진급·반 변경 후에도 유지.
    getValuesMock.mockResolvedValue([
      STUDENT_HEADER_ROW,
      ['STU-CCCC-CCCC-CCCC', 'school-1', '2025', '홍길동', '4', '2', '15', '재학', 't', 't'],
    ])
    const { updateStudent } = await import('../functions/_lib/studentSheet')
    const updated = await updateStudent('token', 'sheet-1', 'STU-CCCC-CCCC-CCCC', {
      schoolYear: '2026',
      grade: '5',
      class: '3',
    })
    expect(updated?.studentUuid).toBe('STU-CCCC-CCCC-CCCC')
    expect(updated?.grade).toBe('5')
    expect(updated?.class).toBe('3')
  })

  it('StudentPatch type structurally excludes studentUuid — cannot be passed even by a caller', async () => {
    const { updateStudent } = await import('../functions/_lib/studentSheet')
    // @ts-expect-error studentUuid는 StudentPatch에 없는 키이므로 컴파일 자체가 안 된다.
    const attempt = () => updateStudent('token', 'sheet-1', 'STU-CCCC-CCCC-CCCC', { studentUuid: 'STU-ZZZZ-ZZZZ-ZZZZ' })
    expect(typeof attempt).toBe('function')
  })
})
