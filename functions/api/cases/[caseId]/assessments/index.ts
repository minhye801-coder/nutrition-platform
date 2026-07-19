import { isAccessError, requireSchoolWorkspaceAccess } from '../../../../_lib/requireInstalledAccess'
import { getCase, CASE_STATUS_DIAGNOSIS_PENDING, CASE_STATUS_RESULT_CHECK, transitionCaseStatus } from '../../../../_lib/caseSheet'
import { ensureAssessment, listAssessmentsByCase } from '../../../../_lib/assessmentSheet'
import { getCaseIdParam, handleAssessmentSheetError, isRawFileUploadRequest } from '../../../../_lib/assessmentApiHelpers'
import type { Env } from '../../../../_lib/env'

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

/**
 * 검사결과 등록(POST /api/cases/:caseId/assessments, application/json). 로그인 필요.
 *
 * 개인정보 보호 구조 확정 사항: 진단검사 원본 PDF는 학교 PC 로컬에만 두고, Cloudflare
 * Worker나 Google Drive로 전송하지 않는다 — legacy `uploadCaseFile`(counseling-manager/
 * code.gs.txt:3893-3963)처럼 원본 PDF 바이트를 받아 Drive "03_공식진단" 폴더에 저장하던
 * 이전 구현을 제거했다. multipart/form-data나 application/pdf로 들어오는 요청은 본문을
 * 읽지 않고 즉시 거부한다(isRawFileUploadRequest).
 *
 * 이 엔드포인트는 이제 round/timepoint만 받아 빈 검사결과 레코드를 만든다 — 원본 PDF는
 * 브라우저(PdfDeidentifyPanel/src/lib/pdfDeidentify.ts)에서만 읽고, 비식별화 확인을 거친
 * 텍스트만 별도 액션(POST /api/assessments/:assessmentId/extract)으로 서버에 전달된다.
 * 교사가 AI 자동확인을 아예 쓰지 않고 직접 입력만 할 수도 있으므로(사용자 확인, "AI는
 * 선택 기능"), 생성 시점엔 fileUrl/fileId/fileName을 비워 두고 케이스만 `진단 대기 →
 * 결과 확인`으로 전이한다.
 *
 * createAssessment를 직접 부르지 않고 ensureAssessment(assessmentSheet.ts)를 거친다 —
 * 같은 caseId+timepoint로 다시 호출해도(버튼 연타, 새로고침 후 재등록) 새 행을 만들지
 * 않고 기존 레코드를 그대로 돌려준다(요구사항 3·8절, legacy `ensureDiagnosisRecord_`와
 * 동일한 규칙).
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

  if (isRawFileUploadRequest(request)) {
    return Response.json(
      {
        error: 'raw_pdf_upload_not_supported',
        message:
          '원본 진단검사 PDF는 서버로 전송할 수 없습니다. 브라우저에서 비식별화 확인을 마친 텍스트만 전송해 주세요.',
      },
      { status: 400 },
    )
  }

  let body: { round?: unknown; timepoint?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  const round = typeof body?.round === 'string' ? body.round.trim() : ''
  const timepoint = typeof body?.timepoint === 'string' ? body.timepoint.trim() : ''
  if (!round || !timepoint) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const caseRecord = await getCase(access.accessToken, access.spreadsheetId, caseId)
    if (!caseRecord) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    const { assessment, created } = await ensureAssessment(access.accessToken, access.spreadsheetId, {
      tenantId: access.installation.schoolPublicId,
      caseId,
      studentUuid: caseRecord.studentUuid,
      round,
      timepoint,
      uploadedBy: access.session.email,
    })

    // 이미 존재하던 기록을 그대로 돌려준 경우(created=false)는 케이스가 이미 이 단계를
    // 지났을 수 있다 — transitionCaseStatus는 현재 상태가 '진단 대기'일 때만 전이하므로
    // 매번 호출해도 안전하다(가드 자체가 idempotent).
    await transitionCaseStatus(
      access.accessToken,
      access.spreadsheetId,
      caseId,
      [CASE_STATUS_DIAGNOSIS_PENDING],
      CASE_STATUS_RESULT_CHECK,
    )

    return Response.json({ assessment, created })
  } catch (error) {
    return handleAssessmentSheetError('create', error)
  }
}
