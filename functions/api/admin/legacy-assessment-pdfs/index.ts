import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import { auditLegacyAssessmentPdfs } from '../../../_lib/legacyPdfAudit'
import { handleAssessmentSheetError } from '../../../_lib/assessmentApiHelpers'
import type { Env } from '../../../_lib/env'

/**
 * 기존(개인정보 보호 구조 확정 이전) 설치에 남아 있을 수 있는 원본 진단검사 PDF
 * 점검 목록(GET /api/admin/legacy-assessment-pdfs). 로그인 필요, SCHOOL_WORKSPACE 전용.
 * 아무것도 삭제하지 않는다 — 목록 확인 전용 조회다.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  try {
    const items = await auditLegacyAssessmentPdfs(access.accessToken, access.spreadsheetId)
    return Response.json({ items })
  } catch (error) {
    return handleAssessmentSheetError('legacy_pdf_audit', error)
  }
}
