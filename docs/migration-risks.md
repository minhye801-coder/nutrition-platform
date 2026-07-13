# 마이그레이션 위험 분석 (migration-risks)

> `legacy/` 코드 분석에서 확인된 위험을 기술적·보안적·데이터 이전 관점으로 분류하고 우선순위(P0=즉시 설계 반영 필요, P1=2~3단계 착수 전 해결, P2=이전 중 점진 대응)를 부여했습니다. 모든 위험은 구체적 파일/함수 근거를 가집니다.

## 1. 보안 위험

| 위험 | 근거 | 우선순위 | 대응 방안 |
|---|---|---|---|
| 보호자동의 token에 만료 시각이 없고, 재사용 방지가 "제출완료 상태"에만 의존 | `intake-consent/code.gs.txt:82-108, 133-135`, `validateToken_`(`308-312`)에 만료 체크 없음 | **P0** | 신규 설계 시 token에 발급시각+TTL(예: 72시간) 추가, 1회성 사용 후 즉시 무효화하는 별도 상태 컬럼/KV 저장소 도입 |
| taste-village 4자리 탐험코드 로그인에 무차별 대입 방어 없음 | `taste-village/code.gs:565-598`(`verifyStudentExplorerLogin`)에 시도 횟수 제한/지연 로직 없음 | **P0** | Cloudflare Workers 이전 시 IP/계정 기준 rate limiting 필수 적용 |
| counseling-manager 자체 및 taste-village의 Spreadsheet ID/Web App URL이 클라이언트 HTML에 정적 노출 | `counseling-manager/Index.html:470,488,500` | **P0** | 신규 아키텍처에서는 클라이언트에 리소스 ID를 전달하지 않고, 서버가 프록시하는 구조로 설계(`security-principles.md` 4항 참고) |
| Apps Script `doGet()`에 인증/도메인 검증 로직 부재, `appsscript.json` 부재로 실제 배포 권한(실행 계정/액세스 범위) 확인 불가 | `counseling-manager/code.gs.txt:1863-1868`, `taste-village/WebApp.gs:6-13` | **P1** | 실제 배포 설정 확인 후 문서화(추가 조사 필요, `current-system-analysis.md` 갱신), 신규 아키텍처는 Google OAuth로 명시적 인증 |
| 보호자 개인정보(연락처, 동의여부, 민감정보 동의 등)가 Google Sheets에 평문 저장 | `intake-consent/code.gs.txt` `appendObject_`/`updateRowByKey_` 전반 | **P1** | 시트 공유 설정 감사 + 신규 저장소 이전 시 최소한의 필드 암호화 또는 접근통제 강화 검토 |
| 테스트 데이터 정리 기능이 실서비스 삭제와 동일 코드 경로 사용, 이중 확인/권한 분리 없음 | `counseling-manager/code.gs.txt:6139`(`deleteSelectedTestData`), `6451`(`trashTestCleanupDriveItems_`) | **P1** | 신규 아키텍처에서는 관리자 권한 분리 + 명시적 확인 절차(예: 케이스ID 재입력) 요구 |
| Gemini API 키 등록이 브라우저 `ui.prompt` 사용 — 코드 자체 취약점은 아니나 운영 실수 노출 여지 | `counseling-manager/code.gs.txt:1846-1856` | **P2** | 관리자 설정(`/setup`) 화면에서 마스킹 입력 + 서버 저장으로 대체 |

## 2. 범용화(멀티테넌시) 위험

| 위험 | 근거 | 우선순위 | 대응 방안 |
|---|---|---|---|
| taste-village가 특정 학교(스프레드시트 ID, 학교명, NEIS 코드)에 강결합 — 다른 학교용으로 복제 시 값 치환 누락 위험 | `taste-village/code.gs:14,118`, `MealApi.gs:9-11` | **P0** | 3단계(학교별 시트/폴더 자동 생성) 설계 시 이 모든 값을 tenant 설치 스크립트가 자동 주입하도록 함 |
| counseling-manager가 taste-village 스프레드시트를 직접 `openById`로 열어 양방향 쓰기 — 학교마다 사본을 만들 경우 ID 치환을 놓치면 다른 학교 데이터가 원본 시트에 계속 동기화될 수 있음 | `counseling-manager/code.gs.txt:30-31, 1409-1569`(`syncTasteMindCase_`) | **P0** | 스프레드시트 직접 참조 방식을 폐기하고, tenant 설정에서 조회한 ID만 사용하도록 강제 + 설치 시 원본 기본값 폴백 제거 |
| counseling-manager와 intake-consent가 물리적으로 동일 스프레드시트를 공유 — 두 프로젝트를 별도로 복제하면 ID 불일치로 연동이 끊길 위험 | `intake-consent/code.gs.txt:7`(`DATA_SPREADSHEET_ID`) vs `counseling-manager/Index.html:488` (마스킹값 동일 확인) | **P0** | 3단계에서 두 역할을 하나의 tenant 초기화 절차로 통합(동일 스프레드시트 ID를 두 모듈에 동시 주입) |
| 이름 기반 학생 매칭(정규화만, 오탈자/동명이인 미방지)이 counseling-manager와 taste-village 양쪽에서 반복 사용 | `counseling-manager/code.gs.txt:5842-5851`(`findStudent_`), `taste-village/code.gs:565-598` | **P1** | studentId를 1차 키로 강제하고 이름은 보조 검증으로만 사용하도록 재설계 |
| 운영자 Drive에 여러 학교 파일이 섞일 가능성 — `ROOT_FOLDER_ID`가 없으면 스크립트 실행 계정의 Drive 루트에 자동 생성 | `counseling-manager/code.gs.txt:5815-5823`(`createCaseFolder_`) | **P1** | 신규 아키텍처에서는 각 tenant(학교) 소유 Google 계정의 Drive에만 폴더가 생성되도록 OAuth 위임 구조로 전환(`security-principles.md` 2항과 정합) |
| `?k=` 짧은링크 처리 코드가 intake-consent `doGet`에서 확인되지 않음(생성부-소비부 불일치 의심) | `counseling-manager/code.gs.txt:3497-3500` vs `intake-consent/code.gs.txt:17-25` | **P1** | 실제 배포본에서 동작 여부 재검증 후 신규 설계에 반영 |
| 공개 상담신청 페이지에 스팸/중복 제출 방지가 허니팟 필드뿐, rate limiting·중복 신청 검사 없음 | `intake-consent/code.gs.txt:37,111`, `nextIntakeId_`(`255-266`)에 중복검사 없음 | **P2** | Cloudflare Workers 이전 시 Turnstile 등 봇 방지 + 동일 학생 중복 신청 감지 로직 추가 |

## 3. 데이터 이전 위험

| 위험 | 근거 | 우선순위 | 대응 방안 |
|---|---|---|---|
| `생성문서`(SHEETS.DOCS) 시트의 실제 쓰기 주체 불명 — 이전 대상에서 누락되거나 잘못 매핑될 위험 | `counseling-manager/code.gs.txt:3180`(읽기만 존재) | **P1** | 실제 운영 스프레드시트 확인 후 용도 재조사(`current-system-analysis.md` 후속 항목) |
| `legacy/sheet-structure/`에 실제 시트 스키마 원본이 없어 문서가 코드 역산에 의존 — 실제 운영 데이터와 컬럼 순서/추가 컬럼이 다를 수 있음 | `legacy/sheet-structure/README.md`만 존재, 원본 파일 없음 | **P0** | 실제 운영 스프레드시트의 헤더 export(값은 마스킹/샘플화)를 `legacy/sheet-structure/`에 추가 요청 |
| Apps Script `LockService` 기반 동시성 제어가 데이터 저장소를 DB로 이전할 경우 함께 재설계 필요 | `intake-consent/code.gs.txt:44-45`(`waitLock`) | **P2** | DB 전환 시 트랜잭션/유니크 제약으로 대체 |
| NEIS 급식 API 키 전송이 URL 쿼리 파라미터 방식 — 저장소 이전과 무관하지만 API 호출 계층 이전 시 같은 패턴을 답습하면 로그 노출 위험 지속 | `taste-village/MealApi.gs:328` | **P2** | Cloudflare Workers로 이전 시 헤더 기반 인증으로 교체 검토 |

## 4. Cloudflare 이전 시 깨질 가능성이 있는 기능

| 기능 | 근거 | 이유 |
|---|---|---|
| Google Docs→PDF 변환(`createConsentPdf_`) | `intake-consent/code.gs.txt:183-217` | `DocumentApp`/`DriveApp` API는 Apps Script 전용, Cloudflare Workers에는 동등 API 없음 — Google Docs/Drive REST API로 재구현 필요 |
| 나이스 업로드 엑셀 생성(`createNeisUploadExcel`) | `counseling-manager/code.gs.txt:5716-5806` | Drive REST export API 호출 방식 자체는 이식 가능하나, `SpreadsheetApp.create` 임시 파일 생성 패턴은 Sheets API로 재작성 필요 |
| 효과평가 Google Form 자동 생성/연동 | `counseling-manager/code.gs.txt:307,415,572` | `FormApp`은 Apps Script 전용 API — Forms API(Google Workspace API)로 대체하거나 초기에는 Apps Script 유지 권장 |
| 스프레드시트 직접 열람(`openById`) 기반 프로젝트 간 동기화 | `counseling-manager/code.gs.txt:1296-1334, 1409-1569` | Cloudflare Workers는 Sheets API를 REST로 호출해야 하며, 현재처럼 "같은 Apps Script 런타임 안에서 다른 스프레드시트를 열람"하는 방식은 성립하지 않음 — API 기반 재설계 필수 |

## 5. 우선순위 요약

- **P0(즉시 설계 반영)**: 토큰 만료/재사용, 탐험코드 무차별 대입 방어, 클라이언트 ID 노출 제거, taste-village 학교 종속값 자동 주입, 두 프로젝트 스프레드시트 공유 구조의 tenant화, 실제 시트 스키마 원본 확보
- **P1(2~3단계 착수 전)**: 배포 권한 확인, 이름 기반 매칭 재설계, Drive 루트 폴더 격리, 짧은링크 불일치 재검증, 삭제 기능 권한 분리, 생성문서 시트 용도 재조사
- **P2(이전 중 점진 대응)**: 공개폼 스팸 방지 강화, Gemini 키 입력 UX 개선, NEIS 키 전송 방식 개선, LockService 대체
