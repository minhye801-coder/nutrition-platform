import type { CreateStudentInput, Student, StudentListFilters, UpdateStudentInput } from '@/types/student'
import { isDemoMode } from '@/lib/accountModeCache'
import { demoStudentStore } from '@/data/demoStore'

/**
 * 서버가 내려준 오류 코드(`error` 필드)를 그대로 담아 던진다. 화면이 "실패했습니다"
 * 한 문장으로 뭉개지 않고 원인별로 다른 안내를 보여줄 수 있게 하기 위함이다 —
 * Google 원본 응답/토큰/Spreadsheet ID 등 민감한 값은 서버가 애초에 이 필드에
 * 담아 보내지 않는다(functions/_lib/studentApiHelpers.ts 참고).
 */
export class StudentApiError extends Error {
  code: string
  status: number
  constructor(code: string, status: number) {
    super(code)
    this.code = code
    this.status = status
  }
}

/** POST /api/students가 409로 응답할 때만 던진다 — 등록을 막지 않고 사용자 확인을 거치게 한다. */
export class DuplicateStudentError extends Error {
  existingStudentUuid: string
  constructor(existingStudentUuid: string) {
    super('duplicate_student')
    this.existingStudentUuid = existingStudentUuid
  }
}

async function parseJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function throwStudentApiError(response: Response): Promise<never> {
  const data = await parseJsonSafe(response)
  const code = typeof data?.error === 'string' ? data.error : 'unknown_error'
  throw new StudentApiError(code, response.status)
}

/**
 * PERSONAL_DEMO/WORKSPACE_PENDING 계정은 실제 /api/students를 절대 호출하지 않는다 —
 * 서버도 이 계정 모드를 거부하지만(functions/_lib/requireInstalledAccess.ts의
 * requireSchoolWorkspaceAccess), 애초에 요청 자체를 보내지 않아 실 Sheets 호출이
 * 전혀 발생하지 않게 한다(요구사항 3·8절). 아래 모든 함수가 동일한 원칙을 따른다.
 */
export async function fetchStudents(filters: StudentListFilters = {}): Promise<Student[]> {
  if (isDemoMode()) return demoStudentStore.list(filters)

  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.schoolYear) params.set('schoolYear', filters.schoolYear)
  if (filters.grade) params.set('grade', filters.grade)
  if (filters.class) params.set('class', filters.class)
  if (filters.status) params.set('status', filters.status)
  const query = params.toString()

  const response = await fetch(`/api/students${query ? `?${query}` : ''}`, { credentials: 'include' })
  if (!response.ok) {
    return throwStudentApiError(response)
  }
  const data = (await response.json()) as { students?: Student[] }
  return data.students ?? []
}

export async function createStudent(input: CreateStudentInput): Promise<Student> {
  if (isDemoMode()) return demoStudentStore.create(input)

  const response = await fetch('/api/students', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.status === 409) {
    const data = await parseJsonSafe(response)
    if (data?.error === 'duplicate_student') {
      throw new DuplicateStudentError(String(data.existingStudentUuid ?? ''))
    }
  }
  if (!response.ok) {
    return throwStudentApiError(response)
  }
  const data = (await response.json()) as { student: Student }
  return data.student
}

export async function updateStudent(studentUuid: string, input: UpdateStudentInput): Promise<Student> {
  if (isDemoMode()) return demoStudentStore.update(studentUuid, input)

  const response = await fetch(`/api/students/${encodeURIComponent(studentUuid)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    return throwStudentApiError(response)
  }
  const data = (await response.json()) as { student: Student }
  return data.student
}

export async function deactivateStudent(studentUuid: string): Promise<Student> {
  if (isDemoMode()) return demoStudentStore.setEnrollmentStatus(studentUuid, '비활성')

  const response = await fetch(`/api/students/${encodeURIComponent(studentUuid)}/deactivate`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    return throwStudentApiError(response)
  }
  const data = (await response.json()) as { student: Student }
  return data.student
}

export async function restoreStudent(studentUuid: string): Promise<Student> {
  if (isDemoMode()) return demoStudentStore.setEnrollmentStatus(studentUuid, '재학')

  const response = await fetch(`/api/students/${encodeURIComponent(studentUuid)}/restore`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    return throwStudentApiError(response)
  }
  const data = (await response.json()) as { student: Student }
  return data.student
}
