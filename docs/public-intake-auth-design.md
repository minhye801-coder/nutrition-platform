# 공개 상담신청 인증 구조 설계 (public-intake-auth-design)

> 문서 상태: 설계 확정(구현 전). `docs/intake-migration-spec.md` 10.4절에서 발견한 아키텍처 gap("공개 상담신청이 세션 없이 학교 Spreadsheet 쓰기 권한을 얻을 경로가 없음")을 해결하기 위한 설계다. 이번 문서는 설계만 다루며, 실제 구현은 상담접수 이전(Milestone 2A) 착수 시 진행한다.

## 1. 문제 정의

- `/intake/:schoolPublicId`는 **로그인하지 않은** 학생/보호자가 접속하는 공개 라우트다(`docs/route-and-menu-plan.md` 3절).
- 그런데 상담신청 제출은 **교사(설치자) 본인 소유의 Google Spreadsheet**(`상담접수` 탭)에 행을 추가해야 한다.
- 현재 코드베이스에서 Google Sheets를 쓰려면 반드시 `requireInstalledAccess(request, env)`(`functions/_lib/requireInstalledAccess.ts:28`)를 거쳐야 하는데, 이 함수는 내부적으로 `requireSession(request, env)`으로 **로그인 세션 쿠키**를 요구한다. 공개 신청자에게는 그런 세션이 없다.
- 즉 "URL의 `schoolPublicId` 하나만 가지고, 그 학교 소유자의 Google 계정 access token을 세션 없이 얻는 경로"가 필요하다.

## 2. 이미 있는 것 / 없는 것

### 2.1 이미 있는 것
- **`schoolPublicId` → 설치 조회용 인덱스**: `migrations/0002_add_installation_profile_fields.sql:12-15`가 이미 `CREATE INDEX idx_installations_school_public_id ON installations(school_public_id)`를 만들어 두었다. 주석에도 "`/explore/:publicId`, `/intake/:publicId` 같은 공개 라우트를 대비한 조회용 인덱스"라고 명시돼 있다 — **이 설계 자체가 처음부터 예정돼 있었다.**
- **`refresh_token`이 세션이 아니라 계정(userId) 단위로 저장됨**: `oauth_tokens` 테이블(`migrations/0001_create_auth_tables.sql:18-27`)은 `user_id`를 PK로 하고, `access_token_ciphertext`/`refresh_token_ciphertext`를 SESSION_SECRET 파생 키로 AES-GCM 암호화해 저장한다(`functions/_lib/tokenCipher.ts`). **세션 쿠키(`sessions` 테이블)와는 완전히 분리된 테이블**이므로, 세션이 없어도 `userId`만 알면 이론적으로 토큰에 접근할 수 있는 구조다.
- **`SessionStore.updateAccessToken(userId, update)`는 이미 userId만으로 동작한다**(`functions/_lib/sessionStore.d1.ts:150-189`) — `SessionRecord` 객체나 쿠키를 요구하지 않고 `oauth_tokens` 테이블을 `user_id` 기준으로 직접 갱신한다. 갱신된 access token을 다시 저장하는 "쓰기" 경로는 이미 세션 비의존적이다.
- **`refreshAccessToken()`(`functions/_lib/googleOAuth.ts`)**은 refresh token 문자열 하나만 받아 Google과 통신한다 — 세션 개념이 전혀 없다.

### 2.2 없는 것 (새로 만들어야 함)
1. `InstallationStore`에 **`schoolPublicId`로 설치를 조회하는 메서드**가 없다(`functions/_lib/installationStore.ts:49-66`는 `get(userId)`만 정의).
2. `oauth_tokens`를 **`userId`로 읽는(복호화 포함) 경로**가 없다 — 기존 `SessionStore.get(sessionId)`(`sessionStore.d1.ts:91-143`)는 항상 `sessions` 테이블과 조인해서 `sessionId`를 요구하므로, 세션 없이 `userId`만으로 토큰을 읽을 수 없다.
3. 위 둘을 조합해 "schoolPublicId → access token"을 반환하는 공개 접근용 모듈이 없다.

## 3. 설계

### 3.1 `InstallationStore`에 조회 메서드 추가

```ts
// functions/_lib/installationStore.ts
export interface InstallationStore {
  get(userId: string): Promise<InstallationRecord | null>
  /** 신규: 공개 라우트(상담신청 등)가 schoolPublicId만으로 설치를 찾을 때 쓴다. */
  getBySchoolPublicId(schoolPublicId: string): Promise<InstallationRecord | null>
  // ...기존 메서드 동일
}
```

- D1 구현(`installationStore.d1.ts`)은 `idx_installations_school_public_id` 인덱스를 그대로 타는 `SELECT ... WHERE school_public_id = ?1` 한 줄로 구현한다(이미 인덱스가 있으므로 스키마 변경 불필요).
- 메모리 구현(`installationStore.memory.ts`)에도 동일 메서드를 추가한다(로컬 개발용).
- `schoolPublicId`에 유니크 제약이 없다는 점(`migrations/0002` 주석)에 유의 — 이론상 중복 가능성이 있으므로 조회 결과가 여러 건이면 첫 번째만 쓰지 말고 **에러로 처리**할지, 아니면 발급 로직 자체에 유니크성을 사실상 보장하는 근거(엔트로피 등)가 있는지 구현 시 재확인 필요(**확인 필요**).

### 3.2 `oauth_tokens`를 `userId`로 직접 읽는 경로 추가

기존 `SessionStore` 인터페이스에 세션 비의존적인 조회 메서드를 추가한다(완전히 새 저장소를 만들지 않고 기존 `oauth_tokens` 소유 모듈에 메서드만 추가 — `sessionStore.d1.ts`가 이미 이 테이블의 유일한 소유자이므로 소유권을 분산시키지 않는다):

```ts
// functions/_lib/sessionStore.ts
export interface AccountTokens {
  accessToken: string
  refreshToken: string | null
  accessTokenExpiresAt: number
  grantedScopes: string
}

export interface SessionStore {
  // ...기존 메서드 동일
  /** 신규: 세션 쿠키 없이 userId만으로 저장된 OAuth 토큰을 읽는다(공개 라우트용). */
  getTokensByUserId(userId: string): Promise<AccountTokens | null>
}
```

- D1 구현: `sessions` 테이블과 조인하지 않고 `oauth_tokens WHERE user_id = ?1`만 조회 + 복호화(`decryptToken`, 기존 `get()`과 동일한 복호화 로직 재사용).
- 이 메서드는 **"세션이 살아있는지"를 전혀 확인하지 않는다** — 로그인 세션 만료 여부와 무관하게 계정이 살아있는 한(refresh token이 유효한 한) access token을 재발급할 수 있어야 공개 신청이 세션 만료와 무관하게 항상 동작한다. 이는 의도된 설계다(3.4절에서 실패 시나리오 별도 논의).

### 3.3 공개 접근용 access token 모듈 (신규 파일)

```ts
// functions/_lib/publicSpreadsheetAccess.ts
import { getInstallationStore, getSessionStore } from './stores'
import { refreshAccessToken, fetchGrantedScopes, hasDriveScope } from './googleOAuth'
import type { Env } from './env'
import type { InstallationRecord } from './installationStore'

export interface PublicSpreadsheetAccess {
  installation: InstallationRecord
  accessToken: string
  spreadsheetId: string
}

export type PublicAccessError =
  | { error: 'school_not_found'; status: 404 }
  | { error: 'installation_incomplete'; status: 500 }
  | { error: 'owner_reauth_required'; status: 503 } // 학교 소유자가 다시 로그인해야 해결 가능 — 아래 3.4절

export async function ensurePublicSpreadsheetAccess(
  env: Env,
  schoolPublicId: string,
): Promise<PublicSpreadsheetAccess | PublicAccessError> {
  const installation = await getInstallationStore(env).getBySchoolPublicId(schoolPublicId)
  if (!installation) return { error: 'school_not_found', status: 404 }
  if (!installation.spreadsheetId) return { error: 'installation_incomplete', status: 500 }

  const tokens = await getSessionStore(env).getTokensByUserId(installation.userId)
  if (!tokens || !tokens.refreshToken) return { error: 'owner_reauth_required', status: 503 }

  const now = Date.now()
  const stillFresh = tokens.accessTokenExpiresAt > now + 60_000 && hasDriveScope(tokens.grantedScopes)
  if (stillFresh) {
    return { installation, accessToken: tokens.accessToken, spreadsheetId: installation.spreadsheetId }
  }

  try {
    const refreshed = await refreshAccessToken(
      { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
      tokens.refreshToken,
    )
    if (!hasDriveScope(refreshed.scope ?? '')) return { error: 'owner_reauth_required', status: 503 }

    await getSessionStore(env).updateAccessToken(installation.userId, {
      accessToken: refreshed.access_token,
      accessTokenExpiresAt: now + refreshed.expires_in * 1000,
      grantedScopes: refreshed.scope,
    })
    return { installation, accessToken: refreshed.access_token, spreadsheetId: installation.spreadsheetId }
  } catch {
    return { error: 'owner_reauth_required', status: 503 }
  }
}
```

- 기존 `ensureDriveAccessToken`(`functions/_lib/googleAccessToken.ts:66-121`)과 로직 골격이 거의 같다 — 차이는 입력이 `SessionRecord`가 아니라 `userId`(+ D1에서 막 읽어온 토큰)라는 점뿐이다. **의도적으로 코드를 공유하지 않고 별도 함수로 둔다** — 세션 기반 경로(로그인한 교사)와 공개 경로(비로그인 신청자)는 실패 시 대응이 근본적으로 다르기 때문이다(교사 쪽은 재로그인 리다이렉트가 가능하지만, 공개 신청자는 학교 계정을 재로그인시킬 방법이 없다 — 3.4절).
- `functions/_lib/requireInstalledAccess.ts`와 이름은 유사하지만 반환 타입과 실패 처리(3.4절)가 다르므로 함수를 합치지 않는다 — 억지로 하나로 합치면 세션 유무에 따라 분기하는 조건문이 늘어나 오히려 각 경로의 실패 처리가 흐려진다.

### 3.4 ⚠️ 실패 시나리오: 학교 소유자의 refresh token이 죽었을 때

로그인 세션 기반 경로(`ensureDriveAccessToken`)는 refresh 실패 시 `ReauthRequiredError`를 던지고, 브라우저에 로그인 화면을 다시 띄우면 해결된다(사용자가 바로 앞에 있으므로). **공개 상담신청 경로에는 그 "사용자"가 없다** — 신청자는 학교 소유자의 Google 계정과 무관한 제3자(학생/보호자)이므로, 재로그인 자체를 유도할 수 없다.

발생 가능 원인: 학교 담당자가 Google 계정 보안 설정에서 앱 연결을 해제, refresh token이 6개월 이상 미사용으로 만료(Google의 refresh token 정책), 비밀번호 변경으로 인한 토큰 무효화 등.

**이 경우 시스템은 다음을 해야 한다** — 이번 설계에서 방식만 제안하고 최종 결정은 사용자 확인 필요로 남긴다:
1. 신청자에게는 "일시적으로 신청을 받을 수 없습니다. 학교로 직접 문의해 주세요" 같은 일반 안내만 노출(내부 오류 원인 노출 금지 — `security-principles.md` 원칙과 동일).
2. 학교 담당자(교사)에게는 어떤 방식으로든 이 상태를 알려야 한다 — 후보: (a) 다음 로그인 시 `/app` 대시보드에 경고 배너, (b) 이메일 알림(발송 인프라 필요, 현재 없음), (c) 별도 조치 없이 "신청이 안 들어온다"는 것을 교사가 스스로 알아차릴 때까지 방치. **셋 중 무엇을 택할지는 이번 설계 범위에서 결정하지 않는다** — 이메일 발송 인프라가 이 저장소에 아직 없다는 점(`grep -r "sendEmail\|nodemailer\|resend\|sendgrid" functions/` 결과 없음, 확인됨)을 감안하면 (a)가 가장 구현 비용이 낮다.

### 3.5 Rate limiting / 남용 방지

legacy는 `LockService.getScriptLock()`(전체 스크립트 직렬화, `intake-consent/code.gs.txt:44-46`)과 허니팟 필드로 스팸을 어느 정도 막았다. Cloudflare Pages Functions에는 Apps Script 같은 전역 락이 없으므로 이 부분은 다르게 설계해야 한다.

- **허니팟 필드**는 그대로 이식 가능(폼에 숨김 필드 하나 추가, 서버에서 값이 있으면 거부) — legacy와 동일한 방어를 코드 변경 없이 재현 가능.
- **`접수ID` 채번 방식 변경 권장**: legacy의 "시트 전체 스캔 후 max+1"(`intake-consent/code.gs.txt:255-266`)은 원래도 락에 의존하는 취약한 방식이었다(`docs/database-schema.md` 1절이 이미 지적). Cloudflare Pages Functions에는 Apps Script의 `LockService` 같은 프로세스 내 전역 락이 없으므로, 동시 요청 시 경합이 legacy보다 더 쉽게 발생한다. **`intakeId`를 `crypto.randomUUID()`로 발급하면 이 경합 자체가 구조적으로 사라진다** — 이미 `database-schema.md`가 다른 모든 ID에 대해 이 방식을 채택하기로 확정했으므로, `상담접수.intakeId`에도 동일하게 적용하는 것을 권장한다(신규 결정 아님, 기존 방침의 일관 적용).
- **요청 빈도 제한(rate limiting)**: 같은 `schoolPublicId`(또는 IP)로 짧은 시간에 대량 요청이 오는 것을 막는 장치가 현재 아키텍처에 없다. Cloudflare의 Rate Limiting Rules(대시보드/Workers 설정) 또는 D1/KV 기반 카운터 중 무엇을 쓸지는 인프라 결정이 필요하다 — **이번 설계 범위에서 결정하지 않는다(확인 필요)**. 다만 공개 쓰기 API를 만드는 이상 이 결정 없이 프로덕션에 배포하는 것은 위험하다는 점만 명시해 둔다.
- **`schoolPublicId` 열거(enumeration) 방지**: `school_not_found`와 `installation_incomplete`/`owner_reauth_required`를 신청자에게 서로 다른 메시지로 노출하면, 존재하는 `schoolPublicId`와 존재하지 않는 값을 구분하는 신호가 된다. 신청자 대상 응답은 내부 에러 코드와 무관하게 **동일한 일반 문구**로 통일하는 것을 권장(로그에는 실제 원인을 남기되, 응답 바디는 통일).

### 3.6 라우트 구조 (Cloudflare Pages Functions)

기존 `functions/api/students/[studentUuid]/*.ts` 동적 라우팅 패턴을 그대로 따른다:

```
functions/api/public/intakes/[schoolPublicId]/
  index.ts          # POST: 공개 제출 (onRequestPost만, GET 없음 — 목록 조회는 세션 필요 API)
  config.ts         # GET: getPublicConfig 대응(학교명 등 공개 정보만)
```

- 이 경로들은 `requireInstalledAccess`를 쓰지 않는다 — 대신 `ensurePublicSpreadsheetAccess(env, params.schoolPublicId)`를 쓴다.
- 응답에는 `installation.userId`, `spreadsheetId` 원본, access token 등 내부 값을 **절대 포함하지 않는다**(기존 `studentApiHelpers.ts`의 원칙과 동일).

## 4. 이번 설계에서 결정하지 않은 것 (확인 필요)

1. `schoolPublicId` 중복 조회 시 처리(3.1절).
2. 학교 소유자 refresh token 만료 시 교사에게 알리는 구체적 방법(3.4절) — 배너/이메일/방치 중 선택.
3. Rate limiting 구현 방식(Cloudflare Rate Limiting Rules vs D1/KV 카운터, 3.5절).
4. `?k=` 짧은코드 라우팅을 v1에서 유지할지(`docs/intake-migration-spec.md` 8.2/10.5절과 동일 사안, 이 설계와는 별개로 보호자동의 쪽에서 다시 결정 필요).

## 5. 요약: 새로 만들 코드 (구현 착수 시)

| 파일 | 변경 |
|---|---|
| `functions/_lib/installationStore.ts` | `getBySchoolPublicId` 메서드 추가 |
| `functions/_lib/installationStore.d1.ts` | 위 메서드 구현(인덱스 활용 SELECT) |
| `functions/_lib/installationStore.memory.ts` | 위 메서드 구현(로컬 개발용) |
| `functions/_lib/sessionStore.ts` | `getTokensByUserId` 메서드 추가(타입 `AccountTokens`) |
| `functions/_lib/sessionStore.d1.ts` | 위 메서드 구현(`oauth_tokens`만 조회, `sessions` 조인 없음) |
| `functions/_lib/sessionStore.memory.ts` | 위 메서드 구현 |
| `functions/_lib/publicSpreadsheetAccess.ts` | 신규 파일, `ensurePublicSpreadsheetAccess` |
| `functions/api/public/intakes/[schoolPublicId]/index.ts` | 신규, 공개 제출 API |
