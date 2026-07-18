import { getInstallationStore, getSessionStore } from './stores'
import { randomPublicId } from './crypto'
import { fetchGrantedScopes, hasDriveScope } from './googleOAuth'
import { ensureFreshAccessToken, ReauthRequiredError } from './googleAccessToken'
import {
  createFolder,
  fileExists,
  findFolderByName,
  moveFileToRootFolder,
  trashFile,
} from './googleDrive'
import { batchWriteValues, createSpreadsheet, spreadsheetExists } from './googleSheets'
import { GoogleApiError } from './googleApiError'
import {
  buildDataValueRanges,
  buildIdentityValueRanges,
  DATA_SPREADSHEET_TITLE,
  DATA_TAB_TITLES,
  IDENTITY_SPREADSHEET_TITLE,
  IDENTITY_TAB_TITLES,
  ROOT_FOLDER_NAME,
  SUBFOLDER_NAMES,
} from './installTemplate'
import type { InstallationProgressRecord } from './installationStore'
import type { SessionRecord } from './sessionStore'
import type { Env } from './env'

const CONSENT_URL = '/api/auth/google?purpose=install'

export const SETUP_STEPS = [
  'auth_check',
  'root_folder',
  'subfolders',
  'identity_spreadsheet',
  'identity_headers',
  'spreadsheet',
  'headers',
  'save_metadata',
] as const

export type SetupStepKey = (typeof SETUP_STEPS)[number]

const SETUP_STEP_LABELS: Record<SetupStepKey, string> = {
  auth_check: 'Google 권한 확인',
  root_folder: '루트 폴더 생성',
  subfolders: '하위 폴더 생성',
  identity_spreadsheet: '학생식별정보 Spreadsheet 생성',
  identity_headers: '학생식별정보 기본 시트 생성',
  spreadsheet: '상담데이터 Spreadsheet 생성',
  headers: '상담데이터 기본 시트 생성',
  save_metadata: '설치정보 저장',
}

const STEP_ERROR_MESSAGES: Partial<Record<SetupStepKey, string>> = {
  root_folder: 'Google Drive 루트 폴더를 만드는 중 문제가 발생했습니다.',
  subfolders: 'Google Drive 하위 폴더를 만드는 중 문제가 발생했습니다.',
  identity_spreadsheet: '학생식별정보 Google Sheets를 만드는 중 문제가 발생했습니다.',
  identity_headers: '학생식별정보 기본 시트를 구성하는 중 문제가 발생했습니다.',
  spreadsheet: '상담데이터 Google Sheets를 만드는 중 문제가 발생했습니다.',
  headers: '상담데이터 기본 시트를 구성하는 중 문제가 발생했습니다.',
  save_metadata: '설치 정보를 저장하는 중 문제가 발생했습니다.',
}
const DEFAULT_ERROR_MESSAGE = '설치 중 문제가 발생했습니다.'

export interface SetupStepState {
  key: SetupStepKey
  label: string
  /** active = 지금 이 순간 진행 중인 단계(폴링 시 노란색으로 표시). */
  status: 'done' | 'active' | 'pending' | 'error'
}

export type SetupResult =
  | { status: 'already_installed' }
  | {
      status: 'completed'
      schoolName: string
      managerName: string
      schoolPublicId: string
      spreadsheetUrl: string
      identitySpreadsheetUrl: string
      folderUrl: string
      steps: SetupStepState[]
    }
  | {
      status: 'needs_consent'
      schoolName: string
      managerName: string
      consentUrl: string
      steps: SetupStepState[]
    }
  | {
      status: 'failed'
      schoolName: string
      managerName: string
      errorStep: SetupStepKey | null
      errorMessage: string
      steps: SetupStepState[]
    }
  | {
      status: 'in_progress'
      schoolName: string
      managerName: string
      steps: SetupStepState[]
    }
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
    identity_spreadsheet: Boolean(progress.identitySpreadsheetId),
    identity_headers: progress.identityHeadersWritten,
    spreadsheet: Boolean(progress.spreadsheetId),
    headers: progress.headersWritten,
    save_metadata: progress.status === 'completed',
  }
  return SETUP_STEPS.map((key) => {
    let status: SetupStepState['status']
    if (errorStep === key) status = 'error'
    else if (done[key]) status = 'done'
    else if (progress.currentStep === key) status = 'active'
    else status = 'pending'
    return { key, label: SETUP_STEP_LABELS[key], status }
  })
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
      identitySpreadsheetId: null,
      headersWritten: false,
      identityHeadersWritten: false,
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
    return {
      status: 'needs_consent',
      schoolName: progress.schoolName,
      managerName: progress.managerName,
      consentUrl: CONSENT_URL,
      steps: buildSteps(progress, false, null),
    }
  }

  let accessToken: string
  try {
    accessToken = await ensureFreshAccessToken(env, session)
  } catch (error) {
    if (error instanceof ReauthRequiredError) {
      return {
        status: 'needs_consent',
        schoolName: progress.schoolName,
        managerName: progress.managerName,
        consentUrl: CONSENT_URL,
        steps: buildSteps(progress, false, null),
      }
    }
    throw error
  }

  // D1에 저장된 grantedScopes는 로그인/토큰 갱신 시점의 스냅샷일 뿐이다. 예를 들어
  // 설치 동의 이후 사용자가 별도로 다시 로그인하면 그 교환에서 refresh token이
  // 오지 않을 수 있고, 그 경우 저장된 값이 실제 토큰 권한과 어긋날 수 있다.
  // 그래서 Drive/Sheets를 호출하기 전에 이 access token이 실제로 어떤 scope를
  // 갖고 있는지 Google에 직접 확인하고, 캐시가 낡았으면 여기서 바로잡는다.
  let verifiedScopes: string
  try {
    verifiedScopes = await fetchGrantedScopes(accessToken)
  } catch {
    return {
      status: 'needs_consent',
      schoolName: progress.schoolName,
      managerName: progress.managerName,
      consentUrl: CONSENT_URL,
      steps: buildSteps(progress, false, null),
    }
  }

  if (verifiedScopes !== session.grantedScopes) {
    await getSessionStore(env).updateAccessToken(session.googleSub, {
      accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      grantedScopes: verifiedScopes,
    })
    session.grantedScopes = verifiedScopes
  }

  if (!hasDriveScope(verifiedScopes)) {
    return {
      status: 'needs_consent',
      schoolName: progress.schoolName,
      managerName: progress.managerName,
      consentUrl: CONSENT_URL,
      steps: buildSteps(progress, false, null),
    }
  }

  try {
    progress.currentStep = 'root_folder'
    // 실제 작업을 시작하기 전에 currentStep 전환을 먼저 D1에 남긴다 — 이 요청이
    // 아직 실행 중인 동안 GET /api/setup/status로 폴링하는 클라이언트가 "지금
    // 진행 중인 단계"(active, 노란색)를 실시간에 가깝게 볼 수 있게 하기 위함이다.
    await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    if (
      !progress.rootFolderId ||
      !(await fileExists(accessToken, progress.rootFolderId))
    ) {
      const found = await findFolderByName(accessToken, ROOT_FOLDER_NAME, 'root')
      progress.rootFolderId =
        found ?? (await createFolder(accessToken, ROOT_FOLDER_NAME, 'root'))
      await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    }
    const rootFolderId = progress.rootFolderId

    progress.currentStep = 'subfolders'
    await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    for (const name of SUBFOLDER_NAMES) {
      const folderId = await ensureFolder(
        accessToken,
        name,
        rootFolderId,
        progress.folderIds[name] ?? null,
      )
      if (progress.folderIds[name] !== folderId) {
        progress.folderIds = { ...progress.folderIds, [name]: folderId }
        await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
      }
    }

    progress.currentStep = 'identity_spreadsheet'
    await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    if (
      !progress.identitySpreadsheetId ||
      !(await spreadsheetExists(accessToken, progress.identitySpreadsheetId))
    ) {
      const latestIdentity = await installationStore.getProgress(session.googleSub)
      if (latestIdentity?.identitySpreadsheetId) {
        progress.identitySpreadsheetId = latestIdentity.identitySpreadsheetId
        progress.identityHeadersWritten = latestIdentity.identityHeadersWritten
      } else {
        const newIdentitySpreadsheetId = await createSpreadsheet(
          accessToken,
          IDENTITY_SPREADSHEET_TITLE,
          IDENTITY_TAB_TITLES,
        )
        const claimedIdentity = await installationStore.claimIdentitySpreadsheet(
          session.googleSub,
          newIdentitySpreadsheetId,
          Date.now(),
        )
        if (claimedIdentity) {
          await moveFileToRootFolder(accessToken, newIdentitySpreadsheetId, rootFolderId)
          progress.identitySpreadsheetId = newIdentitySpreadsheetId
          progress.identityHeadersWritten = false
          await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
        } else {
          console.log('[setup] duplicate identity spreadsheet detected, trashing', {
            userId: session.googleSub,
            spreadsheetId: newIdentitySpreadsheetId,
          })
          await trashFile(accessToken, newIdentitySpreadsheetId).catch((trashError) =>
            console.error('[setup] failed to trash duplicate identity spreadsheet', trashError),
          )
          const winnerIdentity = await installationStore.getProgress(session.googleSub)
          progress.identitySpreadsheetId = winnerIdentity?.identitySpreadsheetId ?? null
          progress.identityHeadersWritten = winnerIdentity?.identityHeadersWritten ?? false
        }
      }
    }
    if (!progress.identitySpreadsheetId) {
      throw new Error('identity_spreadsheet_claim_failed')
    }
    const identitySpreadsheetId = progress.identitySpreadsheetId

    progress.currentStep = 'identity_headers'
    await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    if (!progress.identityHeadersWritten) {
      await batchWriteValues(accessToken, identitySpreadsheetId, buildIdentityValueRanges())
      progress.identityHeadersWritten = true
      await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    }

    progress.currentStep = 'spreadsheet'
    await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    if (
      !progress.spreadsheetId ||
      !(await spreadsheetExists(accessToken, progress.spreadsheetId))
    ) {
      // 이 요청이 spreadsheetId를 비어있다고 판단한 뒤에도, 동시에 실행 중인 다른
      // 요청(중복 클릭, 재시도 경합 등)이 이미 Spreadsheet를 만들어 D1에 기록했을
      // 수 있다. Google API를 또 부르기 전에 최신 상태를 한 번 더 읽어 확인한다.
      const latest = await installationStore.getProgress(session.googleSub)
      if (latest?.spreadsheetId) {
        progress.spreadsheetId = latest.spreadsheetId
        progress.headersWritten = latest.headersWritten
      } else {
        console.log('[setup] createSpreadsheet called', { userId: session.googleSub })
        const newSpreadsheetId = await createSpreadsheet(
          accessToken,
          DATA_SPREADSHEET_TITLE,
          DATA_TAB_TITLES,
        )
        console.log('[setup] createSpreadsheet result', {
          userId: session.googleSub,
          spreadsheetId: newSpreadsheetId,
        })

        // spreadsheet_id가 여전히 비어있을 때만 원자적으로 채워 넣는다(compare-and-swap).
        // 두 요청이 동시에 여기까지 왔다면 둘 다 새 Spreadsheet를 만들었을 수 있지만,
        // D1에 먼저 기록되는 쪽만 정본이 된다.
        const claimed = await installationStore.claimSpreadsheet(
          session.googleSub,
          newSpreadsheetId,
          Date.now(),
        )
        if (claimed) {
          await moveFileToRootFolder(accessToken, newSpreadsheetId, rootFolderId)
          progress.spreadsheetId = newSpreadsheetId
          progress.headersWritten = false
          await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
        } else {
          // 경쟁에서 졌다 — 다른 요청이 이미 정본 Spreadsheet를 등록했으므로 방금
          // 만든 것은 중복이다. 휴지통으로 보내고(영구 삭제 아님) 정본 ID를 채택한다.
          console.log('[setup] duplicate spreadsheet detected, trashing', {
            userId: session.googleSub,
            spreadsheetId: newSpreadsheetId,
          })
          await trashFile(accessToken, newSpreadsheetId).catch((trashError) =>
            console.error('[setup] failed to trash duplicate spreadsheet', trashError),
          )
          const winner = await installationStore.getProgress(session.googleSub)
          progress.spreadsheetId = winner?.spreadsheetId ?? null
          progress.headersWritten = winner?.headersWritten ?? false
        }
      }
    }
    if (!progress.spreadsheetId) {
      throw new Error('spreadsheet_claim_failed')
    }
    const spreadsheetId = progress.spreadsheetId

    progress.currentStep = 'headers'
    await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    if (!progress.headersWritten) {
      const ranges = buildDataValueRanges({
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
    await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })
    const now = Date.now()
    await installationStore.complete({
      userId: session.googleSub,
      schoolName: progress.schoolName,
      managerName: progress.managerName,
      schoolPublicId: progress.schoolPublicId,
      rootFolderId,
      spreadsheetId,
      identitySpreadsheetId,
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
      identitySpreadsheetUrl: `https://docs.google.com/spreadsheets/d/${identitySpreadsheetId}/edit`,
      folderUrl: `https://drive.google.com/drive/folders/${rootFolderId}`,
      steps: buildSteps(progress, true, null),
    }
  } catch (error) {
    // 401(토큰 무효)뿐 아니라 403(스코프 부족 — Google Drive/Sheets는 권한이 부족한
    // 요청에 401이 아니라 403 PERMISSION_DENIED를 반환한다)도 재동의로 되돌린다.
    // 여기서 놓치면 사용자에게는 동의 화면 없이 알 수 없는 실패로만 보인다.
    if (
      error instanceof GoogleApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return {
        status: 'needs_consent',
        schoolName: progress.schoolName,
        managerName: progress.managerName,
        consentUrl: CONSENT_URL,
        steps: buildSteps(progress, false, null),
      }
    }

    console.error('[setup] step failed', progress.currentStep, error)
    const errorStep = progress.currentStep as SetupStepKey
    const errorMessage = resolveErrorMessage(errorStep)
    progress.status = 'failed'
    progress.errorStep = errorStep
    progress.errorMessage = errorMessage
    await installationStore.saveProgress({ ...progress, updatedAt: Date.now() })

    return {
      status: 'failed',
      schoolName: progress.schoolName,
      managerName: progress.managerName,
      errorStep,
      errorMessage,
      steps: buildSteps(progress, true, errorStep),
    }
  }
}

/**
 * GET /api/setup/status용 — Google API를 호출하지 않고 D1에 저장된 상태와 현재
 * 세션의 scope만으로 판단한다(Google API 호출 없음, 18.3절 호출 최소화 원칙).
 */
export async function readSetupStatus(
  env: Env,
  session: SessionRecord,
): Promise<SetupResult> {
  const installationStore = getInstallationStore(env)

  const existing = await installationStore.get(session.googleSub)
  if (existing) {
    return {
      status: 'completed',
      schoolName: existing.schoolName,
      managerName: existing.managerName,
      schoolPublicId: existing.schoolPublicId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${existing.spreadsheetId}/edit`,
      // 아직 Phase 8 마이그레이션을 하지 않은 기존 설치는 identitySpreadsheetId가 없다 —
      // 그 경우 같은(단일) Spreadsheet URL을 잠정적으로 보여준다(하위호환).
      identitySpreadsheetUrl: `https://docs.google.com/spreadsheets/d/${existing.identitySpreadsheetId ?? existing.spreadsheetId}/edit`,
      folderUrl: `https://drive.google.com/drive/folders/${existing.rootFolderId}`,
      steps: SETUP_STEPS.map((key) => ({
        key,
        label: SETUP_STEP_LABELS[key],
        status: 'done',
      })),
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
      schoolName: progress.schoolName,
      managerName: progress.managerName,
      errorStep,
      errorMessage: progress.errorMessage ?? resolveErrorMessage(null),
      steps: buildSteps(progress, authDone, errorStep),
    }
  }

  if (!authDone) {
    return {
      status: 'needs_consent',
      schoolName: progress.schoolName,
      managerName: progress.managerName,
      consentUrl: CONSENT_URL,
      steps: buildSteps(progress, false, null),
    }
  }

  return {
    status: 'in_progress',
    schoolName: progress.schoolName,
    managerName: progress.managerName,
    steps: buildSteps(progress, true, null),
  }
}
