import type { InstallationLookup } from './installationStore'

/** installations 테이블에 user_id(=Google sub) 행이 있는지만 확인하는 운영용 D1 구현. */
export function createD1InstallationLookup(db: D1Database): InstallationLookup {
  return {
    async hasInstallation(googleSub) {
      const row = await db
        .prepare('SELECT 1 FROM installations WHERE user_id = ?1')
        .bind(googleSub)
        .first()
      return row !== null
    },
  }
}
