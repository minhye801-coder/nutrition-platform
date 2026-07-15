export interface Student {
  studentUuid: string
  tenantId: string
  schoolYear: string
  name: string
  grade: string
  class: string
  studentNumber: string
  enrollmentStatus: string
  createdAt: string
  updatedAt: string
}

export interface StudentListFilters {
  q?: string
  schoolYear?: string
  grade?: string
  class?: string
  /** 생략/'active' = 재학생만(기본), 'all' = 전체, 그 외 = enrollmentStatus 정확히 일치(예: '비활성'). */
  status?: string
}

export interface CreateStudentInput {
  name: string
  schoolYear: string
  grade: string
  class: string
  studentNumber?: string
  confirmDuplicate?: boolean
}

export interface UpdateStudentInput {
  name?: string
  schoolYear?: string
  grade?: string
  class?: string
  studentNumber?: string
}
