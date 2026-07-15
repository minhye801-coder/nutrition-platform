import { getInstallationStore } from './stores'
import { randomPublicId } from './crypto'
import { hasDriveScope } from './googleOAuth'
import { ensureFreshAccessToken, ReauthRequiredError } from './googleAccessToken'
import { createFolder, fileExists, findFolderByName, moveFileToRootFolder } from './googleDrive'
import { batchWriteValues, createSpreadsheet, spreadsheetExists } from './googleSheets'
import { GoogleApiError } from './googleApiError'
import {
  buildInitialValueRanges,
  ROOT_FOLDER_NAME,
  SPREADSHEET_TITLE,
  SUBFOLDER_NAMES,
  TAB_TITLES,
} from './installTemplate'
import type { InstallationProgressRecord } from './installationStore'
import type { SessionRecord } from './sessionStore'
import type { Env } from './env'

const CONSENT_URL = '/api/auth/google?purpose=install'

export const SETUP_STEPS = [
  'auth_check',
  'root_folder',
  'subfolders',
  'spreadsheet',
  'headers',
  'save_metadata',
] as const

export type SetupStepKey = (typeof SETUP_STEPS)[number]

const SETUP_STEP_LABELS: Record<SetupStepKey, string> = {
  auth_check: 'Google 권한 확인',
  root_folder: '루트 폴더 생성',
  subfolders: '하위 폴더 생성',
  spreadsheet: 'Spreadsheet 생성',
  headers: '기본 시트 생성',
  save_metadata: '설치정보 저장',
}

const STEP_ERROR_MESSAGES: Partial<Record<SetupStepKey, string>> = {
  root_folder: 'Google Drive 루트 폴더를 만드는 중 문제가 발생했습니다.',
  subfolders: 'Google Drive 하위 폴더를 만드는 중 문제가 발생했습니다.',
  spreadsheet: 'Google Sheets를 만드는 중 문제가 발생했습니다.',
  headers: '기본 시트를 구성하는 중 문제가 발생했습니다.',
  save_metadata: '설치 정보를 저장하는 중 문제가 발생했습니다.',
}
const DEFAULT_ERROR_MESSAGE = '설치 중 문제가 발생했습니다.'

export interface SetupStepState {
  key: SetupStepKey
  label: string
  status: 'done' | 'pending' | 'error'
}

export type SetupResult =
  | { status: 'already_installed' }
  | {
      status: 'completed'
      schoolName: string
      managerName: string
      schoolPublicId: string
      spreadsheetUrl: string
      folderUrl: string
      steps: SetupStepState[]
    }
  | { status: 'needs_consent'; consentUrl: string; steps: SetupStepState[] }
  | {
      status: 'failed'
      errorStep: SetupStepKey | null
      errorMessage: string
      steps: SetupStepState[]
    }
  | { status: 'in_progress'; steps: SetupStepState[] }
  | { status: 'not_started' }

export class SetupInputError extends Error {
  constructor() {
    super('invalid_input')
    this.name = 'SetupInputError'
  }
}

function buildSteps(
  progress: InstallationProgressRecord,
  authDone: boolean,
  errorStep: SetupStepKey | null,
): SetupStepState[] {
  const done: Record<SetupStepKey, boolean> = {
    auth_check: authDone,
    root_folder: Boolean(progress.rootFolderId),
    subfolders: SUBFOLDER_NAMES.every((name) => Boolean(progress.folderIds[name])),
    spreadsheet: Boolean(progress.spreadsheetId),
    headers: progress.headersWritten,
    save_metadata: progress.status === 'completed',
  }
  return SETUP_STEPS.map((key) => ({
    key,
    label: SETUP_STEP_LABELS[key],
    status: errorStep === key ? 'error' : done[key] ? 'done' : 'pending',
  }))
}

function resolveErrorMessage(step: SetupStepKey | null): string {
  const base = (step && STEP_ERROR_MESSAGES[step]) || DEFAULT_ERROR_MESSAGE
  return `${base} 잠시 후 '다시 시도'를 눌러주세요.`
}

/** 저장된 ID가 여전히 유효하면 재사용하고, 없거나 무효하면 이름으로 찾거나 새로 만든다. */
async function ensureFolder(
  accessToken: string,
  name: string,
  parentId: string,
  existingId: string | null,
): Promise<string> {
  if (existingId && (await fileExists(accessToken, existingId))) {
    return existingId
  }
  const found = await findFolderByName(accessToken, name, parentId)
  if (found) return found
  return createFolder(accessToken, name, parentId)
}

/**
 * 최초 설치 흐름 전체를 실행(또는 재시도로 이어서 실행)한다. 이미 완료된 단계는
 * D1에 저장된 ID를 재검증만 하고 다시 만들지 않는다(요구사항 7절 "중복 생성 금지").
 * 실패 시에도 그때까지 만든 단계는 D1에 남아 다음 호출에서 이어받는다.
 */
export async function runSetup(
  env: Env,
  session: SessionRecord,
  input: { schoolName?: string; managerName?: string } | undefined,
): Promise<SetupResult> {
  const installationStore = getInstallationStore(env)

  const existing = await installationStore.get(session.googleSub)
  if (existing) {
    return { status: 'already_installed' }
  }

  let progress = await installationStore.getProgress(session.googleSub)
  if (!progress) {
    const schoolName = input?.schoolName?.trim()
    const managerName = input?.managerName?.trim()
    if (!schoolName || !managerName) {
      throw new SetupInputError()
    }
    const now = Date.now()
    progress = {
      userId: session.googleSub,
      schoolName,
      managerName,
      schoolPublicId: `SCH-${randomPublicId(6)}`,
      rootFolderId: null,
      folderIds: {},
      spreadsheetId: null,
      headersWritten: false,
      status: 'in_progress',
      currentStep: 'auth_check',
      errorStep: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    }
    await installationStore.saveProgress(progress)
  }

  if (!hasDriveScope(session.grantedScopes)) {
    return { status: 'needs_consent', consentUrl: CONSENT_URL, steps: buildSteps(progress, false, null) }
  }

  let accessToken: string
  try {
    accessToken = await ensureFreshAccessToken(env, session)
  } catch (error) {
    if (error instanceof ReauthRequiredError) {
      return { status: 'needs_consent', consentUrl: CONSENT_URL, steps: buildSteps(progress, false, null) }
    }
    throw error
  }

  try {
    progress.currentStep = 'root_folder'
    if (!progress.rootFolderId || !(await fileExists(accessToken, progress.rootFolderId))) {
      const found = await findFolderByName(accessToken, ROOT_FOLDER_NAME, 'root')
      progress.rootFolderId = found ?? (await createFolder(accessToken, ROOT_FOLDER_NAME, 'root'))
      await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    }
    const rootFolderId = progress.rootFolderId

    progress.currentStep = 'subfolders'
    for (const name of SUBFOLDER_NAMES) {
      const folderId = await ensureFolder(accessToken, name, rootFolderId, progress.folderIds[name] ?? null)
      if (progress.folderIds[name] !== folderId) {
        progress.folderIds = { ...progress.folderIds, [name]: folderId }
        await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
      }
    }

    progress.currentStep = 'spreadsheet'
    if (!progress.spreadsheetId || !(await spreadsheetExists(accessToken, progress.spreadsheetId))) {
      const spreadsheetId = await createSpreadsheet(accessToken, SPREADSHEET_TITLE, TAB_TITLES)
      await moveFileToRootFolder(accessToken, spreadsheetId, rootFolderId)
      progress.spreadsheetId = spreadsheetId
      progress.headersWritten = false
      await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    }
    const spreadsheetId = progress.spreadsheetId

    progress.currentStep = 'headers'
    if (!progress.headersWritten) {
      const ranges = buildInitialValueRanges({
        schoolName: progress.schoolName,
        managerName: progress.managerName,
        schoolPublicId: progress.schoolPublicId,
        createdAt: new Date().toISOString(),
      })
      await batchWriteValues(accessToken, spreadsheetId, ranges)
      progress.headersWritten = true
      await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    }

    progress.currentStep = 'save_metadata'
    const now = Date.now()
    await installationStore.complete({
      userId: session.googleSub,
      schoolName: progress.schoolName,
      managerName: progress.managerName,
      schoolPublicId: progress.schoolPublicId,
      rootFolderId,
      spreadsheetId,
      installedAt: now,
      updatedAt: now,
    })
    progress.status = 'completed'
    progress.errorStep = null
    progress.errorMessage = null
    await installationStore.saveProgress({ ...progress, updatedAt: now })

    return {
      status: 'completed',
      schoolName: progress.schoolName,
      managerName: progress.managerName,
      schoolPublicId: progress.schoolPublicId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      folderUrl: `https://drive.google.com/drive/folders/${rootFolderId}`,
      steps: buildSteps(progress, true, null),
    }
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 401) {
      return { status: 'needs_consent', consentUrl: CONSENT_URL, steps: buildSteps(progress, false, null) }
    }

    console.error('[setup] step failed', progress.currentStep, error)
    const errorStep = progress.currentStep as SetupStepKey
    const errorMessage = resolveErrorMessage(errorStep)
    progress.status = 'failed'
    progress.errorStep = errorStep
    progress.errorMessage = errorMessage
    await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })

    return { status: 'failed', errorStep, errorMessage, steps: buildSteps(progress, true, errorStep) }
  }
}

/**
 * GET /api/setup/status용 — Google API를 호출하지 않고 D1에 저장된 상태와 현재
 * 세션의 scope만으로 판단한다(Google API 호출 없음, 18.3절 호출 최소화 원칙).
 */
export async function readSetupStatus(env: Env, session: SessionRecord): Promise<SetupResult> {
  const installationStore = getInstallationStore(env)

  const existing = await installationStore.get(session.googleSub)
  if (existing) {
    return {
      status: 'completed',
      schoolName: existing.schoolName,
      managerName: existing.managerName,
      schoolPublicId: existing.schoolPublicId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${existing.spreadsheetId}/edit`,
      folderUrl: `https://drive.google.com/drive/folders/${existing.rootFolderId}`,
      steps: SETUP_STEPS.map((key) => ({ key, label: SETUP_STEP_LABELS[key], status: 'done' })),
    }
  }

  const progress = await installationStore.getProgress(session.googleSub)
  if (!progress) {
    return { status: 'not_started' }
  }

  const authDone = hasDriveScope(session.grantedScopes)

  if (progress.status === 'failed') {
    const errorStep = progress.errorStep as SetupStepKey | null
    return {
      status: 'failed',
      errorStep,
      errorMessage: progress.errorMessage ?? resolveErrorMessage(null),
      steps: buildSteps(progress, authDone, errorStep),
    }
  }

  if (!authDone) {
    return { status: 'needs_consent', consentUrl: CONSENT_URL, steps: buildSteps(progress, false, null) }
  }

  return { status: 'in_progress', steps: buildSteps(progress, true, null) }
}
