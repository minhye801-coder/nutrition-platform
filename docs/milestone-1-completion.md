# Milestone 1 완료 보고 (milestone-1-completion)

> Milestone 1(`platform-v1-architecture.md` 15절 "로그인과 설치") 완료 여부를 실제 코드 기준으로 점검한 결과입니다. 검증 시점: 커밋 `de78b31` 기준.

## 1. 완료 기준 체크리스트

| # | 항목 | 상태 | 근거(코드) |
|---|---|---|---|
| 1 | Google OAuth 로그인 | ✅ | `functions/api/auth/google/index.ts`(PKCE+state 서명), `callback.ts`(교환+세션 생성). scope는 `openid email profile`만(`GOOGLE_LOGIN_SCOPES`). |
| 2 | 로그아웃 | ✅ | `functions/api/auth/logout.ts` — Google 토큰 revoke(best-effort) + 세션 쿠키/D1 삭제. |
| 3 | D1 세션·토큰·설치 메타데이터 | ✅ | `migrations/0001~0004`. `users`/`oauth_tokens`/`sessions`/`installations`/`installation_progress` 5개 테이블. 학생 데이터 컬럼 없음(2절 참고). |
| 4 | 최초 설치 화면 | ✅ | `src/pages/SetupPage.tsx` — 학교명/담당자명 입력 → 단계별 진행 표시(초록/노랑/회색) → 완료 요약. |
| 5 | 단계적 Drive 권한 승인(incremental auth) | ✅ | `functions/api/auth/google/index.ts` `purpose=install`일 때만 `drive.file` 추가 + `prompt=consent`(5·6절 상세). |
| 6 | 사용자 본인 Drive에 폴더/Spreadsheet 생성 | ✅ | `functions/_lib/setupOrchestrator.ts`가 세션의 access token으로만 Drive/Sheets 호출(`functions/_lib/googleDrive.ts`, `googleSheets.ts`). 서비스 계정·운영자 계정 경로 없음. |
| 7 | 설치 재시도 | ✅ | `installation_progress`에 단계별 상태 저장, `POST /api/setup/retry`가 저장된 ID를 재검증 후 이어서 진행. |
| 8 | 중복 생성 방지 | ✅(스프레드시트는 원자적, 폴더는 확률적) — 3·8절 상세 |
| 9 | 학교명·담당자명 저장/수정 | ✅ | `functions/api/installation.ts` GET/PATCH, `src/pages/SettingsPage.tsx`. |
| 10 | 설정 화면 Drive/Spreadsheet 바로가기 | ✅ | `functions/api/installation.ts`가 `driveFolderUrl`/`spreadsheetUrl`(완성된 URL)만 반환, 원본 ID 미노출. `src/pages/SettingsPage.tsx`의 `ResourceLinkRow`. |
| 11 | 직접 경로 접속·세션 기반 라우팅 | ✅ | `/login`(비로그인 전용, 로그인+설치완료 시 `/app`로 replace), `/app`(`AuthGuard requireInstallation`), `/setup`·`/settings`(`AuthGuard`). 4절 상세. |

## 2. 상세 점검 (요청 항목 4~9)

### 4. "임시파일" 폴더 미생성
`functions/_lib/installTemplate.ts`의 `SUBFOLDER_NAMES`는 5개(`보호자동의서`/`상담생성문서`/`검사파일`/`맛마을결과`/`백업`)이며 `임시파일`은 포함되지 않음. `grep -rn "임시파일" functions/ src/`에서 매칭 없음(주석 제외).

### 5. 일반 로그인에 불필요한 `prompt=consent` 없음
`functions/api/auth/google/index.ts`: `forceConsent: purpose === 'install'`. 로그인(`purpose` 없음)일 때 `forceConsent`는 `false`이므로 `buildAuthorizationUrl`(`functions/_lib/googleOAuth.ts`)이 `prompt` 파라미터 자체를 설정하지 않음(생략). `access_type=offline`도 동일하게 `offlineAccess: purpose === 'install'`로 로그인 시 생략됨.

### 6. 설치용 OAuth에서만 `drive.file` 추가
`GOOGLE_INSTALL_SCOPES = [...GOOGLE_LOGIN_SCOPES, GOOGLE_DRIVE_FILE_SCOPE]`이며 `index.ts`가 `purpose === 'install'`일 때만 이 배열을 사용(`scopes = purpose === 'install' ? GOOGLE_INSTALL_SCOPES : GOOGLE_LOGIN_SCOPES`). 일반 로그인 경로에서 `drive.file`이 요청되는 코드 경로 없음.

### 7. 설치 완료 사용자 재접속 시 `/app` 이동
`src/pages/LoginPage.tsx`: `useSession()` + `useInstallation()`으로 인증+설치 상태를 함께 확인 후 `navigate(installation ? '/app' : '/setup', { replace: true })`. 확인 중에는 로그인 버튼 대신 "로그인 상태를 확인하고 있습니다..." 표시(로그인 버튼이 잠깐이라도 노출되지 않음).

### 8. 중복 폴더·Spreadsheet 생성 방지
- **Spreadsheet**: `functions/_lib/installationStore.d1.ts`의 `claimSpreadsheet()`가 `UPDATE installation_progress SET spreadsheet_id = ? WHERE spreadsheet_id IS NULL`로 원자적 compare-and-swap을 수행. 경쟁에서 진 요청은 자신이 만든 Spreadsheet를 휴지통으로 보내고 정본 ID를 채택(`setupOrchestrator.ts` 286~337행). **동시 요청이 겹쳐도 최종적으로 살아있는 Spreadsheet는 항상 1개.**
- **루트 폴더/하위 폴더**: `findFolderByName` → 없으면 `createFolder` 패턴(이름 기준 조회 후 생성). 이미 만든 폴더는 재사용하지만, Spreadsheet와 달리 D1 레벨의 원자적 잠금은 없음 — **두 요청이 정확히 동시에 처음 설치를 시작하면 이론상 폴더가 중복 생성될 수 있는 좁은 경쟁 구간이 남아 있음**(8절 하단 "남은 위험" 참고). 실사용 시나리오(중복 클릭, 새로고침 재시도)에서는 낮은 확률.

### 9. 학생 데이터 미저장
`migrations/*.sql` 전체에 학생 이름·학년·반·상담 내용 등 학생 관련 컬럼 없음. D1에는 `users`(Google 프로필), `oauth_tokens`(암호화 토큰), `sessions`, `installations`/`installation_progress`(학교명·담당자명·schoolPublicId·리소스 ID·진행 상태)만 존재. 학생 데이터는 사용자 소유 Spreadsheet(`functions/_lib/installTemplate.ts`)에만 기록되며, 그 헤더 텍스트("학생정보" 탭의 `studentId`, `name` 등)는 D1이 아니라 Google Sheets API로 사용자 본인의 Spreadsheet에 직접 쓰여짐.

## 3. 검증 결과

```
npm run lint              → 통과 (경고/오류 없음)
npm run typecheck:functions → 통과
npm run build              → 통과 (vite build 성공)
```

## 4. 의도적으로 미완성 상태로 남긴 부분 (결함 아님)

이번 Milestone 1 범위(사용자가 정의한 "현재 완료 범위")에는 포함되지 않아 그대로 두었습니다.

- `src/pages/AppPage.tsx` — 대시보드 카드가 정적 샘플 데이터(`TODAY_SESSIONS` 등)이며 `PlaceholderNotice`로 "실제 Google Sheets 연동은 아직 연결되지 않았습니다"라고 명시. 실제 Sheets 데이터 읽기는 다음 Milestone(5절) 이후 과제.
- `src/pages/SettingsPage.tsx` — Gemini API Key 입력란은 저장 로직이 없고 `PlaceholderNotice`로 명시. `platform-v1-architecture.md`상으로도 원래 Milestone 6 과제.
- 자동화 테스트(unit/e2e)가 없음 — `package.json`에 `test` 스크립트 자체가 없음. lint/typecheck/build만으로 검증되는 상태.

## 5. 다음 Milestone

**Milestone 2는 기존 Google Spreadsheet(legacy) 스키마 분석과 표준화**로 진행합니다. 지금 설치 시 생성되는 18개 탭 헤더(`functions/_lib/installTemplate.ts`)는 `docs/database-schema.md`와 아키텍처 문서의 기본키/외래키만 반영한 최소 구조이며, `legacy/` 원본 코드(약 16,700줄)에서 실제 사용된 컬럼 전체를 역산해 반영하지는 않았습니다. Milestone 2에서 legacy 3개 프로젝트(`counseling-manager`/`intake-consent`/`taste-village`)의 실제 데이터 구조를 전수 분석하고, 이번 최소 스키마와 대조해 표준 스키마를 확정한 뒤 CRUD 구현(원래 로드맵의 M2)에 들어갑니다.

## 6. 남은 위험(비차단, 후속 조치 권장)

1. **루트/하위 폴더 생성에 원자적 잠금 없음**(위 8절) — Spreadsheet만큼 엄격하지 않음. 동시 설치 시도 시 폴더가 중복 생성될 이론적 가능성이 남아 있음. 발생 빈도가 낮다고 판단해 이번 범위에서는 보류.
2. **실제 Google 계정으로 A/B/C/D 테스트 시나리오를 직접 실행해 보지 못함** — 이 환경에는 OAuth 자격증명이 없어 코드 경로 검증까지만 수행. 운영 배포 후 실제 계정으로 1회 수동 확인 필요.
3. **Google OAuth 동의 화면이 아직 "Testing" 게시 상태로 추정**(`docs/google-oauth-setup.md` 6절) — 등록된 테스트 사용자 외에는 로그인 자체가 거부됨. 여러 학교로 확대하려면 Google 검증 절차가 필요(범위 밖, 운영 이슈).
4. **세션 TTL은 7일 고정, 활동 시 자동 연장 없음** — 만료 시 재로그인만 요구하므로 기능적 결함은 아니지만, 장기 세션이 필요해지면 갱신 정책 검토 필요.
5. **자동화 테스트 부재**(4절) — Milestone 2에서 스키마가 확정되면 CRUD 회귀를 지킬 테스트 도입을 권장.

## 변경 파일

- `docs/milestone-1-completion.md` (신규)
