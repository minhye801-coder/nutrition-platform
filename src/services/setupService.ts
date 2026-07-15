import type { SetupStatusResponse } from '@/types/setup'

async function postSetup(path: string, body?: unknown): Promise<SetupStatusResponse> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw new Error('setup_request_failed')
  }
  return response.json()
}

export function startSetup(input: { schoolName: string; managerName: string }): Promise<SetupStatusResponse> {
  return postSetup('/api/setup/start', input)
}

export function retrySetup(): Promise<SetupStatusResponse> {
  return postSetup('/api/setup/retry')
}

export async function fetchSetupStatus(): Promise<SetupStatusResponse> {
  const response = await fetch('/api/setup/status', { credentials: 'include' })
  if (!response.ok) {
    throw new Error('setup_status_failed')
  }
  return response.json()
}
