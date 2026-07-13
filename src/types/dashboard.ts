export interface TodaySession {
  time: string
  studentLabel: string
  topic: string
}

export interface IntakeRequest {
  studentLabel: string
  submittedAt: string
}

export interface PendingConsent {
  studentLabel: string
  sentAt: string
}

export interface TasteVillageStat {
  label: string
  value: string
}
