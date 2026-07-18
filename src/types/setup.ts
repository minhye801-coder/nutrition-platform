/** active = 지금 이 순간 진행 중인 단계. */
export type SetupStepStatus = 'done' | 'active' | 'pending' | 'error'

export interface SetupStep {
  key: string
  label: string
  status: SetupStepStatus
}

export type SetupStatusResponse =
  | { status: 'not_started' }
  | { status: 'already_installed' }
  | {
      status: 'needs_consent'
      schoolName: string
      managerName: string
      consentUrl: string
      steps: SetupStep[]
    }
  | { status: 'in_progress'; schoolName: string; managerName: string; steps: SetupStep[] }
  | {
      status: 'failed'
      schoolName: string
      managerName: string
      errorStep: string | null
      errorMessage: string
      steps: SetupStep[]
    }
  | {
      status: 'completed'
      schoolName: string
      managerName: string
      schoolPublicId: string
      spreadsheetUrl: string
      identitySpreadsheetUrl: string
      folderUrl: string
      steps: SetupStep[]
    }
