import { requireSession } from '../_lib/requireSession'
import { getInstallationStore } from '../_lib/stores'
import type { Env } from '../_lib/env'

interface UpdateManagerNameBody {
  managerName?: string
}

/**
 * 설치 프로필(학교명/담당자명/schoolPublicId) + Google 리소스 바로가기 URL 조회.
 * 실제 설치 실행(Drive/Sheets 생성)은 /api/setup/*(functions/_lib/setupOrchestrator.ts)가
 * 담당하며, 이 라우트는 완료된 설치의 표시용 정보만 다룬다. rootFolderId/spreadsheetId
 * 원문은 여기서 절대 반환하지 않는다(security-principles.md 4절) — 항상 완성된
 * Google URL(driveFolderUrl/spreadsheetUrl)로만 내려준다.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const installation = await getInstallationStore(env).get(session.googleSub)
  if (!installation) {
    return Response.json({ installed: false })
  }

  return Response.json({
    installed: true,
    schoolName: installation.schoolName,
    managerName: installation.managerName,
    schoolPublicId: installation.schoolPublicId,
    driveFolderUrl: installation.rootFolderId
      ? `https://drive.google.com/drive/folders/${installation.rootFolderId}`
      : null,
    spreadsheetUrl: installation.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${installation.spreadsheetId}/edit`
      : null,
    // Phase 8 마이그레이션 전 기존 설치는 identitySpreadsheetId가 없을 수 있다 — 그
    // 경우 아직 학생정보가 상담데이터 Spreadsheet와 분리되지 않았다는 뜻이므로 null로
    // 내려준다(설정 화면이 "미생성"으로 보여준다).
    identitySpreadsheetUrl: installation.identitySpreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${installation.identitySpreadsheetId}/edit`
      : null,
  })
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }
  // 설치는 애초에 SCHOOL_WORKSPACE만 만들 수 있으므로(functions/api/setup/start.ts) 이
  // 검사는 사실상 방어적 중복이지만, 계정 성격이 나중에 바뀐 경우까지 대비해 둔다.
  if (session.accountMode !== 'SCHOOL_WORKSPACE' || !session.schoolUseConfirmed) {
    return Response.json({ error: 'school_workspace_required' }, { status: 403 })
  }

  const store = getInstallationStore(env)
  if (!(await store.get(session.googleSub))) {
    return Response.json({ error: 'not_installed' }, { status: 404 })
  }

  let body: UpdateManagerNameBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const managerName = body.managerName?.trim()
  if (!managerName) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  await store.updateManagerName(session.googleSub, managerName)
  return Response.json({ managerName })
}
