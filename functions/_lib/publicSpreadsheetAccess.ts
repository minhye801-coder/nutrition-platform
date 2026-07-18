import { getInstallationStore, getSessionStore } from './stores'
import { hasDriveScope, refreshAccessToken } from './googleOAuth'
import { isAccountStillSchoolWorkspace } from './accountMode'
import type { Env } from './env'
import type { InstallationRecord } from './installationStore'

export interface PublicSpreadsheetAccess {
  installation: InstallationRecord
  accessToken: string
  /** 상담데이터 Spreadsheet. */
  spreadsheetId: string
  /** 학생식별정보 Spreadsheet(하위호환: 마이그레이션 전이면 spreadsheetId와 동일). */
  identitySpreadsheetId: string
}

export type PublicAccessError =
  | { error: 'school_not_found'; status: 404 }
  | { error: 'installation_incomplete'; status: 500 }
  | { error: 'owner_reauth_required'; status: 503 }
  | { error: 'owner_not_school_workspace'; status: 404 }

/**
 * 로그인 세션 없이 `schoolPublicId`만으로 그 학교 소유자의 Drive/Sheets access token을
 * 얻는다(docs/public-intake-auth-design.md 3.3절). 공개 상담신청처럼 신청자에게 세션이
 * 없는 라우트 전용 — `requireInstalledAccess`(로그인 세션 필요)와는 의도적으로 로직을
 * 공유하지 않는다. 실패 시 대응이 근본적으로 다르기 때문이다: 로그인한 교사는
 * 재로그인으로 스스로 문제를 해결할 수 있지만, 공개 신청자는 학교 계정을 대신
 * 재로그인시킬 방법이 없다(3.4절).
 */
export async function ensurePublicSpreadsheetAccess(
  env: Env,
  schoolPublicId: string,
): Promise<PublicSpreadsheetAccess | PublicAccessError> {
  const installation = await getInstallationStore(env).getBySchoolPublicId(schoolPublicId)
  if (!installation) return { error: 'school_not_found', status: 404 }
  if (!installation.spreadsheetId) return { error: 'installation_incomplete', status: 500 }

  // 설치 자체는 SCHOOL_WORKSPACE만 만들 수 있지만(functions/api/setup/start.ts), 계정
  // 성격이 나중에 바뀌는 경우까지 대비해 공개 페이지를 서빙하기 직전에 다시 확인한다
  // (요구사항 3절 "학교용 기능 활성화 버튼을 우회하는 직접 API 호출" 차단과 동일한 원칙).
  const stillSchoolWorkspace = await isAccountStillSchoolWorkspace(env, installation.userId)
  if (!stillSchoolWorkspace) return { error: 'owner_not_school_workspace', status: 404 }

  const tokens = await getSessionStore(env).getTokensByUserId(installation.userId)
  if (!tokens || !tokens.refreshToken) return { error: 'owner_reauth_required', status: 503 }

  const now = Date.now()
  const stillFresh = tokens.accessTokenExpiresAt > now + 60_000 && hasDriveScope(tokens.grantedScopes)
  if (stillFresh) {
    return {
      installation,
      accessToken: tokens.accessToken,
      spreadsheetId: installation.spreadsheetId,
      identitySpreadsheetId: installation.identitySpreadsheetId ?? installation.spreadsheetId,
    }
  }

  try {
    const refreshed = await refreshAccessToken(
      { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
      tokens.refreshToken,
    )
    if (!hasDriveScope(refreshed.scope ?? '')) return { error: 'owner_reauth_required', status: 503 }

    await getSessionStore(env).updateAccessToken(installation.userId, {
      accessToken: refreshed.access_token,
      accessTokenExpiresAt: now + refreshed.expires_in * 1000,
      grantedScopes: refreshed.scope,
    })
    return {
      installation,
      accessToken: refreshed.access_token,
      spreadsheetId: installation.spreadsheetId,
      identitySpreadsheetId: installation.identitySpreadsheetId ?? installation.spreadsheetId,
    }
  } catch {
    return { error: 'owner_reauth_required', status: 503 }
  }
}

export function isPublicAccessError(
  result: PublicSpreadsheetAccess | PublicAccessError,
): result is PublicAccessError {
  return 'error' in result
}
