# 아키텍처 검토 요약 (architecture-review-summary)

> `platform-v1-architecture.md`의 설계를 바탕으로, Milestone 1 착수 전 의사결정에 필요한 핵심만 정리한 문서입니다. 세부 설계 근거(legacy 코드 분석, 보안 위험 대응 등)는 `platform-v1-architecture.md`를 참고하세요.

## 1. 최종 추천 아키텍처

- 하나의 공용 사이트(Cloudflare Pages + Functions)에서 여러 학교 영양교사가 각자 Google 계정으로 로그인.
- Functions는 로그인한 교사의 OAuth token으로 **그 교사 본인의** Google Sheets/Drive에만 접근(운영자 계정 경유 없음).
- tenant(학교) 1개당 Spreadsheet 1개 + Drive 폴더 구조 자동 생성.
- Docs 생성/PDF 변환만 초기에는 공용 Apps Script 보조 서비스(플랫폼이 1회 배포, 요청자 신원으로 실행)에 유지하고 점진적으로 Cloudflare로 이관.
- Gemini API Key는 Cloudflare 서버측 암호화 저장소에 tenant별로 저장(방식 B), 평문 시트 저장(방식 C)은 채택하지 않음. 단 이 저장소는 D1이 아니라 D1과 분리된 별도 저장소다(아래 무료 운영 정책 참고).
- **무료 운영 우선**: Cloudflare/Google/Gemini 모두 무료 한도 안에서 동작을 전제로 설계하며, 한도 초과 시 자동 유료 전환은 하지 않는다. 세부는 6절과 `platform-v1-architecture.md` 18절 참고.

## 2. Milestone 1의 정확한 범위

**포함**: 기본 화면 뼈대(`/`,`/login`,`/setup`,`/app`) · Google 로그인 · 최초 설치(Spreadsheet+Drive 자동 생성, Gemini Key 제외) · 설치 상태 저장 · `설정`/`학생정보` 탭 읽기 · 로그아웃/연결 해제.

**제외**: 맛마을 탐험소, 상담신청, 보호자동의, Gemini 연동, 데이터 가져오기(`/import`), 나머지 탭 전체 CRUD.

**무료 운영 정책 반영**: 정적 화면(`/`)은 Functions를 호출하지 않는다. 세션/설치 정보를 D1으로 옮길 때는 `userId`·`tenantId`·`installationId`·설치 상태·Spreadsheet ID·Drive Folder ID·암호화된 OAuth token·공개 링크 식별자·생성일·수정일 9개 필드만 저장한다(6절).

## 3. 반드시 지금 결정해야 할 사항

1. 프론트엔드 프레임워크
2. Cloudflare Pages+Functions 구조 vs 별도 Workers 서비스
3. Google OAuth 토큰 저장 위치(기술)
4. 사용자별 설치정보(installationId/tenantId) 저장 위치
5. 사용자 Drive에 시트·폴더를 만드는 방식(REST 직접 호출 vs Apps Script 경유)
6. 한 사용자당 tenant 허용 개수(1:1 vs 1:N)
7. Apps Script를 공용 보조 서비스로 둘지, tenant마다 복사할지(방향성)

## 4. 나중으로 미뤄도 되는 사항

- Gemini API Key 저장의 세부 구현(암호화 알고리즘, 키 로테이션, 유효성 검사) — M6
- Apps Script 보조 서비스의 정확한 배포 옵션(실행 계정 설정, 추가 동의 화면 여부) — M5 착수 전
- tenant를 교사 여러 명이 공유하는 기능의 초대/권한 UI
- `/import` 데이터 가져오기 저장 구조 — M7
- 상담신청·맛마을 스팸 방지 구체 솔루션(Turnstile 등) — M3/M4
- 보호자동의 재제출 정책 세부 — M5
- 무료 사용량 70% 경고의 실제 집계 방식(Cloudflare Analytics 연동 여부 등) — D1/모니터링 연동 시점
- Gemini 무료 지원 모델 목록·기본값의 구체 확정, 사용자별 일일 호출 제한 기본 수치 — M6
- 무료 한도 초과 시 "읽기 전용 전환" UX, 재시도 큐/임시저장 구조 — 후속 검토

## 5. 추천안과 근거

| 항목 | 추천안 | 근거 | 잘못 결정 시 재작업 위험 |
|---|---|---|---|
| 프론트엔드 프레임워크 | React + Vite 단일 SPA(인증 화면과 공개 폼 통합, 공개 라우트는 인증가드만 생략) | 빌드 파이프라인 하나로 M1 범위에 충분, 인증 상태 공유가 단순해짐 | 중 — UI 레이어 재작성, 라우팅/인증가드가 프레임워크에 결합돼 있으면 비용 커짐 |
| Pages vs Workers 구조 | Cloudflare Pages + Pages Functions 단일 프로젝트 | 설계 문서 구성도가 이미 이 형태, Pages Functions도 Workers 런타임 기반이라 후속 분리가 기계적으로 가능 | 낮음 — 배포 토폴로지만 바뀜, 비즈니스 로직 영향 적음 |
| OAuth 토큰 저장 위치 | Cloudflare D1(SQLite) | 관계형 구조(installationId·tenantId·암호화 refresh token) 조회/조인에 적합, KV보다 조건 조회에 유리 | **높음** — 운영 중 저장소 교체 시 암호화 토큰 이전·재인증 유도 필요 |
| 설치정보 저장 위치 | 같은 D1 안에서 `installations` 테이블을 `oauth_tokens` 테이블과 분리 | 같은 저장소, 다른 테이블로 두면 스키마 확장(6번 tenant 1:N 등)에 유리 | 높음 — 위 항목과 동일한 저장소 마이그레이션 비용 |
| Drive/Sheets 생성 방식 | Functions가 Sheets API v4 / Drive API v3를 REST로 직접 호출, Apps Script 경유 안 함 | 폴더·시트 생성은 REST로 충분히 단순, Apps Script는 Docs/PDF 생성(M5)에만 필요 — 단계적 이관 원칙 유지 | 중 — 설치 흐름 한 곳에 국한, 재작업 범위 좁음 |
| tenant 개수 | v1은 1 user = 1 tenant로 제한, 단 저장소는 `user → installation` 조회 테이블 형태로 구성 | 조회 테이블로 두면 향후 1:N 확장 시 로그인 로직 재작성 불필요 | **가장 높음** — 로그인 리다이렉트/URL 구조/모든 화면의 데이터 조회 가정이 이 위에 세워짐, M2 이후 변경 시 전체 프론트엔드 영향 |
| Apps Script 공용 vs 복사 | 공용 방향 확정(플랫폼 1회 배포, 요청자 신원으로 실행), 세부 배포 옵션은 M5에서 결정 | 지금 방향만 정해도 M1 설치 흐름에 Apps Script 프로비저닝이 불필요함이 확실해짐 | 높음 — M5에서 공용 모델이 기술적으로 막히면 이미 설치된 전체 tenant에 소급 재프로비저닝 필요 |
| D1 저장 범위 | `userId`·`tenantId`·`installationId`·설치 상태·Spreadsheet ID·Drive Folder ID·암호화된 OAuth token·공개 링크 식별자·생성일·수정일 9개 필드만 저장. Gemini Key/tenant 설정값/감사로그는 D1에 두지 않음 | D1 무료 한도(저장 용량, 일일 읽기/쓰기 행 수)를 여유 있게 유지하고, 학생 데이터가 플랫폼 서버에 남지 않는다는 보안 원칙을 스키마 수준에서 강제 | 중 — 스키마를 넓히는 것 자체는 컬럼 추가로 가능하지만, "D1은 최소 메타데이터만"이라는 원칙을 어기기 시작하면 이후 절제가 어려워짐 |

## 6. 무료 운영 우선 정책 핵심

전체 근거와 서비스별 비교표는 `platform-v1-architecture.md` 18절 참고. 여기서는 결정 요지만 정리한다.

- **Cloudflare**: Pages/Functions 무료 한도 안에서 운영, 정적 화면은 API 미호출, 클라이언트/서버 캐시로 중복 조회 방지, 사용량 70% 도달 시 관리자 경고 구조 준비, 한도 초과 시 자동 유료 전환 금지.
- **D1**: 위 9개 필드만 저장(2절 참고). 학생 이름·상담 내용·보호자동의 원문·검사 결과 원문·생성문서 내용은 절대 저장하지 않음.
- **Google API**: 전체 재조회 대신 batchGet/batchUpdate, lazy loading, 세션 캐시, 변경분만 재조회, 429는 exponential backoff, Drive 목록 전체 조회 금지.
- **Google OAuth**: 로그인(openid/email/profile)과 Drive/Sheets 권한을 단계적으로 요청, `drive.file` 우선 검토, 연결 해제 지원, 해제 후에도 사용자 Drive 데이터 유지.
- **Gemini**: 사용자 본인 Key만 사용(운영자 Key 공용 금지), 무료 모델 기본값·유료 모델 목록 제외, 호출 전 무료/유료 안내, 일일 호출 제한을 설정 가능하게 준비.
- **비용 방지**: Cloudflare/Google 유료 전환 자동화 금지, 결제 계정 연결을 M1 필수로 두지 않음, 비용 발생 가능 기능은 코드/UI에 경고, 유료 기능은 관리자가 직접 켜야 동작.
- **Codespaces**: 미사용 시 중지 안내, 기본 2코어, 대용량 파일/캐시 커밋 금지.
- **한도 초과 시**: 자동 결제 대신 차단 또는 읽기 전용 전환, 관리자 안내, 사용자 Google 데이터는 손상시키지 않음.
