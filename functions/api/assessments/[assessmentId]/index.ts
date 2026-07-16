import { isAccessError, requireInstalledAccess } from '../../../_lib/requireInstalledAccess'
import {
  ASSESSMENT_EXTRACTED_FIELDS,
  getAssessment,
  reviewAssessment,
  type ReviewAssessmentInput,
} from '../../../_lib/assessmentSheet'
import { CASE_STATUS_RESULT_CHECK, CASE_STATUS_SESSION_SCHEDULED, transitionCaseStatus } from '../../../_lib/caseSheet'
import { getAssessmentIdParam, handleAssessmentSheetError } from '../../../_lib/assessmentApiHelpers'
import type { Env } from '../../../_lib/env'

/** 검사결과 상세 조회(GET /api/assessments/:assessmentId). 로그인 필요. */
export const onRequestGet: PagesFunction<Env, 'assessmentId'> = async ({ request, env, params }) => {
  const access = await requireInstalledAccess(request, env)
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
    return Response.json({ assessment })
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
  const access = await requireInstalledAccess(request, env)
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
