import type { CreateStudentInput, Student, StudentListFilters, UpdateStudentInput } from '@/types/student'

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

export async function fetchStudents(filters: StudentListFilters = {}): Promise<Student[]> {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.grade) params.set('grade', filters.grade)
  if (filters.class) params.set('class', filters.class)
  if (filters.status) params.set('status', filters.status)
  const query = params.toString()

  const response = await fetch(`/api/students${query ? `?${query}` : ''}`, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('students_fetch_failed')
  }
  const data = (await response.json()) as { students?: Student[] }
  return data.students ?? []
}

export async function createStudent(input: CreateStudentInput): Promise<Student> {
  const response = await fetch('/api/students', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await parseJsonSafe(response)

  if (response.status === 409 && data?.error === 'duplicate_student') {
    throw new DuplicateStudentError(String(data.existingStudentUuid ?? ''))
  }
  if (!response.ok) {
    throw new Error('student_create_failed')
  }
  return (data as { student: Student }).student
}

export async function updateStudent(studentUuid: string, input: UpdateStudentInput): Promise<Student> {
  const response = await fetch(`/api/students/${encodeURIComponent(studentUuid)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error('student_update_failed')
  }
  const data = (await response.json()) as { student: Student }
  return data.student
}

export async function deactivateStudent(studentUuid: string): Promise<Student> {
  const response = await fetch(`/api/students/${encodeURIComponent(studentUuid)}/deactivate`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('student_deactivate_failed')
  }
  const data = (await response.json()) as { student: Student }
  return data.student
}

export async function restoreStudent(studentUuid: string): Promise<Student> {
  const response = await fetch(`/api/students/${encodeURIComponent(studentUuid)}/restore`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('student_restore_failed')
  }
  const data = (await response.json()) as { student: Student }
  return data.student
}
