import { describe, expect, it } from 'vitest'
import { computeAccountMode, DEFAULT_CONFIRMATION_VERSION, getConfirmationVersion } from '../functions/_lib/accountMode'

const CURRENT = DEFAULT_CONFIRMATION_VERSION

describe('computeAccountMode', () => {
  it('blocks accounts with no hosted domain (gmail.com and any other personal account)', () => {
    // 요구사항 9절 테스트 3: gmail.com 계정은 PERSONAL_ACCOUNT_BLOCKED.
    // hd 클레임이 없으면 이메일 문자열과 무관하게 항상 차단된다.
    expect(computeAccountMode(undefined, { confirmed: false, confirmedVersion: null }, CURRENT)).toBe(
      'PERSONAL_ACCOUNT_BLOCKED',
    )
    expect(computeAccountMode(null, { confirmed: true, confirmedVersion: CURRENT }, CURRENT)).toBe(
      'PERSONAL_ACCOUNT_BLOCKED',
    )
  })

  it('requires confirmation for a hosted-domain account that has never confirmed', () => {
    // 요구사항 9절 테스트 5: hosted domain이 있으면 확인 화면(WORKSPACE_CONFIRMATION_REQUIRED)부터.
    expect(computeAccountMode('school.go.kr', { confirmed: false, confirmedVersion: null }, CURRENT)).toBe(
      'WORKSPACE_CONFIRMATION_REQUIRED',
    )
  })

  it('grants SCHOOL_WORKSPACE once confirmed at the current version', () => {
    // 요구사항 9절 테스트 7.
    expect(computeAccountMode('school.go.kr', { confirmed: true, confirmedVersion: CURRENT }, CURRENT)).toBe(
      'SCHOOL_WORKSPACE',
    )
  })

  it('requires reconfirmation when the confirmed version no longer matches the current version', () => {
    // 요구사항 9절 테스트 9: confirmationVersion 변경 시 재확인 요구.
    expect(computeAccountMode('school.go.kr', { confirmed: true, confirmedVersion: '2025-01-01' }, CURRENT)).toBe(
      'WORKSPACE_CONFIRMATION_REQUIRED',
    )
  })

  it('accepts any hosted domain without consulting an approved-domain list', () => {
    // 요구사항 9절 테스트 10: approved_school_domains가 계정 판정에 쓰이지 않는다 —
    // 이 함수는 도메인 목록을 인자로도 받지 않고, 임의의(미등록) 도메인도 동일하게
    // WORKSPACE_CONFIRMATION_REQUIRED/SCHOOL_WORKSPACE로 판정한다.
    const unlisted = 'never-registered-domain.example.org'
    expect(computeAccountMode(unlisted, { confirmed: false, confirmedVersion: null }, CURRENT)).toBe(
      'WORKSPACE_CONFIRMATION_REQUIRED',
    )
    expect(computeAccountMode(unlisted, { confirmed: true, confirmedVersion: CURRENT }, CURRENT)).toBe(
      'SCHOOL_WORKSPACE',
    )
  })

  it('computeAccountMode has no parameter for a domain allowlist at all', () => {
    // 함수 시그니처 자체가 hostedDomain/confirmation/currentVersion 3개뿐임을 함께 확인한다.
    expect(computeAccountMode.length).toBe(3)
  })
})

describe('getConfirmationVersion', () => {
  it('falls back to the default version when no env override is set', () => {
    expect(getConfirmationVersion({})).toBe(DEFAULT_CONFIRMATION_VERSION)
  })

  it('uses the env override when present', () => {
    expect(getConfirmationVersion({ PRIVACY_CONFIRMATION_VERSION: '2027-01-01' })).toBe('2027-01-01')
  })
})
