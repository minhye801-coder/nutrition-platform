export interface InstallationRecord {
  userId: string
  schoolName: string
  managerName: string
  schoolPublicId: string
  installedAt: number
  updatedAt: number
}

/**
 * 학교 작업공간 설치 정보 저장소. 로그인한 Google 계정(userId=Google `sub`)마다
 * 최초 설치 화면에서 입력한 학교명/담당자명과 발급된 schoolPublicId를 보관한다.
 * 여기 저장된 managerName은 화면 표시용 담당자명으로 users.name(Google 프로필
 * 이름)보다 우선하며, users.name은 인증용 기본정보로만 남는다.
 *
 * 로컬 개발은 `installationStore.memory.ts`(인메모리)를, 운영은
 * `installationStore.d1.ts`(Cloudflare D1)를 `stores.ts`에서 연결해 사용한다.
 */
export interface InstallationStore {
  get(userId: string): Promise<InstallationRecord | null>
  create(record: InstallationRecord): Promise<void>
  updateManagerName(userId: string, managerName: string): Promise<void>
}
