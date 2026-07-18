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
  /**
   * 상담데이터 Spreadsheet(케이스/동의/진단결과 등, 학생 이름 없음). 대부분의 API가
   * 이 값을 쓴다 — installation.spreadsheetId의 null 아님이 보장된 값.
   */
  spreadsheetId: string
  /**
   * 학생식별정보 Spreadsheet(학생정보/상담접수, 이름 포함). 학생/접수 관련 API만 이
   * 값을 쓴다. Phase 8 마이그레이션 전 기존 설치는 identitySpreadsheetId가 아직 없을
   * 수 있으므로, 그 경우 spreadsheetId(단일 Spreadsheet 시절 값)로 대체한다 —
   * 마이그레이션 전까지도 학생 API가 깨지지 않게 하기 위한 하위호환 처리다.
   */
  identitySpreadsheetId: string
}

export type InstalledAccessError =
  | { error: 'unauthenticated'; status: 401 }
  | { error: 'not_installed'; status: 404 }
  | { error: 'drive_access_required'; status: 401 }
  | { error: 'installation_incomplete'; status: 500 }
  | { error: 'school_workspace_required'; status: 403 }

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
    return {
      session,
      installation,
      accessToken,
      spreadsheetId: installation.spreadsheetId,
      identitySpreadsheetId: installation.identitySpreadsheetId ?? installation.spreadsheetId,
    }
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

/**
 * 학생 자료(등록/검색/상담접수/보호자동의/진단검사/상담기록 등)를 다루는 모든 API가
 * 공통으로 써야 하는 게이트. UI에서 버튼을 숨기는 것과 무관하게, 이 함수를 거치지
 * 않고 직접 fetch로 호출해도 서버가 계정 모드를 확인해 차단한다(요구사항 3·8·13절).
 * PERSONAL_DEMO/WORKSPACE_PENDING 계정은 애초에 requireInstalledAccess 단계에서
 * installation이 없어 not_installed로 걸리는 경우가 대부분이지만(설치 자체가
 * account_mode 게이트로 막혀 있음, functions/api/setup/start.ts), 과거에 설치를
 * 마친 뒤 계정 성격이 바뀌었거나 판정이 달라진 경우까지 방어하기 위해 별도로
 * account_mode를 다시 확인한다.
 */
export async function requireSchoolWorkspaceAccess(
  request: Request,
  env: Env,
): Promise<InstalledAccess | InstalledAccessError> {
  const access = await requireInstalledAccess(request, env)
  if (isAccessError(access)) return access
  if (access.session.accountMode !== 'SCHOOL_WORKSPACE' || !access.session.schoolUseConfirmed) {
    return { error: 'school_workspace_required', status: 403 }
  }
  return access
}
