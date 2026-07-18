import { isAccessError, requireSchoolWorkspaceAccess } from '../../_lib/requireInstalledAccess'
import { listIntakes } from '../../_lib/intakeSheet'
import { handleIntakeSheetError } from '../../_lib/intakeApiHelpers'
import type { Env } from '../../_lib/env'

/** 상담접수 목록 조회 + 검색(GET /api/intakes?status=&q=). 로그인 필요. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const url = new URL(request.url)
  try {
    const intakes = await listIntakes(access.accessToken, access.identitySpreadsheetId, {
      status: url.searchParams.get('status') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
    })
    return Response.json({ intakes })
  } catch (error) {
    return handleIntakeSheetError('list', error)
  }
}
