import { isAccessError, requireInstalledAccess } from '../../_lib/requireInstalledAccess'
import { createStudent, findActiveDuplicate, listStudents } from '../../_lib/studentSheet'
import { GoogleApiError } from '../../_lib/googleApiError'
import type { Env } from '../../_lib/env'

interface CreateStudentBody {
  name?: string
  grade?: string
  class?: string
  studentNumber?: string
  /** 이름·학년·반이 겹치는 재학생이 이미 있어도 강제로 새로 등록한다. */
  confirmDuplicate?: boolean
}

/** 학생 목록 조회 + 검색(GET /api/students?q=&grade=&class=&status=). */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireInstalledAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const url = new URL(request.url)
  try {
    const students = await listStudents(access.accessToken, access.spreadsheetId, {
      q: url.searchParams.get('q') ?? undefined,
      grade: url.searchParams.get('grade') ?? undefined,
      class: url.searchParams.get('class') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    })
    return Response.json({ students })
  } catch (error) {
    if (error instanceof GoogleApiError) {
      console.error('[students] list failed', error.status, error.detail)
      return Response.json({ error: 'sheets_unavailable' }, { status: 502 })
    }
    throw error
  }
}

/** 학생 등록(POST /api/students). 이름+학년+반이 겹치는 재학생이 있으면 409. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireInstalledAccess(request, env)
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

  const name = body.name?.trim()
  const grade = body.grade?.trim()
  const studentClass = body.class?.trim()
  if (!name || !grade || !studentClass) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    if (!body.confirmDuplicate) {
      const duplicate = await findActiveDuplicate(access.accessToken, access.spreadsheetId, name, grade, studentClass)
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
      grade,
      class: studentClass,
      studentNumber: body.studentNumber?.trim(),
    })
    return Response.json({ student }, { status: 201 })
  } catch (error) {
    if (error instanceof GoogleApiError) {
      console.error('[students] create failed', error.status, error.detail)
      return Response.json({ error: 'sheets_unavailable' }, { status: 502 })
    }
    throw error
  }
}
