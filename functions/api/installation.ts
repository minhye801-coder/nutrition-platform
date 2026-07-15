import { requireSession } from '../_lib/requireSession'
import { getInstallationStore } from '../_lib/stores'
import type { Env } from '../_lib/env'

interface UpdateManagerNameBody {
  managerName?: string
}

/**
 * 설치 프로필(학교명/담당자명/schoolPublicId) 조회. 실제 설치 실행(Drive/Sheets
 * 생성)은 /api/setup/*(functions/_lib/setupOrchestrator.ts)가 담당하며, 이
 * 라우트는 완료된 설치의 표시용 정보만 다룬다. rootFolderId/spreadsheetId는
 * 여기서 절대 반환하지 않는다(security-principles.md 4절).
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
  })
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
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
