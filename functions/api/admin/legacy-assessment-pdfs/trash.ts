import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import { listAssessments } from '../../../_lib/assessmentSheet'
import { trashFile } from '../../../_lib/googleDrive'
import { handleAssessmentSheetError } from '../../../_lib/assessmentApiHelpers'
import { maskStudentId } from '../../../_lib/maskId'
import type { Env } from '../../../_lib/env'

interface TrashBody {
  fileIds?: unknown
}

/**
 * 관리자가 점검 목록(GET /api/admin/legacy-assessment-pdfs)에서 직접 선택한 원본
 * 진단검사 PDF만 Drive 휴지통으로 옮긴다(영구 삭제 아님 — Drive 자체 휴지통 보관
 * 기간 동안 복구 가능). 자동 삭제는 절대 하지 않는다 — 이 액션은 관리자가 명시적으로
 * 선택한 fileId에 대해서만 호출된다. 요청받은 fileId가 이 학교 설치의 `진단결과`
 * 시트에 실제로 존재하는 값인지 먼저 검증해, 임의의 Drive 파일 ID를 넘겨 지우는
 * 것을 막는다.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  let body: TrashBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  const requestedIds = Array.isArray(body.fileIds) ? body.fileIds.filter((id): id is string => typeof id === 'string') : []
  if (requestedIds.length === 0) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const assessments = await listAssessments(access.accessToken, access.spreadsheetId)
    const knownFileIds = new Map(assessments.filter((a) => a.fileId).map((a) => [a.fileId, a]))

    const results: { fileId: string; ok: boolean }[] = []
    for (const fileId of requestedIds) {
      const record = knownFileIds.get(fileId)
      if (!record) {
        results.push({ fileId, ok: false })
        continue
      }
      try {
        await trashFile(access.accessToken, fileId)
        results.push({ fileId, ok: true })
      } catch (error) {
        console.error(
          `[admin] legacy pdf trash failed for studentId=${maskStudentId(record.studentUuid)}`,
          error,
        )
        results.push({ fileId, ok: false })
      }
    }

    return Response.json({ results })
  } catch (error) {
    return handleAssessmentSheetError('legacy_pdf_trash', error)
  }
}
