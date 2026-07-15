import { isAccessError, requireInstalledAccess } from '../../_lib/requireInstalledAccess'
import { deactivateStudent, updateStudent, type StudentPatch } from '../../_lib/studentSheet'
import { GoogleApiError } from '../../_lib/googleApiError'
import type { Env } from '../../_lib/env'

function getStudentUuidParam(params: Record<string, string | string[]>): string | null {
  const value = params.studentUuid
  const studentUuid = Array.isArray(value) ? value[0] : value
  return studentUuid || null
}

interface UpdateStudentBody {
  name?: string
  grade?: string
  class?: string
  studentNumber?: string
  enrollmentStatus?: string
}

/** 학생 정보 수정(PATCH /api/students/:studentUuid). 보낸 필드만 반영한다. */
export const onRequestPatch: PagesFunction<Env, 'studentUuid'> = async ({ request, env, params }) => {
  const access = await requireInstalledAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const studentUuid = getStudentUuidParam(params)
  if (!studentUuid) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  let body: UpdateStudentBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const patch: StudentPatch = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.grade === 'string' && body.grade.trim()) patch.grade = body.grade.trim()
  if (typeof body.class === 'string' && body.class.trim()) patch.class = body.class.trim()
  if (typeof body.studentNumber === 'string') patch.studentNumber = body.studentNumber.trim()
  if (typeof body.enrollmentStatus === 'string' && body.enrollmentStatus.trim()) {
    patch.enrollmentStatus = body.enrollmentStatus.trim()
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const updated = await updateStudent(access.accessToken, access.spreadsheetId, studentUuid, patch)
    if (!updated) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return Response.json({ student: updated })
  } catch (error) {
    if (error instanceof GoogleApiError) {
      console.error('[students] update failed', error.status, error.detail)
      return Response.json({ error: 'sheets_unavailable' }, { status: 502 })
    }
    throw error
  }
}

/** 학생 비활성 처리(DELETE /api/students/:studentUuid). 행을 지우지 않고 enrollmentStatus만 바꾼다. */
export const onRequestDelete: PagesFunction<Env, 'studentUuid'> = async ({ request, env, params }) => {
  const access = await requireInstalledAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const studentUuid = getStudentUuidParam(params)
  if (!studentUuid) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const updated = await deactivateStudent(access.accessToken, access.spreadsheetId, studentUuid)
    if (!updated) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return Response.json({ student: updated })
  } catch (error) {
    if (error instanceof GoogleApiError) {
      console.error('[students] deactivate failed', error.status, error.detail)
      return Response.json({ error: 'sheets_unavailable' }, { status: 502 })
    }
    throw error
  }
}
