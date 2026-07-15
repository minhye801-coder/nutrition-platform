# Google OAuth 설정 가이드 (google-oauth-setup)

> Milestone 1의 Google 로그인(시작 → 콜백 → 세션 확인 → 로그아웃)에 필요한 Google Cloud Console/Cloudflare 설정 절차입니다. 코드 구현은 `functions/api/auth/`, `docs/platform-v1-architecture.md` 9절(Google OAuth 설계)을 참고하세요. 이 문서는 절차와 값만 다루며, 이 문서 자체에는 실제 비밀값을 적지 않습니다.

## 1. Google Cloud Console에서 OAuth 클라이언트 만들기

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 새로 만들거나 기존 프로젝트를 선택합니다.
2. **API 및 서비스 → OAuth 동의 화면**으로 이동해 동의 화면을 구성합니다.
   - User Type: 학교 조직 계정 전용이 아니라면 **외부(External)**를 선택합니다.
   - 앱 이름: `영양상담 AI+`, 지원 이메일, 개발자 연락처 등을 입력합니다.
   - 게시 상태(Publishing status)는 처음에는 **Testing**으로 둡니다(3절 "테스트 사용자 설정" 참고).
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**를 선택합니다.
   - 애플리케이션 유형: **웹 애플리케이션**
   - 이름: 예) `nutrition-counseling-ai-plus-web`
4. 생성 후 발급되는 **클라이언트 ID**와 **클라이언트 보안 비밀(client secret)**을 안전하게 보관합니다. 이 두 값은 절대 저장소(GitHub)에 커밋하지 않습니다.

## 2. 승인된 JavaScript 원본 (Authorized JavaScript origins)

로그인 버튼이 있는 프론트엔드가 서비스되는 **origin**(스킴+호스트+포트, 경로 제외)을 등록합니다.

| 환경 | 등록할 값 예시 |
|---|---|
| 로컬 Codespaces | `https://<codespace-이름>-8788.app.github.dev` |
| Cloudflare Pages(운영) | `https://nutrition-platform-axd.pages.dev` (커스텀 도메인을 쓰면 그 도메인도 추가) |

이 프로젝트는 서버 측(Authorization Code Flow)에서만 Google과 통신하고 브라우저 JS가 Google API를 직접 호출하지 않으므로, "승인된 JavaScript 원본"은 실제 리다이렉트 동작에는 영향이 적지만 Google Cloud Console이 값 입력을 요구하므로 함께 등록해 둡니다.

## 3. 승인된 리다이렉트 URI (Authorized redirect URIs)

`GET /api/auth/google/callback`의 **전체 URL**을 정확히 등록해야 합니다(경로 오탈자나 트레일링 슬래시 차이도 `redirect_uri_mismatch` 오류를 일으킵니다).

| 환경 | 등록할 값 예시 |
|---|---|
| 로컬 Codespaces | `https://<codespace-이름>-8788.app.github.dev/api/auth/google/callback` |
| Cloudflare Pages(운영) | `https://nutrition-platform-axd.pages.dev/api/auth/google/callback` |

두 값을 **모두** "승인된 리다이렉트 URI" 목록에 추가해 두면, 같은 Google OAuth 클라이언트 하나로 로컬 테스트와 운영 배포를 동시에 지원할 수 있습니다(클라이언트를 환경별로 분리하고 싶다면 Cloud Console에 OAuth 클라이언트를 2개 만들고 `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`를 환경별로 다르게 설정합니다).

### 로컬 Codespaces 테스트 주소를 등록하는 방법

- 이 프로젝트는 정적 프론트엔드(Vite)와 Cloudflare Pages Functions를 함께 테스트하려면 `npm run dev:functions`(`wrangler pages dev --proxy 5173`)로 실행해야 합니다. 이 명령은 기본적으로 `8788` 포트에서 두 부분을 하나의 origin으로 합쳐 제공합니다.
- Codespaces에서 **8788 포트를 Public 또는 사용 중인 계정으로 포워딩**하면 `https://<codespace-이름>-8788.app.github.dev` 형태의 HTTPS 주소가 발급됩니다. 이 주소를 그대로 "승인된 리다이렉트 URI"(경로 포함)와 "승인된 JavaScript 원본"에 등록합니다.
- **`http://localhost:8788`는 등록하지 않는 것을 권장합니다.** 세션/OAuth 쿠키는 `Secure` 속성을 사용하므로 평문 HTTP(`http://localhost`)에서는 브라우저가 쿠키를 저장하지 않아 로그인이 실패합니다. 반드시 Codespaces가 제공하는 HTTPS 포워딩 주소로 접속해 테스트하세요.
- 포워딩 주소는 Codespace를 새로 만들 때마다 바뀔 수 있으므로, 주소가 바뀌면 Cloud Console의 등록 값과 `.dev.vars`의 `GOOGLE_REDIRECT_URI`를 함께 갱신해야 합니다.

### Cloudflare 운영 주소를 등록하는 방법

- Cloudflare Pages 프로젝트의 기본 도메인(`nutrition-platform-axd.pages.dev`) 또는 연결한 커스텀 도메인을 사용합니다.
- 프리뷰 배포(브랜치별로 자동 생성되는 `*.nutrition-platform-axd.pages.dev` 서브도메인)에서도 로그인을 테스트하려면 해당 프리뷰 URL도 추가로 등록해야 합니다. 프리뷰 URL은 배포마다 달라질 수 있으므로, 실제로는 운영 도메인에서만 로그인 테스트를 진행하는 것을 권장합니다.

## 4. Cloudflare에 secrets 입력하는 방법

Pages Functions는 `.env`(Vite 프론트엔드 전용)가 아니라 **Cloudflare의 별도 환경변수/시크릿 체계**에서 값을 읽습니다.

### 로컬 개발

1. `.dev.vars.example`을 복사해 `.dev.vars`를 만듭니다(`.dev.vars`는 `.gitignore`에 포함되어 있어 커밋되지 않습니다).
   ```
   cp .dev.vars.example .dev.vars
   ```
2. `.dev.vars`에 실제 값을 채웁니다.
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://<codespace-이름>-8788.app.github.dev/api/auth/google/callback
   SESSION_SECRET=...(32바이트 이상의 무작위 문자열 권장)
   ```
3. `npm run dev:functions`로 실행하면 `wrangler`가 `.dev.vars`를 자동으로 읽어 `functions/`에 주입합니다.

### Cloudflare 운영 배포

Cloudflare 대시보드 또는 CLI 중 하나로 등록합니다. 두 방법 모두 값이 Cloudflare 서버 측에만 저장되고 저장소(GitHub)에는 남지 않습니다.

**CLI(권장, 로컬에서 1회 실행):**
```
npx wrangler pages secret put GOOGLE_CLIENT_ID
npx wrangler pages secret put GOOGLE_CLIENT_SECRET
npx wrangler pages secret put GOOGLE_REDIRECT_URI
npx wrangler pages secret put SESSION_SECRET
```
각 명령을 실행하면 값을 입력하라는 프롬프트가 뜨며, 입력한 값은 터미널 히스토리에 남지 않도록 붙여넣기 후 바로 지웁니다.

**대시보드:** Cloudflare 대시보드 → Pages → 해당 프로젝트 → **Settings → Environment variables**에서 Production/Preview 환경별로 각각 등록합니다. 값 입력란에 **Encrypt(암호화)** 옵션이 있다면 반드시 체크합니다.

`SESSION_SECRET`은 운영과 로컬에서 서로 다른 값을 사용해도 되며, 최소 32바이트 이상의 무작위 문자열을 권장합니다(예: `openssl rand -base64 32`로 생성).

## 5. 필요한 Google API 및 scope

로그인(`/login`)과 최초 설치(`/setup`)는 요청하는 스코프가 다르고, 설치 흐름에서만
Cloud Console에서 API를 사용 설정해야 합니다.

| 시점 | 요청 스코프 | Cloud Console에서 API 활성화 필요 여부 |
|---|---|---|
| 로그인(`/login`, `GOOGLE_LOGIN_SCOPES`) | `openid email profile` | 불필요 |
| 설치 흐름(`/setup`, `GOOGLE_INSTALL_SCOPES` = 로그인 스코프 + Drive) | `openid email profile` + `https://www.googleapis.com/auth/drive.file` | **Google Drive API**, **Google Sheets API**를 Cloud Console의 "API 및 서비스 → 라이브러리"에서 사용 설정해야 함 |

**`drive.file` 하나로 Drive와 Sheets를 모두 처리합니다.** `drive.file`은 "이 앱이
만들었거나 사용자가 이 앱과 명시적으로 공유한 파일"에만 접근을 허용하는 최소 범위이며,
Google Sheets API v4도 이 스코프로 생성한 스프레드시트에 대해서는 `spreadsheets.create`
/`values.batchUpdate` 등을 동일하게 허용합니다. 그래서 별도의
`https://www.googleapis.com/auth/spreadsheets` 스코프를 추가하지 않습니다
(`functions/_lib/googleOAuth.ts`의 `GOOGLE_DRIVE_FILE_SCOPE`, 9절 "최소 권한 원칙").

설치 흐름은 로그인 시점에는 이 스코프를 요청하지 않고, 사용자가 `/setup`에서 "설치
시작"을 눌렀을 때 서버가 기존 세션의 scope를 확인해 부족하면 점진 동의(incremental
authorization, `GET /api/auth/google?purpose=install`)로 추가 요청합니다
(`functions/_lib/setupOrchestrator.ts`). 이때 `prompt=consent`를 함께 보내
refresh token 재발급을 보장합니다.

Cloud Console에서 활성화해야 하는 API는 **Google Drive API**와 **Google Sheets API**
두 가지이며, 둘 다 무료 할당량 안에서 동작합니다(결제 계정 불필요, `platform-v1-architecture.md`
18.9절).

## 6. 테스트 사용자 설정

OAuth 동의 화면 게시 상태가 **Testing**인 동안에는, Google 계정으로 로그인을 시도하는 사용자가 **명시적으로 등록된 테스트 사용자**가 아니면 로그인이 거부됩니다(앱이 아직 Google 검증을 받지 않았기 때문입니다).

1. Cloud Console → **API 및 서비스 → OAuth 동의 화면 → 테스트 사용자**로 이동합니다.
2. 로그인을 테스트할 영양교사(및 개발자) 본인의 Google 계정 이메일을 추가합니다.
3. 테스트 사용자 목록에 없는 계정으로 로그인하면 Google이 `access_denied`로 거부하며, 이 프로젝트의 콜백은 이를 `/login?error=access_denied`로 처리합니다.

실제 여러 학교에 공개 배포하려면 이후 Google의 OAuth 앱 검증(verification) 절차를 거쳐 게시 상태를 **In production**으로 전환해야 하며, 이는 이 문서의 범위를 벗어나는 별도 작업입니다.

## 7. 학교 Workspace 계정의 관리자 제한 가능성

영양교사가 개인 Gmail이 아니라 **학교의 Google Workspace for Education 계정**으로 로그인하는 경우, 조직 관리자가 서드파티 OAuth 앱 접근을 화이트리스트 방식으로 제한하고 있을 수 있습니다(`platform-v1-architecture.md` 9절과 17절에서 이미 언급된 미결정 사항).

- 이 경우 교사 개인이 동의 화면에서 "허용"을 눌러도, Workspace 관리자가 이 앱을 사전에 승인하지 않았다면 로그인이 조직 정책에 의해 차단될 수 있습니다.
- 이런 상황이 발생하면 학교 IT 담당자(Workspace 관리자)가 **Google Workspace 관리 콘솔 → 보안 → API 제어 → 앱 액세스 제어**에서 이 OAuth 클라이언트 ID를 신뢰할 수 있는 앱으로 추가해야 합니다.
- 이 문서의 1절에서 발급한 **클라이언트 ID**를 학교 IT 담당자에게 전달하면 화이트리스트 등록에 사용할 수 있습니다.
- 이 제약은 코드로 우회할 수 없으며, 학교 조직 차원의 승인이 필요한 정책적 제약입니다. 로그인 실패 시 사용자에게 "학교 Google 관리자에게 이 앱의 접근 허용을 요청하세요"와 같은 안내가 필요할 수 있으며, 구체적인 안내 화면은 후속 마일스톤 과제로 남겨둡니다(`platform-v1-architecture.md` 17절 미결정 사항과 동일 항목).

## 8. 환경변수 요약

| 이름 | 의미 | 어디서 읽는가 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 클라이언트 ID(비밀 아님, 그러나 서버에서만 사용) | `functions/api/auth/google/*` |
| `GOOGLE_CLIENT_SECRET` | OAuth 클라이언트 보안 비밀 | `functions/api/auth/google/callback.ts` (토큰 교환 시에만) |
| `GOOGLE_REDIRECT_URI` | 콜백 URL(Cloud Console 등록값과 정확히 일치해야 함) | `functions/api/auth/google/*` |
| `SESSION_SECRET` | oauth_transaction 쿠키 서명(HMAC)에 사용하는 서버 비밀키 | `functions/_lib/signedPayload.ts` |

네 값 모두 `VITE_` 접두사를 붙이지 않습니다 — 접두사를 붙이면 Vite가 클라이언트 번들에 값을 그대로 포함시키므로 절대 사용하지 않습니다.
