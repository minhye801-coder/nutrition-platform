import type { EncryptedSecret } from './tokenCipher'

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
  /** 상담데이터 Spreadsheet(케이스/동의/진단결과 등, 학생 이름 미포함). 기존 필드명을 유지한다. */
  spreadsheetId: string | null
  /**
   * 학생식별정보 Spreadsheet(학생정보/상담접수, 이름 포함). Phase 6 이전에 설치된
   * 학교는 이 값이 null일 수 있다 — 그 경우 requireInstalledAccess.ts가 하위호환을 위해
   * spreadsheetId를 그대로 identitySpreadsheetId로도 쓴다(마이그레이션 전까지 임시).
   */
  identitySpreadsheetId: string | null
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
  identitySpreadsheetId: string | null
  headersWritten: boolean
  identityHeadersWritten: boolean
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
  /** 공개 라우트(상담신청 등)가 schoolPublicId만으로 설치를 찾을 때 쓴다(docs/public-intake-auth-design.md 3.1절). */
  getBySchoolPublicId(schoolPublicId: string): Promise<InstallationRecord | null>
  updateManagerName(userId: string, managerName: string): Promise<void>
  /** 설치 완료 시 단 한 번 호출되어 installations 행을 만든다. */
  complete(record: InstallationRecord): Promise<void>

  getProgress(userId: string): Promise<InstallationProgressRecord | null>
  saveProgress(record: InstallationProgressRecord): Promise<void>

  /**
   * 암호화된 형태로만 주고받는다(functions/_lib/tokenCipher.ts) — 평문 API 키는 저장소
   * 계층을 통과하지 않는다. null은 "키 삭제"를 의미한다.
   */
  getGeminiApiKey(userId: string): Promise<EncryptedSecret | null>
  updateGeminiApiKey(userId: string, encrypted: EncryptedSecret | null): Promise<void>

  /**
   * spreadsheet_id가 아직 비어있을 때만 원자적으로 채워 넣는다("compare-and-swap").
   * 동시에 두 요청이 같은 사용자의 설치를 진행하다가 둘 다 새 Spreadsheet를
   * 만들었더라도, 이 메서드로 D1에 먼저 기록되는 쪽만 "정본"이 된다 — 진 쪽은
   * false를 돌려받아 자신이 방금 만든 Spreadsheet를 중복으로 판단하고 정리해야
   * 한다(functions/_lib/setupOrchestrator.ts 참고).
   */
  claimSpreadsheet(userId: string, spreadsheetId: string, updatedAt: number): Promise<boolean>
  /** claimSpreadsheet과 동일한 compare-and-swap — 학생식별정보 Spreadsheet 전용. */
  claimIdentitySpreadsheet(userId: string, spreadsheetId: string, updatedAt: number): Promise<boolean>
}
