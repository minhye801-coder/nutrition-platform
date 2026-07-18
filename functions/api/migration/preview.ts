import { isAccessError, requireSchoolWorkspaceAccess } from '../../_lib/requireInstalledAccess'
import { previewMigration } from '../../_lib/migrationOrchestrator'
import type { Env } from '../../_lib/env'

/**
 * 마이그레이션 미리보기(GET /api/migration/preview). 로그인 필요, SCHOOL_WORKSPACE
 * 전용. 아무것도 쓰지 않는다 — 요구사항 12절 "마이그레이션 전에 처리 대상 학생 수/
 * 상담기록 수/중복 가능성이 있는 학생/백업 파일 생성 여부"를 보여주기 위한 조회다.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  try {
    const preview = await previewMigration(access.accessToken, access.installation)
    return Response.json(preview)
  } catch (error) {
    console.error('[migration] preview failed', error)
    return Response.json({ error: 'preview_failed' }, { status: 502 })
  }
}
