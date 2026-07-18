import { isAccessError, requireSchoolWorkspaceAccess } from '../../_lib/requireInstalledAccess'
import { runMigration, saveMigrationReport } from '../../_lib/migrationOrchestrator'
import { getInstallationStore } from '../../_lib/stores'
import type { Env } from '../../_lib/env'

/**
 * 마이그레이션 실행(POST /api/migration/run). 로그인 필요, SCHOOL_WORKSPACE 전용.
 * 이미 분리된 설치(identitySpreadsheetId 존재)는 다시 실행하지 않는다 — 멱등.
 * 실패해도 원본 Spreadsheet는 전혀 건드리지 않으므로(항상 새로 만들고 복사만 함)
 * 그대로 복구 가능하다(요구사항 12절 "실패 시 기존 데이터로 복원 가능").
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  if (access.installation.identitySpreadsheetId) {
    return Response.json({ error: 'already_migrated' }, { status: 409 })
  }

  try {
    const result = await runMigration(access.accessToken, access.installation)
    await saveMigrationReport(env, access.session.googleSub, result)

    if (!result.ok) {
      return Response.json({ error: result.errorMessage ?? 'migration_failed' }, { status: 500 })
    }

    await getInstallationStore(env).setIdentitySpreadsheetId(access.session.googleSub, result.identitySpreadsheetId!)

    return Response.json({
      ok: true,
      backupSpreadsheetId: result.backupSpreadsheetId,
      studentsMigrated: result.studentsMigrated,
      intakesMigrated: result.intakesMigrated,
      duplicateCandidates: result.duplicateCandidates,
    })
  } catch (error) {
    console.error('[migration] run failed', error)
    await saveMigrationReport(env, access.session.googleSub, {
      ok: false,
      studentsMigrated: 0,
      intakesMigrated: 0,
      duplicateCandidates: 0,
      errorMessage: 'unexpected_error',
    })
    return Response.json({ error: 'migration_failed' }, { status: 500 })
  }
}
