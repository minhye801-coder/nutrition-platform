import { isAccessError, requireInstalledAccess } from '../../../_lib/requireInstalledAccess'
import { isValidEnrollmentStatus, updateStudent, type StudentPatch } from '../../../_lib/studentSheet'
import { getStudentUuidParam, handleStudentSheetError } from '../../../_lib/studentApiHelpers'
import type { Env } from '../../../_lib/env'

interface UpdateStudentBody {
  studentUuid?: string
  name?: string
  schoolYear?: string
  grade?: string
  class?: string
  studentNumber?: string
  enrollmentStatus?: string
}

/** 학생 정보 수정(PATCH /api/students/:studentUuid). studentUuid 자체는 변경할 수 없다. */
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

  if (typeof body.studentUuid === 'string' && body.studentUuid !== studentUuid) {
    return Response.json({ error: 'student_uuid_immutable' }, { status: 400 })
  }

  const patch: StudentPatch = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.schoolYear === 'string' && body.schoolYear.trim()) patch.schoolYear = body.schoolYear.trim()
  if (typeof body.grade === 'string' && body.grade.trim()) patch.grade = body.grade.trim()
  if (typeof body.class === 'string' && body.class.trim()) patch.class = body.class.trim()
  if (typeof body.studentNumber === 'string') patch.studentNumber = body.studentNumber.trim()
  if (typeof body.enrollmentStatus === 'string' && body.enrollmentStatus.trim()) {
    const status = body.enrollmentStatus.trim()
    if (!isValidEnrollmentStatus(status)) {
      return Response.json({ error: 'invalid_enrollment_status' }, { status: 400 })
    }
    patch.enrollmentStatus = status
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
    return handleStudentSheetError('update', error)
  }
}
