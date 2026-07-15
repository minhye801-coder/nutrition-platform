/**
 * 완료된 학교 작업공간 설치 1건. 이 레코드가 존재한다는 것 자체가 "설치 완료"를
 * 의미한다(GET /api/installation, useInstallation이 그대로 사용). rootFolderId/
 * spreadsheetId는 서버 내부 참조용이며, 클라이언트에는 항상 완성된 Google URL
 * 형태로만 내려준다(security-principles.md 4절, functions/api/setup/*).
 */
export interface InstallationRecord {
  userId: string
  schoolName: string
  managerName: string
  schoolPublicId: string
  rootFolderId: string | null
  spreadsheetId: string | null
  installedAt: number
  updatedAt: number
}

export type InstallationProgressStatus = 'in_progress' | 'completed' | 'failed'

/**
 * 설치 진행 중(Drive 폴더/Spreadsheet 생성 도중) 상태를 기록하는 임시 레코드.
 * 완료 여부 판정에는 쓰지 않는다 — 완료 판정은 항상 InstallationRecord(installations
 * 테이블 행 존재)로만 한다. 이 레코드는 재시도 시 이미 만들어진 리소스를 다시
 * 만들지 않기 위한 중간 체크포인트다(functions/_lib/setupOrchestrator.ts 참고).
 */
export interface InstallationProgressRecord {
  userId: string
  schoolName: string
  managerName: string
  schoolPublicId: string
  rootFolderId: string | null
  /** 하위 폴더명 → Drive 폴더 ID. */
  folderIds: Record<string, string>
  spreadsheetId: string | null
  headersWritten: boolean
  status: InstallationProgressStatus
  currentStep: string | null
  errorStep: string | null
  /** 사용자에게 보여줄 수 있는 형태로 이미 가공된 문자열만 저장한다(토큰/원본 오류 금지). */
  errorMessage: string | null
  createdAt: number
  updatedAt: number
}

/**
 * 학교 작업공간 설치 저장소. 로컬 개발은 `installationStore.memory.ts`(인메모리)를,
 * 운영은 `installationStore.d1.ts`(Cloudflare D1)를 `stores.ts`에서 연결해 사용한다.
 */
export interface InstallationStore {
  get(userId: string): Promise<InstallationRecord | null>
  updateManagerName(userId: string, managerName: string): Promise<void>
  /** 설치 완료 시 단 한 번 호출되어 installations 행을 만든다. */
  complete(record: InstallationRecord): Promise<void>

  getProgress(userId: string): Promise<InstallationProgressRecord | null>
  saveProgress(record: InstallationProgressRecord): Promise<void>
}
