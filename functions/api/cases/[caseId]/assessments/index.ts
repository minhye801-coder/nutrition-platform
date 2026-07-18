import { isAccessError, requireSchoolWorkspaceAccess } from '../../../../_lib/requireInstalledAccess'
import { getCase, CASE_STATUS_DIAGNOSIS_PENDING, CASE_STATUS_RESULT_CHECK, transitionCaseStatus } from '../../../../_lib/caseSheet'
import { createAssessment, listAssessmentsByCase } from '../../../../_lib/assessmentSheet'
import { ensureAssessmentFolder, extractFolderIdFromUrl } from '../../../../_lib/caseFolder'
import { uploadFile } from '../../../../_lib/googleDrive'
import { getCaseIdParam, handleAssessmentSheetError } from '../../../../_lib/assessmentApiHelpers'
import type { Env } from '../../../../_lib/env'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB — 검사결과 PDF 한 장 기준으로 넉넉한 상한.

/** 케이스별 검사결과 목록(GET /api/cases/:caseId/assessments). 로그인 필요. */
export const onRequestGet: PagesFunction<Env, 'caseId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const caseId = getCaseIdParam(params)
  if (!caseId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const assessments = await listAssessmentsByCase(access.accessToken, access.spreadsheetId, caseId)
    return Response.json({ assessments })
  } catch (error) {
    return handleAssessmentSheetError('list', error)
  }
}

function sanitizeFileNamePart(value: string): string {
  // legacy sanitizeFileName_(counseling-manager/code.gs.txt:6878-6880)와 동일한 치환 규칙.
  return value.replace(/[\\/:*?"<>|]/g, '_').trim()
}

function formatTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}${get('month')}${get('day')}_${get('hour')}${get('minute')}${get('second')}`
}

/**
 * 검사결과 PDF 업로드(POST /api/cases/:caseId/assessments, multipart/form-data). 로그인
 * 필요. legacy `uploadCaseFile`(counseling-manager/code.gs.txt:3893-3963)의 저장 경로/
 * 파일명 규칙을 그대로 따른다 — 폴더는 케이스 폴더/03_공식진단, 파일명은
 * `{학생명}_진단결과_{평가시점}_{yyyyMMdd_HHmmss}{확장자}`.
 *
 * 이 단계에서는 Gemini를 호출하지 않는다(사용자 확인 — "AI로 자동 확인"은 별도 액션인
 * extract.ts). 업로드만으로 케이스를 `진단 대기 → 결과 확인`으로 전이한다.
 */
export const onRequestPost: PagesFunction<Env, 'caseId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const caseId = getCaseIdParam(params)
  if (!caseId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  // Cloudflare Workers 런타임은 multipart 필드로 실제 File을 돌려주지만,
  // @cloudflare/workers-types의 FormData.get() 타입 선언은 string | null까지만
  // 표현한다(타입 정의 한계) — 런타임 형태에 맞춰 캐스팅한다.
  const file = formData.get('file') as unknown as File | string | null
  const round = String(formData.get('round') ?? '').trim()
  const timepoint = String(formData.get('timepoint') ?? '').trim()

  if (!file || typeof file === 'string' || !round || !timepoint) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return Response.json({ error: 'invalid_file_type' }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return Response.json({ error: 'invalid_file_size' }, { status: 400 })
  }

  try {
    const caseRecord = await getCase(access.accessToken, access.spreadsheetId, caseId)
    if (!caseRecord) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    const caseFolderId = extractFolderIdFromUrl(caseRecord.driveFolderUrl)
    if (!caseFolderId) {
      return Response.json({ error: 'installation_incomplete' }, { status: 500 })
    }

    // 파일명에 학생 이름을 쓰지 않는다(요구사항 6절) — StudentID로만 식별한다.
    const extIndex = file.name.lastIndexOf('.')
    const ext = extIndex >= 0 ? file.name.slice(extIndex) : ''
    const safeName = `${sanitizeFileNamePart(caseRecord.studentUuid)}_진단결과_${sanitizeFileNamePart(
      timepoint,
    )}_${formatTimestamp(new Date())}${ext}`

    const assessmentFolderId = await ensureAssessmentFolder(access.accessToken, caseFolderId)
    const fileBytes = await file.arrayBuffer()
    const uploaded = await uploadFile(access.accessToken, safeName, assessmentFolderId, file.type, fileBytes)

    const assessment = await createAssessment(access.accessToken, access.spreadsheetId, {
      tenantId: access.installation.schoolPublicId,
      caseId,
      studentUuid: caseRecord.studentUuid,
      round,
      timepoint,
      fileUrl: uploaded.webViewLink,
      fileId: uploaded.id,
      fileName: safeName,
      uploadedBy: access.session.email,
    })

    await transitionCaseStatus(
      access.accessToken,
      access.spreadsheetId,
      caseId,
      [CASE_STATUS_DIAGNOSIS_PENDING],
      CASE_STATUS_RESULT_CHECK,
    )

    return Response.json({ assessment })
  } catch (error) {
    return handleAssessmentSheetError('create', error)
  }
}
