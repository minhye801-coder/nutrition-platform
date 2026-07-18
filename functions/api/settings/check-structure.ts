import { isAccessError, requireSchoolWorkspaceAccess } from '../../_lib/requireInstalledAccess'
import { spreadsheetExists } from '../../_lib/googleSheets'
import { findFolderByName } from '../../_lib/googleDrive'
import { SUBFOLDER_NAMES } from '../../_lib/installTemplate'
import type { Env } from '../../_lib/env'

/**
 * "저장 구조 점검"(GET /api/settings/check-structure). 로그인 필요, SCHOOL_WORKSPACE
 * 전용. 두 Spreadsheet와 4개 폴더가 실제로 아직 존재하는지 Google API로 다시
 * 확인한다 — 사용자가 Drive에서 실수로 지웠거나 옮긴 경우를 조기에 알려준다.
 * 단순히 "탭이 있다"는 것만으로 보안이 지켜진다고 보지 않는다(요구사항 5절) — 이
 * 점검도 구조 존재 여부만 확인할 뿐, 그 자체가 보안 통제는 아니다.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const rootFolderId = access.installation.rootFolderId
  const [dataSpreadsheetOk, identitySpreadsheetOk, folderChecks] = await Promise.all([
    spreadsheetExists(access.accessToken, access.spreadsheetId),
    access.installation.identitySpreadsheetId
      ? spreadsheetExists(access.accessToken, access.installation.identitySpreadsheetId)
      : Promise.resolve(false),
    rootFolderId
      ? Promise.all(
          SUBFOLDER_NAMES.map(async (name) => ({
            name,
            exists: Boolean(await findFolderByName(access.accessToken, name, rootFolderId)),
          })),
        )
      : Promise.resolve(SUBFOLDER_NAMES.map((name) => ({ name, exists: false }))),
  ])

  return Response.json({
    dataSpreadsheetOk,
    identitySpreadsheetOk,
    folders: folderChecks,
    checkedAt: new Date().toISOString(),
  })
}
