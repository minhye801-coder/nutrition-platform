# D1 인증/세션 저장소 설정 가이드 (d1-auth-setup)

> Google 로그인(시작 → 콜백 → 세션 확인 → 로그아웃) 흐름에서 쓰던 인메모리 세션 저장소(`functions/_lib/sessionStore.memory.ts`)를 운영 환경에서는 Cloudflare D1 기반 저장소로 교체하기 위한 절차입니다. OAuth 클라이언트 자체의 설정(리다이렉트 URI 등)은 `docs/google-oauth-setup.md`를 참고하세요. 이 문서는 D1 스키마와 바인딩 설정만 다룹니다.

## 0. 왜 D1로 옮기는가

`sessionStore.memory.ts`는 Cloudflare Pages Functions의 단일 isolate 메모리에만 저장되므로, 분산 엣지 환경에서는 요청이 다른 isolate로 라우팅되면 세션이 유실됩니다. 운영에서 실제로 Google 로그인을 테스트/사용하려면 여러 요청·여러 isolate에 걸쳐 살아남는 저장소가 필요하고, 이 프로젝트에서는 Cloudflare D1(SQLite 기반, 무료 플랜 제공)을 사용합니다.

**범위 원칙**: 이 데이터베이스(`AUTH_DB`)에는 로그인 세션과 최소 사용자 메타데이터만 저장합니다. 학생 상담/설문 데이터는 절대 저장하지 않으며, 그 데이터는 계속 각 학교 담당자 본인의 Google Sheets/Drive에만 저장됩니다(`docs/security-principles.md` 원칙과 동일).

## 1. 테이블 개요

마이그레이션 파일: [`migrations/0001_create_auth_tables.sql`](../migrations/0001_create_auth_tables.sql), [`migrations/0002_add_installation_profile_fields.sql`](../migrations/0002_add_installation_profile_fields.sql)

| 테이블 | 용도 | 비고 |
|---|---|---|
| `users` | 로그인한 Google 계정의 최소 프로필 | `id`에 Google OpenID `sub`를 그대로 사용 (별도 UUID 발급 없음). **화면 표시용 담당자명이 아니라 인증용 기본정보로만 쓴다** — 표시용은 `installations.manager_name` 우선 |
| `oauth_tokens` | Google access/refresh token | **평문 저장 금지.** `SESSION_SECRET`으로 유도한 키로 AES-GCM 암호화한 `ciphertext`/`iv`만 저장 (`functions/_lib/tokenCipher.ts`) |
| `sessions` | 로그인 세션 | `session_id_hash`(쿠키 값의 SHA-256 해시), `user_id`, `expires_at`, `created_at`, `updated_at`만 저장. 쿠키에 담기는 원본 세션 ID 자체는 저장하지 않음 |
| `installations` | 학교 작업공간 설치 정보 | `user_id`(설치한 로그인 계정) 1행당 `school_name`(학교명), `manager_name`(설치 시 입력한 담당자명 — 있으면 `users.name`보다 우선 표시), `school_public_id`(공개 식별자), `installed_at`, `updated_at` |

`sessions` 테이블에 원본 세션 ID 대신 해시만 저장하는 이유: D1 테이블이 유출되더라도 그 값만으로는 쿠키를 재구성해 세션을 가로챌 수 없도록 하기 위함입니다.

## 2. 코드 구조

```
functions/_lib/
  sessionStore.ts             # SessionStore 인터페이스 (변경 없음) + SESSION_TTL_SECONDS
  sessionStore.memory.ts      # 로컬 개발 전용 인메모리 구현
  sessionStore.d1.ts          # 운영용 D1 구현 (users/oauth_tokens/sessions에 나눠 기록)
  installationStore.ts        # InstallationStore 인터페이스 (get/create/updateManagerName)
  installationStore.memory.ts # 로컬 개발 전용 인메모리 구현
  installationStore.d1.ts     # 운영용 D1 구현 (installations 조회/생성/담당자명 수정)
  tokenCipher.ts               # SESSION_SECRET 기반 AES-GCM 토큰 암호화/복호화
  stores.ts                    # 합성 지점 — AUTH_DB 바인딩 유무로 memory/D1 자동 전환
functions/api/installation.ts  # GET(조회)/POST(설치 생성)/PATCH(담당자명 수정)
```

`stores.ts`는 `env.AUTH_DB`가 있으면 D1 구현을, 없으면 인메모리 구현을 반환합니다. 라우트 핸들러는 여전히 `getSessionStore(env)` / `getInstallationStore(env)`만 호출하며, 어떤 구현이 쓰이는지는 신경 쓰지 않습니다. 즉 **로컬에서 `.dev.vars`만 채우고 D1 바인딩을 설정하지 않으면 지금처럼 인메모리로 동작하고, D1을 바인딩하면 자동으로 D1을 씁니다.**

## 3. D1 데이터베이스 만들기 (무료 플랜)

D1은 무료 플랜(Workers Free)에 포함되어 있습니다. 이 프로젝트 규모(로그인 세션 + 최소 메타데이터)는 무료 플랜 한도(예: 5GB 저장공간, 1일 5백만 행 읽기 / 10만 행 쓰기 — 정확한 수치는 Cloudflare 요금 페이지에서 최신값 확인) 안에서 충분히 운용 가능합니다. 별도 유료 애드온은 필요하지 않습니다.

```bash
npx wrangler d1 create nutrition-platform-auth
```

실행하면 아래와 비슷한 출력이 나옵니다.

```
✅ Successfully created DB 'nutrition-platform-auth'

[[d1_databases]]
binding = "AUTH_DB"
database_name = "nutrition-platform-auth"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

출력된 `database_id` 값을 `wrangler.toml`의 `[[d1_databases]]` 블록에 있는 `REPLACE_WITH_D1_DATABASE_ID` placeholder에 그대로 붙여 넣습니다. `binding`(`AUTH_DB`)과 `database_name`은 이미 맞춰져 있으므로 그대로 둡니다.

## 4. 마이그레이션 적용

**로컬 개발(`wrangler pages dev`가 쓰는 로컬 SQLite):**

```bash
npx wrangler d1 migrations apply AUTH_DB --local
```

**운영(Cloudflare에 실제로 배포된 D1):**

```bash
npx wrangler d1 migrations apply AUTH_DB --remote
```

`migrations_dir`이 `wrangler.toml`에 `"migrations"`로 설정되어 있으므로, `migrations/` 아래에 번호가 매겨진 `.sql` 파일을 추가하는 방식으로 이후 스키마 변경도 같은 방식으로 관리합니다.

## 5. 로컬 개발에서 D1 사용 여부 선택

- `wrangler.toml`에 `[[d1_databases]]`가 있으면 `wrangler pages dev`가 로컬 SQLite 파일로 `AUTH_DB`를 자동 바인딩합니다 — `.dev.vars`에는 D1 관련 값을 추가할 필요가 없습니다(D1은 시크릿이 아니라 바인딩이라 `wrangler.toml`에서만 선언).
- 로컬에서 D1 없이 빠르게 로그인 흐름만 확인하고 싶다면, `wrangler.toml`의 `[[d1_databases]]` 블록을 임시로 주석 처리하면 `env.AUTH_DB`가 `undefined`가 되어 `stores.ts`가 자동으로 인메모리 구현으로 대체합니다.
- 운영(Cloudflare Pages 대시보드로 배포되는 실제 서비스)에서는 Pages 프로젝트 설정의 **Settings → Functions → D1 database bindings**에서도 동일하게 `AUTH_DB` 바인딩과 데이터베이스를 연결해야 `wrangler.toml`의 설정이 실제 배포에 반영됩니다.

## 6. 필요한 환경변수/바인딩 요약

| 이름 | 종류 | 의미 |
|---|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | 환경변수(시크릿) | `docs/google-oauth-setup.md` 참고 |
| `SESSION_SECRET` | 환경변수(시크릿) | oauth_transaction 쿠키 서명(HMAC) + `oauth_tokens` 암호화 키 유도(AES-GCM)에 공용으로 사용 |
| `AUTH_DB` | D1 바인딩 | 이 문서에서 설정하는 세션/사용자 D1 데이터베이스 |

`SESSION_SECRET`이 바뀌면 이미 암호화되어 저장된 access/refresh token을 더 이상 복호화할 수 없습니다. 운영에서 이 값을 교체할 계획이 있다면 기존 `oauth_tokens` 행을 무효화(삭제)하고 사용자가 재로그인하도록 처리해야 합니다.

## 7. 테스트 체크리스트

1. `npx wrangler d1 create nutrition-platform-auth` 실행 후 `wrangler.toml`의 `database_id` 교체
2. `npx wrangler d1 migrations apply AUTH_DB --local` (로컬) / `--remote` (운영) 실행
3. `.dev.vars`에 `GOOGLE_CLIENT_ID` 등 4개 값 채움 (`docs/google-oauth-setup.md` 4절)
4. `npm run dev:functions`로 로컬 실행 → 로그인 → `npx wrangler d1 execute AUTH_DB --local --command "SELECT id, email FROM users"`로 사용자 행이 생겼는지 확인
5. `oauth_tokens.access_token_ciphertext`에 평문 토큰이 아니라 암호화된 문자열이 들어있는지 확인
6. 로그아웃 후 `sessions` 테이블에서 해당 `session_id_hash` 행이 삭제됐는지 확인
7. `/setup`에서 학교명/담당자명을 입력해 제출 → `installations` 테이블에 `school_name`/`manager_name`/`school_public_id` 행이 생겼는지 확인 → `/settings`/`/app`에서 Google 프로필 이름이 아니라 방금 입력한 담당자명이 표시되는지 확인
