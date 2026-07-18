import type {
  InstallationProgressRecord,
  InstallationRecord,
  InstallationStore,
} from './installationStore'

interface InstallationRow {
  user_id: string
  school_name: string
  manager_name: string
  school_public_id: string
  root_folder_id: string | null
  spreadsheet_id: string | null
  identity_spreadsheet_id: string | null
  installed_at: number
  updated_at: number
}

function toRecord(row: InstallationRow): InstallationRecord {
  return {
    userId: row.user_id,
    schoolName: row.school_name,
    managerName: row.manager_name,
    schoolPublicId: row.school_public_id,
    rootFolderId: row.root_folder_id,
    spreadsheetId: row.spreadsheet_id,
    identitySpreadsheetId: row.identity_spreadsheet_id,
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
  }
}

interface ProgressRow {
  user_id: string
  school_name: string
  manager_name: string
  school_public_id: string
  root_folder_id: string | null
  folder_ids_json: string
  spreadsheet_id: string | null
  identity_spreadsheet_id: string | null
  headers_written: number
  identity_headers_written: number
  status: InstallationProgressRecord['status']
  current_step: string | null
  error_step: string | null
  error_message: string | null
  created_at: number
  updated_at: number
}

function toProgressRecord(row: ProgressRow): InstallationProgressRecord {
  let folderIds: Record<string, string> = {}
  try {
    folderIds = JSON.parse(row.folder_ids_json) as Record<string, string>
  } catch {
    folderIds = {}
  }
  return {
    userId: row.user_id,
    schoolName: row.school_name,
    managerName: row.manager_name,
    schoolPublicId: row.school_public_id,
    rootFolderId: row.root_folder_id,
    folderIds,
    spreadsheetId: row.spreadsheet_id,
    identitySpreadsheetId: row.identity_spreadsheet_id,
    headersWritten: row.headers_written === 1,
    identityHeadersWritten: row.identity_headers_written === 1,
    status: row.status,
    currentStep: row.current_step,
    errorStep: row.error_step,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 운영용 D1 기반 설치 저장소. `installations` = 완료된 설치, `installation_progress` = 진행 중 체크포인트. */
export function createD1InstallationStore(db: D1Database): InstallationStore {
  return {
    async get(userId) {
      const row = await db
        .prepare(
          `SELECT user_id, school_name, manager_name, school_public_id,
                  root_folder_id, spreadsheet_id, identity_spreadsheet_id, installed_at, updated_at
           FROM installations WHERE user_id = ?1`,
        )
        .bind(userId)
        .first<InstallationRow>()
      return row ? toRecord(row) : null
    },

    async getBySchoolPublicId(schoolPublicId) {
      const { results } = await db
        .prepare(
          `SELECT user_id, school_name, manager_name, school_public_id,
                  root_folder_id, spreadsheet_id, identity_spreadsheet_id, installed_at, updated_at
           FROM installations WHERE school_public_id = ?1 LIMIT 2`,
        )
        .bind(schoolPublicId)
        .all<InstallationRow>()
      if (results.length !== 1) {
        // 0건이면 존재하지 않는 것과 동일하게 처리하고, 2건 이상(중복, idx_installations_school_public_id에는
        // 유니크 제약이 없다)이면 어느 쪽으로 연결할지 판단할 근거가 없으므로 안전하게 찾지 못한 것으로 처리한다
        // (docs/public-intake-auth-design.md 3.1절 — 실패를 열어두기보다 닫아두는 쪽을 택함).
        if (results.length > 1) {
          console.error(`[installationStore] duplicate schoolPublicId`, results.length)
        }
        return null
      }
      return toRecord(results[0])
    },

    async updateManagerName(userId, managerName) {
      await db
        .prepare(`UPDATE installations SET manager_name = ?2, updated_at = ?3 WHERE user_id = ?1`)
        .bind(userId, managerName, Date.now())
        .run()
    },

    async complete(record) {
      await db
        .prepare(
          `INSERT INTO installations (
             user_id, school_name, manager_name, school_public_id,
             root_folder_id, spreadsheet_id, identity_spreadsheet_id, installed_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
           ON CONFLICT(user_id) DO UPDATE SET
             school_name = excluded.school_name,
             manager_name = excluded.manager_name,
             school_public_id = excluded.school_public_id,
             root_folder_id = excluded.root_folder_id,
             spreadsheet_id = excluded.spreadsheet_id,
             identity_spreadsheet_id = excluded.identity_spreadsheet_id,
             updated_at = excluded.updated_at`,
        )
        .bind(
          record.userId,
          record.schoolName,
          record.managerName,
          record.schoolPublicId,
          record.rootFolderId,
          record.spreadsheetId,
          record.identitySpreadsheetId,
          record.installedAt,
          record.updatedAt,
        )
        .run()
    },

    async setIdentitySpreadsheetId(userId, identitySpreadsheetId) {
      await db
        .prepare(`UPDATE installations SET identity_spreadsheet_id = ?2, updated_at = ?3 WHERE user_id = ?1`)
        .bind(userId, identitySpreadsheetId, Date.now())
        .run()
    },

    async getProgress(userId) {
      const row = await db
        .prepare(
          `SELECT user_id, school_name, manager_name, school_public_id,
                  root_folder_id, folder_ids_json, spreadsheet_id, identity_spreadsheet_id,
                  headers_written, identity_headers_written,
                  status, current_step, error_step, error_message, created_at, updated_at
           FROM installation_progress WHERE user_id = ?1`,
        )
        .bind(userId)
        .first<ProgressRow>()
      return row ? toProgressRecord(row) : null
    },

    async saveProgress(record) {
      await db
        .prepare(
          `INSERT INTO installation_progress (
             user_id, school_name, manager_name, school_public_id,
             root_folder_id, folder_ids_json, spreadsheet_id, identity_spreadsheet_id,
             headers_written, identity_headers_written,
             status, current_step, error_step, error_message, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
           ON CONFLICT(user_id) DO UPDATE SET
             school_name = excluded.school_name,
             manager_name = excluded.manager_name,
             school_public_id = excluded.school_public_id,
             root_folder_id = excluded.root_folder_id,
             folder_ids_json = excluded.folder_ids_json,
             spreadsheet_id = excluded.spreadsheet_id,
             identity_spreadsheet_id = excluded.identity_spreadsheet_id,
             headers_written = excluded.headers_written,
             identity_headers_written = excluded.identity_headers_written,
             status = excluded.status,
             current_step = excluded.current_step,
             error_step = excluded.error_step,
             error_message = excluded.error_message,
             updated_at = excluded.updated_at`,
        )
        .bind(
          record.userId,
          record.schoolName,
          record.managerName,
          record.schoolPublicId,
          record.rootFolderId,
          JSON.stringify(record.folderIds),
          record.spreadsheetId,
          record.identitySpreadsheetId,
          record.headersWritten ? 1 : 0,
          record.identityHeadersWritten ? 1 : 0,
          record.status,
          record.currentStep,
          record.errorStep,
          record.errorMessage,
          record.createdAt,
          record.updatedAt,
        )
        .run()
    },

    async getGeminiApiKey(userId) {
      const row = await db
        .prepare(`SELECT gemini_api_key_ciphertext, gemini_api_key_iv FROM installations WHERE user_id = ?1`)
        .bind(userId)
        .first<{ gemini_api_key_ciphertext: string | null; gemini_api_key_iv: string | null }>()
      if (!row || !row.gemini_api_key_ciphertext || !row.gemini_api_key_iv) return null
      return { ciphertext: row.gemini_api_key_ciphertext, iv: row.gemini_api_key_iv }
    },

    async updateGeminiApiKey(userId, encrypted) {
      await db
        .prepare(
          `UPDATE installations
           SET gemini_api_key_ciphertext = ?2, gemini_api_key_iv = ?3, updated_at = ?4
           WHERE user_id = ?1`,
        )
        .bind(userId, encrypted?.ciphertext ?? null, encrypted?.iv ?? null, Date.now())
        .run()
    },

    async claimSpreadsheet(userId, spreadsheetId, updatedAt) {
      // WHERE spreadsheet_id IS NULL이 이 UPDATE 전체를 원자적인 compare-and-swap으로
      // 만든다 — SQLite는 단일 UPDATE 문을 원자적으로 처리하므로, 동시에 두 요청이
      // 같은 조건으로 실행돼도 먼저 커밋되는 쪽만 실제로 행을 바꾸고(changes=1),
      // 나중 요청은 이미 채워진 걸 보고 0행을 바꾼다(changes=0).
      const result = await db
        .prepare(
          `UPDATE installation_progress
           SET spreadsheet_id = ?2, headers_written = 0, updated_at = ?3
           WHERE user_id = ?1 AND spreadsheet_id IS NULL`,
        )
        .bind(userId, spreadsheetId, updatedAt)
        .run()
      return result.meta.changes > 0
    },

    async claimIdentitySpreadsheet(userId, spreadsheetId, updatedAt) {
      const result = await db
        .prepare(
          `UPDATE installation_progress
           SET identity_spreadsheet_id = ?2, identity_headers_written = 0, updated_at = ?3
           WHERE user_id = ?1 AND identity_spreadsheet_id IS NULL`,
        )
        .bind(userId, spreadsheetId, updatedAt)
        .run()
      return result.meta.changes > 0
    },
  }
}
