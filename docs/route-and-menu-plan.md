# 메뉴 및 라우트 설계 v1

> **문서 상태**: 설계 확정(v1). 아직 코드 구현 없음.
> **관련 문서**: `docs/counseling-workflow-v1.md`, `docs/feature-priority-v1.md`.
> **현재 코드 기준선**: `src/router.tsx`(`/`, `/login`, `/setup`, `/app`, `/students`, `/settings`), `src/components/layout/Header.tsx`(`LOGGED_IN_NAV` = 관리자/학생관리/설정 3개).

## 1. 메뉴 구조

| 순서 | 메뉴명 | 라우트 | 구분 | 비고 |
|---|---|---|---|---|
| 1 | 대시보드 | `/app` | 주 | 기존 `AppPage`를 대시보드로 재정의(라우트 경로 변경 없음) |
| 2 | 상담접수 | `/intakes` | 주 | Milestone 2A |
| 3 | 보호자동의 | `/consents` | 주 | Milestone 3 |
| 4 | 진단·검사 | `/assessments` | 주 | Milestone 4 |
| 5 | 상담케이스 | `/cases` | 주 | Milestone 2B(자동생성) 이후 목록이 의미를 가짐 |
| 6 | 상담기록 | `/sessions` | 주 | Milestone 5 |
| 7 | 학생관리 | `/students` | **보조** | 기존 구현 유지, 메뉴 순서만 하단으로 이동 |
| 8 | 설정 | `/settings` | 부가 | 기존 구현 유지 |

- **학생관리 위치 확정**: 6개 주 흐름 메뉴 뒤, 설정 바로 앞. `counseling-workflow-v1.md` 6절과 일치.
- 메뉴 활성 상태 매칭은 기존에 고친 원칙을 그대로 따른다 — 각 메뉴는 자기 라우트 및 하위 경로에서만 활성화되고, 서로의 경로가 겹치지 않도록 최상위 세그먼트를 모두 다르게 유지한다(`/app`, `/intakes`, `/consents`, `/assessments`, `/cases`, `/sessions`, `/students`, `/settings` — 8개 모두 형제 관계, 중첩 없음).

## 2. 라우트 설계 (로그인 필요)

| 라우트 | 용도 | 화면 상태 | 대응 API(예정) |
|---|---|---|---|
| `/app` | 대시보드 — 신규 접수 알림, 진행 중 케이스 요약 | 기존 `AppPage` 재사용/확장 | (요약 조회 API는 각 마일스톤 완료 후 추가) |
| `/intakes` | 상담접수 목록 | 목록/필터 | `GET /api/intakes` |
| `/intakes/:intakeId` | 접수 상세, 승인/반려 | 상세 | `GET/POST /api/intakes/:intakeId`, `.../approve`, `.../reject` |
| `/consents` | 보호자동의 목록 | 목록/필터 | `GET /api/consents` |
| `/assessments` | 진단·검사 관리 | 목록/업로드 | `GET/POST /api/cases/:caseId/assessments` |
| `/cases` | 상담케이스 목록 | 목록/필터(학생/상태/담당자) | `GET /api/cases` |
| `/cases/:caseId` | 케이스 상세(연결된 학생 기본정보 포함) | 상세 | `GET /api/cases/:caseId` |
| `/sessions` | 상담기록(회기/목표) | 목록/작성 | `GET/POST /api/cases/:caseId/sessions` |
| `/students` | 학생관리(기존, 보조) | 기존 그대로 | 기존 `functions/api/students/**` |
| `/settings` | 설정(기존) | 기존 그대로 | 기존 설정 API |

## 3. 공개 라우트 (비로그인)

| 라우트 | 용도 | 인증 | 비고 |
|---|---|---|---|
| `/intake/:schoolPublicId` | 공개 상담신청 폼 | 없음 | `schoolPublicId`(=tenantId, 이미 D1 `installations`에 존재하는 값)로 대상 학교 스프레드시트 식별. 이 값이 URL에 노출되지만 쓰기 권한만 부여하고 읽기 권한은 없음 — QR로 공유되는 용도이므로 노출 자체는 설계 의도. |
| `/consent/:token` | 공개 보호자동의 제출 폼 | 없음 | `token`은 `consentToken`(긴 UUID). legacy의 "짧은코드"(10자리, 문자로 전달하기 쉬움)를 URL 대신 별도 입력란으로 지원할지는 미결정(`counseling-workflow-v1.md` 7절 미결정 2와 연계 — 토큰 만료 정책과 함께 결정). |

- 두 라우트 모두 `AuthGuard`를 적용하지 않는다 — 로그인 세션이 없는 사용자가 접근하는 것이 정상 동작이다.
- `RootLayout`을 그대로 쓸지, 공개 페이지 전용의 더 가벼운 레이아웃(로그인/메뉴 UI 없이)을 별도로 둘지는 구현 착수 시 결정 — 현재 `RootLayout`에 로그인 상태에 따른 메뉴 분기가 이미 있으므로(`Header.tsx`의 `LOGGED_OUT_NAV`), 우선은 그대로 재사용하는 쪽을 권장.

## 4. 기존 라우트와의 관계 (마이그레이션 영향)

- `/app`은 라우트 경로를 바꾸지 않고 "관리자 메인" → "대시보드"로 **의미만** 재정의한다. 코드 변경은 화면 콘텐츠 확장(신규 접수 알림 등)이며, 라우팅 구조 변경은 없다.
- `/students`, `/settings`는 라우트·기능 모두 변경 없음.
- 신규 라우트(`/intakes`, `/consents`, `/assessments`, `/cases`, `/sessions`와 각 상세/공개 라우트)는 전부 `src/router.tsx`의 `RootLayout` 자식으로 추가한다(기존 패턴 그대로).
- `Header.tsx`의 `LOGGED_IN_NAV` 배열 순서를 1절 표 순서대로 재구성한다 — 배열 순서 변경 외에 컴포넌트 구조 변경은 없음.

## 5. 라우팅 구현 시 참고사항

- **활성 메뉴 매칭 버그 재발 방지**: 과거 `/app`과 `/app/students`가 경로를 공유해 메뉴 두 개가 동시에 활성화되는 문제가 있었다(원인: `NavLink`의 `end` prop 누락 + 경로 중첩). 이번 8개 라우트는 처음부터 전부 형제 경로(중첩 없음)로 설계했으므로 같은 문제가 구조적으로 재발하지 않는다. 각 `NavLink`는 상세 라우트(`/cases/:caseId` 등)만 `end={false}`(하위 경로 매칭 허용), 나머지는 `end={true}`로 정확히 일치할 때만 활성화한다.
- **caseId/intakeId 등 상세 라우트 파라미터**: Cloudflare Pages Functions와 동일하게 프런트 라우트도 `:id` 형태의 동적 세그먼트를 쓴다 — 기존 `functions/api/students/[studentUuid]/*` 패턴과 명명을 맞춰 백엔드·프런트 라우트 파라미터명을 동일하게 유지한다(`intakeId`, `caseId`, `token`).
