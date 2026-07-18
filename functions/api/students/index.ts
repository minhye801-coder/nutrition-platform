import { isAccessError, requireSchoolWorkspaceAccess } from '../../_lib/requireInstalledAccess'
import { createStudent, findPotentialDuplicate, listStudents } from '../../_lib/studentSheet'
import { handleStudentSheetError } from '../../_lib/studentApiHelpers'
import type { Env } from '../../_lib/env'

interface CreateStudentBody {
  name?: string
  schoolYear?: string
  grade?: string
  class?: string
  studentNumber?: string
  /** 이름·학년도·학년·반·번호가 겹치는 재학생이 이미 있어도 강제로 새로 등록한다. */
  confirmDuplicate?: boolean
}

function toTrimmedString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value).trim()
  return ''
}

/** 학생 목록 조회 + 검색(GET /api/students?q=&grade=&class=&status=). */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const url = new URL(request.url)
  try {
    const students = await listStudents(access.accessToken, access.spreadsheetId, {
      q: url.searchParams.get('q') ?? undefined,
      schoolYear: url.searchParams.get('schoolYear') ?? undefined,
      grade: url.searchParams.get('grade') ?? undefined,
      class: url.searchParams.get('class') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    })
    return Response.json({ students })
  } catch (error) {
    return handleStudentSheetError('list', error)
  }
}

/** 학생 등록(POST /api/students). 이름+학년+반+번호가 겹치는 재학생이 있으면 409. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  let body: CreateStudentBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const name = toTrimmedString(body.name)
  const schoolYear = toTrimmedString(body.schoolYear)
  const grade = toTrimmedString(body.grade)
  const studentClass = toTrimmedString(body.class)
  const studentNumber = toTrimmedString(body.studentNumber)
  if (!name || !schoolYear || !grade || !studentClass) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    if (!body.confirmDuplicate) {
      const duplicate = await findPotentialDuplicate(
        access.accessToken,
        access.spreadsheetId,
        name,
        schoolYear,
        grade,
        studentClass,
        studentNumber,
      )
      if (duplicate) {
        return Response.json(
          { error: 'duplicate_student', existingStudentUuid: duplicate.studentUuid },
          { status: 409 },
        )
      }
    }

    const student = await createStudent(access.accessToken, access.spreadsheetId, {
      tenantId: access.installation.schoolPublicId,
      name,
      schoolYear,
      grade,
      class: studentClass,
      studentNumber,
    })
    return Response.json({ student }, { status: 201 })
  } catch (error) {
    return handleStudentSheetError('create', error)
  }
}
