import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import {
  ASSESSMENT_EXTRACTED_FIELDS,
  getAssessment,
  isReviewFlagCode,
  reviewAssessment,
  type ReviewAssessmentInput,
} from '../../../_lib/assessmentSheet'
import { CASE_STATUS_RESULT_CHECK, CASE_STATUS_SESSION_SCHEDULED, getCase, transitionCaseStatus } from '../../../_lib/caseSheet'
import { getStudentByUuid } from '../../../_lib/studentSheet'
import { getAssessmentIdParam, handleAssessmentSheetError } from '../../../_lib/assessmentApiHelpers'
import type { Env } from '../../../_lib/env'

/**
 * 검사결과 상세 조회(GET /api/assessments/:assessmentId). 로그인 필요.
 *
 * 목록(GET /api/assessments)과 동일한 모양(assessment + caseTopic/caseStatus/studentName/
 * grade/studentClass/studentNumber)으로 응답한다 — 이전에는 여기가 assessment 레코드만
 * 돌려줘서 검토 화면이 학생 이름을 아예 표시하지 못했다(요구사항 2절 학생 연결 복원).
 * caseId/studentUuid는 이미 조회된 assessment 레코드에서 읽으므로 이름이 아니라 항상
 * StudentID+caseId로 조인한다.
 */
export const onRequestGet: PagesFunction<Env, 'assessmentId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const assessmentId = getAssessmentIdParam(params)
  if (!assessmentId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const assessment = await getAssessment(access.accessToken, access.spreadsheetId, assessmentId)
    if (!assessment) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    const [caseRecord, student] = await Promise.all([
      getCase(access.accessToken, access.spreadsheetId, assessment.caseId),
      getStudentByUuid(access.accessToken, access.identitySpreadsheetId, assessment.studentUuid),
    ])

    return Response.json({
      assessment,
      caseTopic: caseRecord?.topic ?? '',
      caseStatus: caseRecord?.status ?? '',
      studentName: student?.name ?? '',
      grade: student?.grade ?? '',
      studentClass: student?.class ?? '',
      studentNumber: student?.studentNumber ?? '',
    })
  } catch (error) {
    return handleAssessmentSheetError('get', error)
  }
}

interface ReviewAssessmentBody {
  reviewNote?: string
  confirm?: boolean
  [key: string]: unknown
}

/**
 * 교사 검토/수정 저장(PATCH /api/assessments/:assessmentId). AI가 채웠든 교사가 직접
 * 입력했든 동일한 경로 — Gemini를 아예 안 쓴 교사도 이 API 하나로 38개 필드를 전부
 * 채워 저장할 수 있다(사용자 확인, "직접 입력" 경로). `confirm=true`일 때만 최종
 * 확정되고, 그때만 케이스를 `결과 확인 → 상담 예정`으로 전이한다. caseId는 URL이 아니라
 * 조회된 assessment 레코드에서 읽는다(assessmentId만으로 이미 유일하게 식별되므로,
 * 프런트가 caseId를 별도로 들고 다닐 필요가 없다).
 */
export const onRequestPatch: PagesFunction<Env, 'assessmentId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const assessmentId = getAssessmentIdParam(params)
  if (!assessmentId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  let body: ReviewAssessmentBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const input: ReviewAssessmentInput = {
    reviewNote: typeof body.reviewNote === 'string' ? body.reviewNote : undefined,
    confirm: body.confirm === true,
    reviewedBy: access.session.email,
    reviewFlagCodes: Array.isArray(body.reviewFlagCodes)
      ? Array.from(new Set(body.reviewFlagCodes.filter((code): code is string => typeof code === 'string' && isReviewFlagCode(code))))
      : undefined,
  }
  for (const key of ASSESSMENT_EXTRACTED_FIELDS) {
    const value = body[key]
    if (typeof value === 'string') input[key] = value
  }

  try {
    const result = await reviewAssessment(access.accessToken, access.spreadsheetId, assessmentId, input)
    if (!result.ok) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    if (result.confirmed) {
      await transitionCaseStatus(
        access.accessToken,
        access.spreadsheetId,
        result.assessment.caseId,
        [CASE_STATUS_RESULT_CHECK],
        CASE_STATUS_SESSION_SCHEDULED,
      )
    }

    return Response.json({ assessment: result.assessment, confirmed: result.confirmed })
  } catch (error) {
    return handleAssessmentSheetError('review', error)
  }
}
