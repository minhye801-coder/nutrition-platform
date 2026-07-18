import { isAccessError, requireSchoolWorkspaceAccess } from '../../_lib/requireInstalledAccess'
import { getMigrationReport } from '../../_lib/migrationOrchestrator'
import type { Env } from '../../_lib/env'

/** 마지막 마이그레이션 결과 조회(GET /api/migration/status). 건수만 담고 원문은 없다. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const report = await getMigrationReport(env, access.session.googleSub)
  return Response.json({ report })
}
