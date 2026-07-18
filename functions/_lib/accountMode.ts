import type { Env } from './env'

/**
 * 계정 정책 단순화(2026-07-18 결정)에 따른 3가지 서버측 계정 모드.
 *
 * - SCHOOL_WORKSPACE: hosted domain이 있는 Google Workspace 계정이고, 최초 확인
 *   화면(현재 CONFIRMATION_VERSION 기준)을 통과했다.
 * - WORKSPACE_CONFIRMATION_REQUIRED: hosted domain은 있지만 아직 확인 화면을
 *   통과하지 않았거나, 안내문이 바뀐 뒤(confirmationVersion 불일치) 재확인이 필요하다.
 * - PERSONAL_ACCOUNT_BLOCKED: hosted domain이 없는 개인 Google 계정(gmail.com 등).
 *   학교용 기능을 절대 활성화할 수 없다.
 *
 * `DEMO_GUEST`(로그인하지 않은 체험 사용자)는 세션 자체가 없으므로 이 서버측
 * AccountMode에는 포함되지 않는다 — 프런트엔드에서만 쓰는 개념이다
 * (src/types/session.ts, src/lib/demoAck.ts).
 *
 * 이전에 있던 승인 도메인 목록 기반 판정(approved_school_domains, WORKSPACE_PENDING)은
 * 더 이상 계정 판정에 쓰지 않는다(요구사항 확정 — hosted domain만으로 업무용 계정
 * 후보를 인정하고, 대신 최초 확인 화면에서 사용자 스스로 소속 기관 규정을 확인하게
 * 한다). approved_school_domains 테이블 자체는 기존 데이터를 지우지 않고 그대로
 * 남겨 두되(요구사항 6절), 이 판정 로직은 더 이상 그 테이블을 읽지 않는다.
 */
export type AccountMode = 'SCHOOL_WORKSPACE' | 'PERSONAL_ACCOUNT_BLOCKED' | 'WORKSPACE_CONFIRMATION_REQUIRED'

/**
 * 최초 확인 화면(functions/api/account/confirm-school-use.ts)의 안내문 버전. 이
 * 값이 바뀌면 이미 확인을 마친 사용자도 다음 요청부터 다시 확인 화면을 보게 된다
 * (요구사항 5절 "confirmationVersion을 둬서 안내문이 크게 변경되면 다시 확인받을 수
 * 있게 한다"). 배포 환경에서 안내문을 바꾸지 않고 값만 올리고 싶다면
 * PRIVACY_CONFIRMATION_VERSION 환경변수로 덮어쓸 수 있다.
 */
export const DEFAULT_CONFIRMATION_VERSION = '2026-07-01'

export function getConfirmationVersion(env: Pick<Env, 'PRIVACY_CONFIRMATION_VERSION'>): string {
  return env.PRIVACY_CONFIRMATION_VERSION?.trim() || DEFAULT_CONFIRMATION_VERSION
}

export interface WorkspaceConfirmationState {
  /** 사용자가 확인 화면의 모든 필수 항목을 체크하고 활성화 버튼을 눌렀는지. */
  confirmed: boolean
  /** 확인 당시의 confirmationVersion. 현재 버전과 다르면 재확인이 필요하다. */
  confirmedVersion: string | null
}

/**
 * ID Token의 `hd` 클레임(hosted domain) 존재 여부만으로 개인/업무용 계정을 가른다 —
 * 이메일 도메인 문자열을 gmail.com인지 직접 비교하지 않는다(스푸핑 가능한 이메일
 * 문자열이 아니라 Google이 서명한 hd 클레임을 신뢰 근거로 삼는다). hd가 있으면 그
 * 자체로 업무용 계정 후보로 인정하고(별도 승인 도메인 목록 없음), 최초 확인을
 * 거쳤는지만 추가로 확인한다.
 */
export function computeAccountMode(
  hostedDomain: string | null | undefined,
  confirmation: WorkspaceConfirmationState,
  currentConfirmationVersion: string,
): AccountMode {
  if (!hostedDomain) {
    return 'PERSONAL_ACCOUNT_BLOCKED'
  }
  if (confirmation.confirmed && confirmation.confirmedVersion === currentConfirmationVersion) {
    return 'SCHOOL_WORKSPACE'
  }
  return 'WORKSPACE_CONFIRMATION_REQUIRED'
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
    .prepare(
      `SELECT hosted_domain, school_use_confirmed, confirmation_version FROM users WHERE id = ?1`,
    )
    .bind(userId)
    .first<{ hosted_domain: string | null; school_use_confirmed: number; confirmation_version: string | null }>()
  if (!row) return false
  const mode = computeAccountMode(
    row.hosted_domain,
    { confirmed: row.school_use_confirmed === 1, confirmedVersion: row.confirmation_version },
    getConfirmationVersion(env),
  )
  return mode === 'SCHOOL_WORKSPACE'
}
