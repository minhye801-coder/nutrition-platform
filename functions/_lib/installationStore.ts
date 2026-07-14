/**
 * 로그인한 Google 계정이 이미 학교 작업공간을 설치했는지 조회하는 인터페이스.
 * 콜백 핸들러가 /setup(신규)과 /app(기존 설치) 중 어디로 보낼지 결정하는 데 사용한다.
 * 아직 설치 데이터 저장소(D1)가 없으므로 `stores.ts`는 항상 false를 반환하는
 * 임시 구현을 연결한다 — 이 시점에는 모든 로그인이 /setup으로 이동한다.
 */
export interface InstallationLookup {
  hasInstallation(googleSub: string): Promise<boolean>
}

export const devInstallationLookup: InstallationLookup = {
  async hasInstallation() {
    return false
  },
}
