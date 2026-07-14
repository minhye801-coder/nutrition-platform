import type { InstallationRecord, InstallationStore } from './installationStore'

/**
 * 임시 개발용 구현. Cloudflare Pages Functions의 단일 isolate 메모리에만 저장되므로,
 * 실제 배포 환경(분산 엣지)에서는 요청이 다른 isolate로 라우팅되면 값이 유실될 수 있다.
 * D1 연동 전까지 로컬 개발과 단일 흐름 확인 용도로만 사용한다.
 */
const installations = new Map<string, InstallationRecord>()

export const memoryInstallationStore: InstallationStore = {
  async get(userId) {
    return installations.get(userId) ?? null
  },
  async create(record) {
    installations.set(record.userId, record)
  },
  async updateManagerName(userId, managerName) {
    const existing = installations.get(userId)
    if (!existing) return
    installations.set(userId, { ...existing, managerName, updatedAt: Date.now() })
  },
}
