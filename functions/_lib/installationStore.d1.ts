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
  headers_written: number
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
    headersWritten: row.headers_written === 1,
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
                  root_folder_id, spreadsheet_id, installed_at, updated_at
           FROM installations WHERE user_id = ?1`,
        )
        .bind(userId)
        .first<InstallationRow>()
      return row ? toRecord(row) : null
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
             root_folder_id, spreadsheet_id, installed_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
           ON CONFLICT(user_id) DO UPDATE SET
             school_name = excluded.school_name,
             manager_name = excluded.manager_name,
             school_public_id = excluded.school_public_id,
             root_folder_id = excluded.root_folder_id,
             spreadsheet_id = excluded.spreadsheet_id,
             updated_at = excluded.updated_at`,
        )
        .bind(
          record.userId,
          record.schoolName,
          record.managerName,
          record.schoolPublicId,
          record.rootFolderId,
          record.spreadsheetId,
          record.installedAt,
          record.updatedAt,
        )
        .run()
    },

    async getProgress(userId) {
      const row = await db
        .prepare(
          `SELECT user_id, school_name, manager_name, school_public_id,
                  root_folder_id, folder_ids_json, spreadsheet_id, headers_written,
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
             root_folder_id, folder_ids_json, spreadsheet_id, headers_written,
             status, current_step, error_step, error_message, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
           ON CONFLICT(user_id) DO UPDATE SET
             school_name = excluded.school_name,
             manager_name = excluded.manager_name,
             school_public_id = excluded.school_public_id,
             root_folder_id = excluded.root_folder_id,
             folder_ids_json = excluded.folder_ids_json,
             spreadsheet_id = excluded.spreadsheet_id,
             headers_written = excluded.headers_written,
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
          record.headersWritten ? 1 : 0,
          record.status,
          record.currentStep,
          record.errorStep,
          record.errorMessage,
          record.createdAt,
          record.updatedAt,
        )
        .run()
    },
  }
}
