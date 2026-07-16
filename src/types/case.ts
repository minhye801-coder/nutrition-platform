/** legacy CASE_STATUS_VALUES(counseling-manager/code.gs.txt:54-63)와 동일한 8단계, 동일한 순서. */
export const CASE_STATUS_VALUES = [
  '동의 대기',
  '진단 대기',
  '결과 확인',
  '상담 예정',
  '실천 중',
  '추적상담 예정',
  '종결 검토',
  '종결',
] as const

export interface CaseSearchItem {
  caseId: string
  studentUuid: string
  gradeClass: string
  studentName: string
  topic: string
  status: string
  sessionCount: number
  lastSessionDate: string
  nextDate: string
  latestGoal: string
}

export interface CaseSearchFilters {
  keyword?: string
  status?: string
}

export interface Case {
  caseId: string
  tenantId: string
  studentUuid: string
  intakeId: string
  schoolYear: string
  topic: string
  referralType: string
  status: string
  nextScheduledAt: string
  managerEmail: string
  driveFolderUrl: string
  openedAt: string
  closedAt: string
  note: string
  createdAt: string
  updatedAt: string
}

export interface CaseDetail {
  case: Case
  studentName: string
  gradeClass: string
  consentStatus: string
}
