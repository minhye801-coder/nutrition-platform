import type { SessionStore } from './sessionStore'
import { memorySessionStore } from './sessionStore.memory'
import { createD1SessionStore } from './sessionStore.d1'
import type { InstallationLookup } from './installationStore'
import { devInstallationLookup } from './installationStore'
import { createD1InstallationLookup } from './installationStore.d1'
import type { Env } from './env'

/**
 * 저장소 합성 지점. 라우트 핸들러는 이 모듈을 통해서만 저장소를 얻는다.
 * AUTH_DB(D1) 바인딩이 있으면 운영용 D1 저장소를 쓰고, 없으면(로컬 개발 등)
 * 인메모리 구현으로 대체한다.
 */
export function getSessionStore(env: Pick<Env, 'AUTH_DB' | 'SESSION_SECRET'>): SessionStore {
  if (env.AUTH_DB) {
    return createD1SessionStore(env.AUTH_DB, env.SESSION_SECRET)
  }
  return memorySessionStore
}

export function getInstallationLookup(env: Pick<Env, 'AUTH_DB'>): InstallationLookup {
  if (env.AUTH_DB) {
    return createD1InstallationLookup(env.AUTH_DB)
  }
  return devInstallationLookup
}
