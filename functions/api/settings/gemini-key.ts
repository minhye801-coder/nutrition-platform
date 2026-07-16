import { requireSession } from '../../_lib/requireSession'
import { getInstallationStore } from '../../_lib/stores'
import { encryptToken } from '../../_lib/tokenCipher'
import type { Env } from '../../_lib/env'

/**
 * 교사 본인의 Gemini API Key 저장/조회(Milestone 4 — 검사 결과 PDF 자동추출에 쓴다).
 * 평문 키는 절대 다시 클라이언트로 내려주지 않는다 — GET은 "설정돼 있는지" 여부만
 * 반환한다(installation.ts가 rootFolderId/spreadsheetId 원문을 감추는 것과 동일한 원칙).
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const encrypted = await getInstallationStore(env).getGeminiApiKey(session.googleSub)
  return Response.json({ hasKey: encrypted !== null })
}

interface UpdateGeminiKeyBody {
  /** 빈 문자열이면 저장된 키를 삭제한다. */
  apiKey?: string
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: UpdateGeminiKeyBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || typeof body.apiKey !== 'string') {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const apiKey = body.apiKey.trim()
  const store = getInstallationStore(env)
  if (!apiKey) {
    await store.updateGeminiApiKey(session.googleSub, null)
    return Response.json({ hasKey: false })
  }

  const encrypted = await encryptToken(env.SESSION_SECRET, apiKey)
  await store.updateGeminiApiKey(session.googleSub, encrypted)
  return Response.json({ hasKey: true })
}
