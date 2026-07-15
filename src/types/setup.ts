export type SetupStepStatus = 'done' | 'pending' | 'error'

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
      folderUrl: string
      steps: SetupStep[]
    }
