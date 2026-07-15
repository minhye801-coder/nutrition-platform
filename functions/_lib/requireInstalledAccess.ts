import { requireSession } from './requireSession'
import { getInstallationStore } from './stores'
import { ensureDriveAccessToken, ReauthRequiredError } from './googleAccessToken'
import type { SessionRecord } from './sessionStore'
import type { InstallationRecord } from './installationStore'
import type { Env } from './env'

export interface InstalledAccess {
  session: SessionRecord
  installation: InstallationRecord
  /** 유효한(만료 임박 시 자동 갱신된) Drive/Sheets 호출용 access token. */
  accessToken: string
  /** installation.spreadsheetId의 null 아님이 보장된 값 — 호출부에서 매번 null 체크하지 않게 한다. */
  spreadsheetId: string
}

export type InstalledAccessError =
  | { error: 'unauthenticated'; status: 401 }
  | { error: 'not_installed'; status: 404 }
  | { error: 'drive_access_required'; status: 401 }
  | { error: 'installation_incomplete'; status: 500 }

/**
 * 학생정보 등 설치 이후 데이터 API가 공통으로 필요로 하는 것 — 로그인 세션, 완료된
 * 설치(Spreadsheet ID 포함), 유효한 Drive/Sheets access token — 을 한 번에 확인한다.
 * 실패 시 원인별 에러를 반환하므로 라우트 핸들러는 그대로 `Response.json`에 실어 보내면 된다.
 */
export async function requireInstalledAccess(
  request: Request,
  env: Env,
): Promise<InstalledAccess | InstalledAccessError> {
  const session = await requireSession(request, env)
  if (!session) {
    return { error: 'unauthenticated', status: 401 }
  }

  const installation = await getInstallationStore(env).get(session.googleSub)
  if (!installation) {
    return { error: 'not_installed', status: 404 }
  }
  if (!installation.spreadsheetId) {
    return { error: 'installation_incomplete', status: 500 }
  }

  try {
    const accessToken = await ensureDriveAccessToken(env, session)
    return { session, installation, accessToken, spreadsheetId: installation.spreadsheetId }
  } catch (error) {
    if (error instanceof ReauthRequiredError) {
      return { error: 'drive_access_required', status: 401 }
    }
    throw error
  }
}

export function isAccessError(
  result: InstalledAccess | InstalledAccessError,
): result is InstalledAccessError {
  return 'error' in result
}
