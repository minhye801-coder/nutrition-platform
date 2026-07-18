import type { AccountMode } from '@/types/session'

/**
 * 서비스 함수(studentService 등)는 React 컴포넌트가 아니라서 useSession() 훅의
 * 상태를 직접 읽을 수 없다. useSession()이 세션을 가져올 때마다 이 캐시를 갱신해
 * 서비스 계층이 동기적으로 "지금 데모 모드인지" 판단할 수 있게 한다. 이 값은 UX
 * 분기(어느 저장소를 쓸지)에만 쓰이고, 실제 권한 판정은 항상 서버가 세션을 다시
 * 확인해서 내린다(functions/_lib/requireInstalledAccess.ts) — 이 캐시를 조작해도
 * 서버 API가 열리지는 않는다.
 */
let cachedAccountMode: AccountMode | null = null

export function setCachedAccountMode(mode: AccountMode | null): void {
  cachedAccountMode = mode
}

export function getCachedAccountMode(): AccountMode | null {
  return cachedAccountMode
}

/** PERSONAL_DEMO/WORKSPACE_PENDING 둘 다 "실제 학교 데이터를 쓸 수 없는" 데모 취급이다. */
export function isDemoMode(): boolean {
  return cachedAccountMode !== null && cachedAccountMode !== 'SCHOOL_WORKSPACE'
}
