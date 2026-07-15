export type SetupStepStatus = 'done' | 'pending' | 'error'

export interface SetupStep {
  key: string
  label: string
  status: SetupStepStatus
}

export type SetupStatusResponse =
  | { status: 'not_started' }
  | { status: 'already_installed' }
  | { status: 'needs_consent'; consentUrl: string; steps: SetupStep[] }
  | { status: 'in_progress'; steps: SetupStep[] }
  | { status: 'failed'; errorStep: string | null; errorMessage: string; steps: SetupStep[] }
  | {
      status: 'completed'
      schoolName: string
      managerName: string
      schoolPublicId: string
      spreadsheetUrl: string
      folderUrl: string
      steps: SetupStep[]
    }
