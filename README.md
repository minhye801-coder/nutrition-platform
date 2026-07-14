# 영양상담 AI+

**학교 영양상담 통합플랫폼**

여러 학교의 영양교사가 하나의 공용 사이트에서 각자의 Google 계정으로 로그인하여, 각자의 Google Sheets/Drive에 데이터를 저장하고, 본인의 Gemini API Key를 등록해 사용하는 범용 AI 영양 플랫폼입니다.

## 주요 모듈 (설계 기준, 단계적으로 구현)

1. **AI 영양상담 매니저** (`/app`)
2. **맛마을 탐험소** (`/explore`)
3. **상담신청 페이지** (`/intake`)
4. **보호자동의 페이지** (`/consent`)
5. **관리자 설정 · 최초 설치** (`/setup`)
6. **Google OAuth 연결**
7. **학교별 Google Sheets/Drive 자동 생성**
8. **Gemini API 사용자별 설정**

## 기술 스택

- **프론트엔드**: React + TypeScript + Vite, TailwindCSS, React Router
- **배포**: Cloudflare Pages(정적 프론트) + Pages Functions(API 레이어)
- **버전 관리**: GitHub / **개발 환경**: GitHub Codespaces
- **인증**: Google OAuth 2.0 Authorization Code Flow + PKCE (Cloudflare Pages Functions에서 처리, 세션은 HttpOnly 쿠키)
- **데이터 저장소**: Google Sheets(학교별 데이터), Google Drive(학교별 문서/PDF) — 아직 미연동
- **백엔드 보조**: Google Apps Script(초기 단계, Docs/PDF 생성 등) — 아직 미연동

## 개발 원칙

- 학생 개인정보는 플랫폼 운영자 계정이 아닌 **학교별 Google Sheets/Drive**에 저장한다.
- API Key 등 민감정보는 GitHub나 브라우저에 저장하지 않고, 서버 측 안전한 저장소/환경변수로 관리한다.
- 공개 페이지(상담신청, 보호자동의)는 내부 리소스 ID를 노출하지 않고 `schoolPublicId`/token 기반으로 연결한다.
- 자세한 내용은 [`docs/security-principles.md`](docs/security-principles.md), 최종 아키텍처는 [`docs/platform-v1-architecture.md`](docs/platform-v1-architecture.md) 참고.

## 현재 개발 단계

**Milestone 1 — 로그인과 설치(진행 중)**. Google 로그인 시작/콜백/세션 확인/로그아웃이 Cloudflare Pages Functions로 구현되어 있습니다. Google Sheets/Drive 생성, Gemini, Cloudflare D1, Apps Script 연동은 아직 구현하지 않았습니다(세션은 D1 연결 전까지 임시 인메모리 저장소를 사용 — `functions/_lib/stores.ts` 참고). 전체 로드맵은 [`docs/development-roadmap.md`](docs/development-roadmap.md), Milestone별 범위는 [`docs/architecture-review-summary.md`](docs/architecture-review-summary.md), OAuth 설정 절차는 [`docs/google-oauth-setup.md`](docs/google-oauth-setup.md) 참고.

## 시작하기

```bash
npm install
npm run dev             # 프론트엔드만: http://localhost:5173 (Pages Functions/API 없음)
npm run dev:functions   # 프론트엔드 + Pages Functions 함께: http://localhost:8788
npm run build           # dist/ 에 정적 빌드 생성 (tsc -b && vite build)
npm run lint             # ESLint
npm run typecheck:functions  # functions/ 타입 체크
npm run format           # Prettier로 전체 포맷
```

프론트엔드 환경변수는 `.env.example`을 복사해 `.env`로 만들어 사용합니다. **Google 로그인을 테스트하려면** `npm run dev:functions`로 실행하고, `.dev.vars.example`을 복사한 `.dev.vars`에 Google OAuth 값을 채워야 합니다 — 자세한 절차는 [`docs/google-oauth-setup.md`](docs/google-oauth-setup.md) 참고.

## 폴더 구조

```
src/
  components/    # 공용 UI 컴포넌트 (layout/, common/ — AuthGuard 포함)
  layouts/       # 페이지 레이아웃 (RootLayout: 헤더+본문+푸터)
  pages/         # 라우트별 페이지 (Home/Login/Setup/App/Settings)
  hooks/         # 커스텀 훅 (useSession)
  services/      # 외부 API 연동 계층 (authService — Sheets/Gemini는 아직 없음)
  types/         # 공유 타입 정의
  styles/        # 전역 스타일(Tailwind 진입점)

functions/
  api/
    health.ts               # 헬스체크
    auth/
      google/index.ts       # GET /api/auth/google — 로그인 시작
      google/callback.ts    # GET /api/auth/google/callback — OAuth 콜백
      session.ts             # GET /api/auth/session — 로그인 상태 확인
      logout.ts              # POST /api/auth/logout — 로그아웃
  _lib/            # 라우트 코드가 아닌 공용 모듈 (Cloudflare가 라우팅에서 제외하는 _ 접두사)
    env.ts, cookies.ts, crypto.ts, signedPayload.ts, googleOAuth.ts,
    sessionStore.ts(인터페이스), sessionStore.memory.ts(임시 구현),
    installationStore.ts(인터페이스+임시 구현), stores.ts(합성 지점)

docs/            # 설계/분석 문서
legacy/          # 기존 3개 Apps Script 프로젝트 원본 (참고용, 수정하지 않음)
```

## 라우트

| 경로 | 상태 |
|---|---|
| `/` | 소개 페이지 |
| `/login` | Google 로그인 연결됨(`/api/auth/google`), 오류 메시지 표시 |
| `/setup` | 로그인 필요, 로그인 사용자 이름/이메일 표시, 실제 설치(Drive/Sheets 생성)는 샘플 |
| `/app` | 로그인 필요, 로그인 사용자 정보 표시, 대시보드는 샘플 데이터 |
| `/settings` | 로그인 필요, Google 연결 상태 표시, 로그아웃 동작, Gemini Key 저장은 미연동 |

`/explore`, `/intake`, `/consent`, `/import`은 Milestone 3 이후 순서대로 추가됩니다.

## 문서

- [최종 아키텍처 설계서](docs/platform-v1-architecture.md)
- [아키텍처 검토 요약(Milestone 1 착수 전 결정사항)](docs/architecture-review-summary.md)
- [Google OAuth 설정 가이드](docs/google-oauth-setup.md)
- [개발 로드맵](docs/development-roadmap.md)
- [보안 원칙](docs/security-principles.md)
- [기존 시스템 분석 문서 모음](docs/) (`legacy-system-map.md`, `integration-flow.md`, `google-data-inventory.md`, `hardcoded-values-report.md`, `migration-risks.md`, `recommended-migration-plan.md`)

## 다음 작업

- 세션/설치 저장소를 임시 인메모리 구현에서 Cloudflare D1 기반 구현으로 교체(`functions/_lib/stores.ts`만 교체하면 되도록 인터페이스 분리해 둠)
- 최초 설치 흐름에서 실제 Google Drive 폴더/Spreadsheet 자동 생성 연결(Drive/Sheets 스코프 점진 동의 포함)
- `/app`에서 `설정`/`학생정보` 탭 읽기 연동

Cloudflare deployment trigger configured.
