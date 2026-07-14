import type { InstallationRecord, InstallationStore } from './installationStore'

interface InstallationRow {
  user_id: string
  school_name: string
  manager_name: string
  school_public_id: string
  installed_at: number
  updated_at: number
}

function toRecord(row: InstallationRow): InstallationRecord {
  return {
    userId: row.user_id,
    schoolName: row.school_name,
    managerName: row.manager_name,
    schoolPublicId: row.school_public_id,
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
  }
}

/** 운영용 D1 기반 설치 저장소. `installations` 테이블 한 행 = 로그인 계정 하나의 설치. */
export function createD1InstallationStore(db: D1Database): InstallationStore {
  return {
    async get(userId) {
      const row = await db
        .prepare(
          `SELECT user_id, school_name, manager_name, school_public_id, installed_at, updated_at
           FROM installations WHERE user_id = ?1`,
        )
        .bind(userId)
        .first<InstallationRow>()
      return row ? toRecord(row) : null
    },

    async create(record) {
      await db
        .prepare(
          `INSERT INTO installations (
             user_id, school_name, manager_name, school_public_id, installed_at, updated_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
        )
        .bind(
          record.userId,
          record.schoolName,
          record.managerName,
          record.schoolPublicId,
          record.installedAt,
        )
        .run()
    },

    async updateManagerName(userId, managerName) {
      await db
        .prepare(`UPDATE installations SET manager_name = ?2, updated_at = ?3 WHERE user_id = ?1`)
        .bind(userId, managerName, Date.now())
        .run()
    },
  }
}
