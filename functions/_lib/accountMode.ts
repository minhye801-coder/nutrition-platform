import type { Env } from './env'

/**
 * SCHOOL_WORKSPACE = 승인된 학교/교육청 Workspace 도메인 계정(전체 기능).
 * PERSONAL_DEMO = 개인 Gmail 등 hosted domain이 없는 계정(체험 모드만).
 * WORKSPACE_PENDING = Workspace 계정이지만 도메인이 아직 승인 목록에 없음(체험 모드로
 * 대체 제공, 승인되면 다음 로그인 때 자동으로 SCHOOL_WORKSPACE로 올라간다).
 */
export type AccountMode = 'SCHOOL_WORKSPACE' | 'PERSONAL_DEMO' | 'WORKSPACE_PENDING'

export type DomainApprovalStatus = 'not_applicable' | 'pending' | 'approved' | 'rejected'

export interface AccountModeResolution {
  accountMode: AccountMode
  domainApprovalStatus: DomainApprovalStatus
}

/** 환경변수로도 승인 도메인을 보완할 수 있게 한다(관리자 UI가 없는 이번 범위의 편의 수단). */
function envApprovedDomains(env: Env): string[] {
  const raw = env.APPROVED_SCHOOL_DOMAINS
  if (!raw) return []
  return raw
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
}

async function isDomainApproved(env: Env, domain: string): Promise<boolean> {
  const normalized = domain.toLowerCase()
  if (envApprovedDomains(env).includes(normalized)) return true
  if (!env.AUTH_DB) return false
  const row = await env.AUTH_DB
    .prepare(`SELECT domain FROM approved_school_domains WHERE domain = ?1`)
    .bind(normalized)
    .first<{ domain: string }>()
  return Boolean(row)
}

/**
 * 로그인 세션 없이 userId(Google sub)만으로 그 계정이 지금도 SCHOOL_WORKSPACE인지
 * 확인한다. 공개 상담신청/보호자동의 페이지(functions/_lib/publicSpreadsheetAccess.ts)가
 * "이론상으로도 비학교 계정 소유 설치가 공개 페이지를 서빙하지 못하게" 만드는 2차
 * 방어선이다 — 1차 방어는 애초에 비학교 계정이 /setup으로 설치 자체를 만들 수 없게
 * 막는 것(functions/api/setup/start.ts)이다. D1 바인딩이 없는 로컬 메모리 개발
 * 환경에서는 판정할 방법이 없으므로 통과시킨다(로컬 전용 완화, 운영은 항상 D1 사용).
 */
export async function isAccountStillSchoolWorkspace(env: Env, userId: string): Promise<boolean> {
  if (!env.AUTH_DB) return true
  const row = await env.AUTH_DB
    .prepare(`SELECT account_mode, school_use_confirmed FROM users WHERE id = ?1`)
    .bind(userId)
    .first<{ account_mode: string; school_use_confirmed: number }>()
  if (!row) return false
  return row.account_mode === 'SCHOOL_WORKSPACE' && row.school_use_confirmed === 1
}

/**
 * ID Token의 `hd` 클레임(hosted domain)만으로 판정한다 — 이메일 도메인 문자열을
 * gmail.com인지 직접 비교하는 방식은 쓰지 않는다(스푸핑 가능한 이메일 문자열이 아니라
 * Google이 서명한 hd 클레임을 신뢰 근거로 삼는다, 요구사항 1절).
 */
export async function resolveAccountMode(
  env: Env,
  hostedDomain: string | undefined,
): Promise<AccountModeResolution> {
  if (!hostedDomain) {
    return { accountMode: 'PERSONAL_DEMO', domainApprovalStatus: 'not_applicable' }
  }
  const approved = await isDomainApproved(env, hostedDomain)
  if (approved) {
    return { accountMode: 'SCHOOL_WORKSPACE', domainApprovalStatus: 'approved' }
  }
  return { accountMode: 'WORKSPACE_PENDING', domainApprovalStatus: 'pending' }
}
