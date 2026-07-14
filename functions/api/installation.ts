import { parseCookies } from '../_lib/cookies'
import { getSessionStore, getInstallationStore } from '../_lib/stores'
import { randomPublicId } from '../_lib/crypto'
import type { SessionRecord } from '../_lib/sessionStore'
import type { Env } from '../_lib/env'

async function requireSession(request: Request, env: Env): Promise<SessionRecord | null> {
  const cookies = parseCookies(request.headers.get('Cookie'))
  const sessionId = cookies['session']
  if (!sessionId) return null
  return getSessionStore(env).get(sessionId)
}

interface CreateInstallationBody {
  schoolName?: string
  managerName?: string
}

interface UpdateManagerNameBody {
  managerName?: string
}

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const session = await requireSession(request, env)
  if (!session) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const store = getInstallationStore(env)
  if (await store.get(session.googleSub)) {
    return Response.json({ error: 'already_installed' }, { status: 409 })
  }

  let body: CreateInstallationBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const schoolName = body.schoolName?.trim()
  const managerName = body.managerName?.trim()
  if (!schoolName || !managerName) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const now = Date.now()
  const schoolPublicId = `SCH-${randomPublicId(6)}`

  await store.create({
    userId: session.googleSub,
    schoolName,
    managerName,
    schoolPublicId,
    installedAt: now,
    updatedAt: now,
  })

  return Response.json({ installed: true, schoolName, managerName, schoolPublicId })
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
