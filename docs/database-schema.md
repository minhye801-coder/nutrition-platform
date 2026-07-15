# 데이터베이스 스키마 (Google Sheets 기반)

> **Single Source of Truth**: `functions/_lib/installTemplate.ts`. 이 문서는 그 파일이 실제로 생성하는 탭/헤더를 그대로 옮겨 적은 것이며, 코드와 문서가 어긋나면 **코드가 맞다**. 이전 초안(영문 탭명 `Tenants/Students/Cases/...`을 쓰던 버전)은 실제 설치 코드와 충돌해 전량 폐기했다 — 실제로는 어떤 화면·API도 그 초안을 사용한 적이 없다.
>
> 학생 데이터는 각 학교(사용자) 소유의 Google Sheets에만 저장되며, Cloudflare D1에는 저장하지 않는다(`docs/security-principles.md`, `migrations/*.sql`에 학생 관련 컬럼 없음으로 확인됨). 이 문서는 그 Google Sheets 쪽 스키마만 다룬다.

## 0. 현재 상태 요약

- 설치 시(`functions/_lib/setupOrchestrator.ts` → `buildInitialValueRanges`) 아래 18개 탭과 헤더 행이 사용자의 Spreadsheet에 **1회** 기록된다.
- **이 문서 작성 시점(Milestone 2 착수 직전)에는 이 18개 탭을 읽거나 쓰는 CRUD API·화면이 하나도 구현되어 있지 않다.** 헤더만 존재하고 데이터 행은 비어 있다. 각 탭의 "사용 API"/"사용 화면"은 전부 "없음"이며, 이후 마일스톤에서 기능이 구현될 때마다 이 문서를 갱신한다.
- fieldName은 헤더 텍스트 자체다(예: `studentUuid`) — 화면 표시용 한글 라벨과 코드용 fieldName을 분리하지 않고, 카멜케이스 영문 헤더 하나를 화면·코드 양쪽에서 그대로 쓴다. 이는 애초 설계 원칙("화면용 한글 헤더와 코드용 fieldName을 분리")과 다르게 이미 구현·배포된 상태이며, 지금 바꾸려면 기존 설치본 헤더 마이그레이션이 필요하다 — **결정 필요 항목**으로 하단에 표시.
- 열 접근은 헤더명 기반이어야 한다(행 번호·열 위치 하드코딩 금지). 현재 CRUD가 없어 아직 코드로 확인할 대상은 없지만, Milestone 2 구현 시 지켜야 할 원칙으로 유지한다.
- `tenantId` 값은 D1 `installations.school_public_id`(=`schoolPublicId`)를 그대로 사용한다. 별도 tenantId 발급 체계는 없다.
- Gemini API Key는 어떤 탭에도 저장하지 않는다(설치 코드에서 이미 강제, `buildInitialValueRanges` 참고).
- **schemaVersion 확정**: `설정` 탭에 `schemaVersion`(탭/헤더 구조 버전, 이 문서의 구조가 바뀔 때마다 올림)과 `updatedAt`(설정 값 최종 수정 시각)을 새로 추가한다. 기존 `installationVersion`은 "앱 버전" 개념으로 유지한다(설치 시점의 플랫폼 빌드 버전 — schemaVersion과는 별개 축). 2.1절 참고.

## 1. 핵심 식별자 원칙

- 행 번호를 식별자로 쓰지 않는다.
- 이름·학년·반 조합만으로 학생(또는 다른 엔터티)을 연결하지 않는다 — legacy `findStudent_`가 정확히 이 방식으로 학생을 찾다가 이름 표기 차이로 중복 학생코드를 만들거나(false negative), 번호가 비어 있으면 동명이인을 같은 학생으로 오판(false positive)하는 사고가 코드상 확인됨(`docs/database-schema-analysis.md` 예정 문서 참고 — 이번 분석 원본 근거는 아래 3절 요약).
- 각 핵심 엔터티(학생/접수/케이스/회기/목표/평가/측정/준비/일정/문서 등)는 영구 고유 ID를 갖는다. 현재 헤더에는 `xxxId` 컬럼이 모두 있지만, **ID를 실제로 생성하는 코드는 아직 없다**(CRUD 미구현). Milestone 2 구현 시 `crypto.randomUUID()` 기반 UUID로 생성할 것을 권장(legacy의 순번 카운터 방식은 잠금 없는 동시성 위험이 있었음, 3절 참고).
- 모든 하위 엔터티는 `tenantId` 컬럼을 포함한다(이미 전 탭에 반영됨).
- **관계 연결 확정**: 모든 관계는 `studentUuid → caseId → sessionId` 순서로만 연결한다(학생 → 케이스 → 회기, 그 아래 목표/점검/평가/측정/준비도 caseId·sessionId를 통해서만 연결). 이름·학년·반으로 레코드를 찾거나 병합하는 코드는 어떤 기능에서도 금지한다(3절 legacy 사고 사례 참고).

## 2. 탭 목록과 헤더 (SSOT: `installTemplate.ts`)

각 탭은 아래 공통 규칙을 따른다: 내부 sheetKey = 탭명(한글) 그대로, 열 순서 = 아래 표 순서, fieldName = 헤더명과 동일.

### 2.1 설정

키-값 저장 구조이므로 열(컬럼) 자체는 `키`/`값` 둘뿐이고, 아래는 `키`에 올 수 있는 값 목록이다.

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 개인정보 | 설명 |
|---|---|---|---|---|---|
| 1 | `키` | string | Y | N | 설정 키 |
| 2 | `값` | string | Y | 키에 따라 다름 | 설정 값. Gemini API Key는 어떤 키로도 저장하지 않는다(코드로 강제됨) |

**키 목록(확정)**:

| 키 | 설명 |
|---|---|
| `schoolName` | 학교명 |
| `managerName` | 담당자명 |
| `schoolPublicId` | = tenantId |
| `installationVersion` | 앱 버전(설치 시점 플랫폼 빌드 버전) |
| `schemaVersion` | **신규.** 이 문서(탭/헤더 구조)의 버전. 구조가 바뀔 때마다 올려서, 이후 자동 마이그레이션 로직이 "이 스프레드시트가 몇 번째 구조인지" 판단하는 근거로 쓴다 |
| `createdAt` | 최초 설치(생성) 시각 |
| `updatedAt` | **신규.** 설정 값이 마지막으로 갱신된 시각 |

- **사용 API**: `POST /api/setup/start`(설치 시 1회 기록만, 조회 API 없음). `schemaVersion`/`updatedAt`을 실제로 채워 넣는 코드는 아직 없음 — 이번엔 스키마 확정만, 구현은 후속 작업. **사용 화면**: 없음.
- **기존 필드 출처**: legacy `설정` 시트(`설정 키`/`설정 값` + 용도 불명 3번째 열, `getSettings_`/`setSetting_`)와 목적은 동일하나 legacy는 `PUBLIC_APP_URL`/`GEMINI_MODEL`/`ROOT_FOLDER_ID`/`SCHOOL_NAME`/`CASE_PREFIX`/`STUDENT_PREFIX` 등 훨씬 많은 운영 설정 키를 가짐 — v1은 그중 필요한 것만 우선 반영.
- **탭 이름 확정**: `설정`으로 그대로 유지한다(리네임하지 않음, 확정).
- **확인 필요**: legacy 설정 시트의 3번째 열(코드에서 이름이 한 번도 안 나오고 `'자동 생성'` 리터럴만 써짐) 용도 불명.

### 2.2 학생정보 (필드 확정 — Milestone 2 첫 CRUD 구현 대상)

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `studentUuid` | string(UUID) | Y | Y(PK) | N | **학생 영구 식별자(확정, `studentId`에서 개명).** `crypto.randomUUID()`로 생성. 모든 하위 엔터티가 이 값으로만 학생을 참조한다 — 이름·학년·반으로 연결 금지(1·3절) |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `name` | string | Y | N | **Y** | 학생 성명 |
| 4 | `grade` | string(**확정**) | Y | N | Y(준식별자) | 학년 |
| 5 | `class` | string(**확정**) | Y | N | Y(준식별자) | 반 |
| 6 | `studentNumber` | string(**확정**) | N | N | Y(준식별자) | 반 내 번호(legacy `번호`) |
| 7 | `enrollmentStatus` | string(enum, **확정**) | Y | N | N | 재학상태. 신규 등록 시 기본값 `재학`, 비활성 처리 시 `비활성`으로 변경(행을 삭제하지 않는 소프트 삭제) |
| 8 | `createdAt` | string(ISO datetime) | Y | N | N | 등록일시 |
| 9 | `updatedAt` | string(ISO datetime) | Y | N | N | 수정일시 |

- **자료형 결정**: `grade`/`class`/`studentNumber`는 **string으로 통일**한다(구현 시점 결정) — Google Sheets API가 값을 기본적으로 문자열로 반환하고, "05반"처럼 앞자리 0이 있는 표기를 다룰 수 있어 숫자 강제 변환을 하지 않는다.
- **사용 API**: `GET/POST /api/students`, `PATCH/DELETE /api/students/:studentUuid`(아래 5절 API 문서 참고). **사용 화면**: 없음(API만 구현, 화면은 후속).
- **기존 필드 출처**: legacy `학생정보`(`학생코드, 학년도, 학년, 반, 번호, 학생명, 재학상태, 등록일, 비고`)에서 `학생코드→studentUuid`(ID 생성 방식은 legacy의 순번 카운터 대신 UUID로 교체), `학년→grade`, `반→class`, `번호→studentNumber`, `재학상태→enrollmentStatus`, `학생명→name`, `등록일→createdAt`로 대응.
- **확인 필요**: `학년도`(school year) 추가 여부(이번 확정 범위엔 포함 안 됨), `enrollmentStatus`의 `재학`/`비활성` 외 세부 값(휴학/전출/자퇴 등) 확장 여부.

### 2.3 상담접수

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `intakeId` | string(UUID) | Y | Y(PK) | N | 접수 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `studentUuid` | string | N | N | N(FK) | 승인 전에는 비어 있을 수 있음 → `학생정보.studentUuid` |
| 4 | `status` | string(enum, 값 미정) | Y | N | N | 접수 처리 상태 |
| 5 | `submittedAt` | string(ISO datetime) | Y | N | N | 신청 제출 시각 |
| 6 | `updatedAt` | string(ISO datetime) | Y | N | N | 상태 변경 시각 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `상담접수`(`접수ID, 접수일, 신청자유형, 신청자명, 학생과의관계, 학년도, 학년, 반, 번호, 학생명, 상담주제, 신청내용, 연락처, 개인정보동의, 처리상태, 학생코드, 비고`)는 v1보다 훨씬 상세하다. v1은 신청자명/연락처/신청내용 등 원문 필드 자체가 없음(신청 폼을 아직 설계하지 않았기 때문 — Milestone 4 범위).
- **확인 필요**: `status` enum 값 목록, 신청자 정보(이름·연락처·관계)를 이 탭에 직접 둘지 별도 탭으로 뺄지 — Milestone 4(상담신청)에서 결정.

### 2.4 보호자동의

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `consentId` | string(UUID) | Y | Y(PK) | N | 동의 레코드 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `intakeId` | string | N | N | N(FK) | `상담접수.intakeId` |
| 4 | `caseId` | string | N | N | N(FK) | `상담케이스.caseId`. intakeId/caseId 중 최소 1개 필요 |
| 5 | `consentToken` | string | Y | Y | 보안 민감 | 공개 동의 링크용 토큰(추측 불가능해야 함) |
| 6 | `status` | string(enum, 값 미정) | Y | N | N | 동의 진행 상태 |
| 7 | `requestedAt` | string(ISO datetime) | Y | N | N | 동의 요청 발송 시각 |
| 8 | `respondedAt` | string(ISO datetime) | N | N | N | 보호자 응답 시각 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `보호자동의`는 `보호자명, 학생과의관계, 보호자연락처, 학생참여의사, 상담동의, 개인정보동의, 민감정보동의, 진단결과활용동의, AI보조안내확인, 동의서파일URL, 짧은코드` 등 v1에 없는 필드가 매우 많음(4절).
- **확인 필요**: 보호자 이름/연락처를 이 탭에 저장할지, 동의서 PDF 링크(driveFileId류)를 저장할지 — Milestone 5(보호자동의) 결정 필요.

### 2.5 상담케이스

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `caseId` | string(UUID) | Y | Y(PK) | N | 상담 케이스 식별자(허브 테이블) |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `studentUuid` | string | Y | N | N(FK) | `학생정보.studentUuid` |
| 4 | `status` | string(enum: `진행중`/`보류`/`종결`, **확정**) | Y | N | N | 케이스 진행 상태 |
| 5 | `openedAt` | string(ISO datetime) | Y | N | N | 개설일 |
| 6 | `closedAt` | string(ISO datetime) | N | N | N | 종결일 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `상담케이스`(`케이스번호, 학생코드, 접수ID, 접수일, 신청경로, 주상담주제, 현재단계, 다음일정, 담당자, Drive폴더URL, 종결일, 비고`). legacy `현재단계`는 8단계 세분화 enum이었으나(`동의 대기→진단 대기→결과 확인→상담 예정→실천 중/추적상담 예정→종결 검토→종결`), v1 `status`는 **`진행중`/`보류`/`종결` 3단계로 단순화 확정**.
- **확인 필요**: `주상담주제`/`담당자`/`Drive폴더URL`(케이스별 하위 폴더) 추가 여부 — 이번 확정 범위 아님.

### 2.6 진단결과

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `assessmentId` | string(UUID) | Y | Y(PK) | N | 진단 레코드 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `caseId` | string | Y | N | N(FK) | `상담케이스.caseId` |
| 4 | `round` | string/number(확인 필요) | N | N | N | 검사 차수 |
| 5 | `timepoint` | string(enum: `사전`/`사후`, legacy 확인됨) | Y | N | N | 평가 시점 |
| 6 | `createdAt` | string(ISO datetime) | Y | N | N | 기록 시각 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `진단결과`는 신체계측(신장/체중/BMI 등)·식습관·수면·정신건강·스마트폰 의존도까지 47개 컬럼을 가진 이 시스템에서 **가장 민감한** 탭이다(3·4절). v1은 식별자 4개뿐이라 실제 진단 데이터를 넣을 자리가 없음 — Milestone 2 이후 최우선 확장 후보.
- **확인 필요**: 47개 legacy 컬럼 중 실제로 필요한 것만 추리는 작업이 별도로 필요(이번 문서에서 추측으로 확정하지 않음).

### 2.7 상담회기 — **보류 (SOAP/PES 필드 구성은 상담기록 구현 단계에서 재검토)**

SOAP/PES 구조 자체(주관적/객관적/평가/계획 4단, 문제/원인/징후 3단)를 유지한다는 방향은 정했지만, 아래 7개 열 구성은 **확정이 아니라 제안**이다. legacy는 SOAP/PES를 각각 한 셀에 구분자로 이어붙여 저장하고 정규식으로 다시 잘라 썼는데(분석 3·H절에서 "섹션 라벨이 내용과 겹치면 깨질 수 있음"으로 지적된 취약점), 아래는 그 취약점을 피하려고 열을 분리하는 안이다 — 실제 상담기록 화면을 구현하는 마일스톤에서 다시 검토한 뒤 확정한다. **이번 Milestone 2 학생정보 CRUD 구현에는 이 탭이 포함되지 않는다.**

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `sessionId` | string(UUID) | Y | Y(PK) | N | 회기 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `caseId` | string | Y | N | N(FK) | `상담케이스.caseId` |
| 4 | `sessionDate` | string(ISO date) | Y | N | N | 상담일 |
| 5 | `soapSubjective` | string(자유서술) | N | N | **Y** | SOAP – 주관적 정보(학생 진술) |
| 6 | `soapObjective` | string(자유서술) | N | N | **Y** | SOAP – 객관적 정보(교사 관찰) |
| 7 | `soapAssessment` | string(자유서술) | N | N | **Y** | SOAP – 평가 |
| 8 | `soapPlan` | string(자유서술) | N | N | **Y** | SOAP – 계획 |
| 9 | `pesProblem` | string(자유서술) | N | N | **Y** | PES – 문제(Problem) |
| 10 | `pesEtiology` | string(자유서술) | N | N | **Y** | PES – 원인(Etiology) |
| 11 | `pesSigns` | string(자유서술) | N | N | **Y** | PES – 징후/증상(Signs/Symptoms) |
| 12 | `createdAt` | string(ISO datetime) | Y | N | N | 기록 시각 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `상담회기`의 SOAP/PES 통합 서술(한 셀에 구분자로 이어붙임) → v1은 7개 하위 필드로 분리. legacy의 `학생주요호소`/`학생이말은원인`/`학생강점`/`교사관찰`/V37·V38 추가분(교사추천활동 등)은 이번 확정 범위에 포함하지 않음(4절).
- **보류(확인 필요)**: SOAP/PES 필드 구성 전체가 상담기록 구현 단계 재검토 대상. `교사추천활동` 등 V37/V38 추가 필드 이식 여부도 그때 함께 결정.

### 2.8 실천목표

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `goalId` | string(UUID) | Y | Y(PK) | N | 목표 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `caseId` | string | Y | N | N(FK) | `상담케이스.caseId` |
| 4 | `sessionId` | string | N | N | N(FK) | `상담회기.sessionId` |
| 5 | `content` | string(자유서술) | Y | N | **Y** | 목표 내용 |
| 6 | `currentStatus` | string(enum: `진행중`/`완료`/`중단`, **확정**) | Y | N | N | **신규.** 목표 진행 상태(화면 표시명: 현재상태) |
| 7 | `createdAt` | string(ISO datetime) | Y | N | N | 기록 시각 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `실천목표`(`목표문장, 시작일, 종료일, 목표횟수, 실제횟수, 달성률, 결과, 확인방법, 학생소감, 어려움, 도움요인, 다음결정, 다음상담일`) — `결과`가 `currentStatus`와 개념상 가장 가깝다. 목표 기간(시작/종료일)·달성률·점검 이력은 v1에는 아직 없음(목표점검 탭이 별도로 있음, 2.9절).
- **확인 필요**: 목표 기간(시작/종료일)과 달성률 컬럼 추가 여부 — 이번 확정 범위 아님.

### 2.9 목표점검

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `checkId` | string(UUID) | Y | Y(PK) | N | 점검 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `goalId` | string | Y | N | N(FK) | `실천목표.goalId` |
| 4 | `checkedAt` | string(ISO datetime) | Y | N | N | 점검 시각 |
| 5 | `result` | string(자유서술/enum 확인 필요) | Y | N | **Y** | 점검 결과 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `목표점검`은 `GOAL_CHECK_HEADERS`와 정확히 일치하는 구조(확인됨) — v1과 열 구성이 가장 근접한 탭 중 하나.
- **확인 필요**: `result`를 자유텍스트로 둘지 성공/부분/실패 같은 enum으로 둘지.

### 2.10 효과평가

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `evaluationId` | string(UUID) | Y | Y(PK) | N | 평가 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `caseId` | string | Y | N | N(FK) | `상담케이스.caseId` |
| 4 | `timepoint` | string(enum: `사전`/`사후`) | Y | N | N | 평가 시점 |
| 5 | `createdAt` | string(ISO datetime) | Y | N | N | 기록 시각 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `효과평가`는 Google Form과 연동되며 "도움된 점/어려웠던 점/영양교사에게 한 말" 등 자유서술 응답을 포함 — v1엔 응답 내용을 담을 컬럼이 없음.
- **확인 필요**: Form 연동을 v1에서도 유지할지, 응답 컬럼을 몇 개나 둘지.

### 2.11 성장측정

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `measurementId` | string(UUID) | Y | Y(PK) | N | 측정 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `caseId` | string | Y | N | N(FK) | `상담케이스.caseId` |
| 4 | `measuredAt` | string(ISO datetime) | Y | N | N | 측정일 |
| 5 | `height` | number | N | N | **Y(신체정보)** | 신장(cm) |
| 6 | `weight` | number | N | N | **Y(신체정보)** | 체중(kg) |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `성장측정`은 `GROWTH_HEADERS`와 일치(확인됨) — v1과 구조가 가장 가까움. BMI/백분위수는 v1에 없음(진단결과 쪽에 있었음, 2.6절).
- **확인 필요**: BMI를 저장값으로 둘지 height/weight에서 매번 계산할지.

### 2.12 다음회기준비

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `preparationId` | string(UUID) | Y | Y(PK) | N | 준비안 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `caseId` | string | Y | N | N(FK) | `상담케이스.caseId` |
| 4 | `sessionId` | string | N | N | N(FK) | 참조하는 `상담회기.sessionId` |
| 5 | `content` | string(자유서술, Gemini 생성 가능) | Y | N | **Y** | 준비 내용 |
| 6 | `createdAt` | string(ISO datetime) | Y | N | N | 기록 시각 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `다음회기준비`는 `NEXT_PREP_HEADERS`와 일치(확인됨).
- **확인 필요**: 없음(기존 구조와 가장 근접, 우선순위 낮음).

### 2.13 맛마을검사

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `assessmentId` | string(UUID) | Y | Y(PK) | N | 맛마을 검사 제출 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `studentUuid` | string | N | N | N(FK) | 제출 시점에 연결(비어 있을 수 있음) |
| 4 | `submittedAt` | string(ISO datetime) | Y | N | N | 제출 시각 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: taste-village(이번 분석 대상 아님, 기존 `google-data-inventory.md` 요약만 참고) 7개 탭(학생계정/회기활동/급식성찰/실천미션/미션점검/스티커북/매니저연계)을 단순화한 목표 스키마 — 실제 매핑은 Milestone 3(맛마을 이전) 착수 시 taste-village 코드를 별도로 정밀분석해 확정 필요.
- **확인 필요**: 전체 — taste-village 심층분석 전이라 이번 라운드에서 확정하지 않음.

### 2.14 맛마을결과

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `resultId` | string(UUID) | Y | Y(PK) | N | 결과 레코드 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `assessmentId` | string | Y | N | N(FK) | `맛마을검사.assessmentId` |
| 4 | `studentUuid` | string | N | N | N(FK) | `학생정보.studentUuid` |
| 5 | `summary` | string(자유서술) | N | N | **Y** | 결과 요약 |
| 6 | `createdAt` | string(ISO datetime) | Y | N | N | 기록 시각 |

- **사용 API/화면**: 없음. **확인 필요**: 2.13과 동일(taste-village 심층분석 이후).

### 2.15 생성문서

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `docId` | string(UUID) | Y | Y(PK) | N | 문서 메타데이터 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `caseId` | string | Y | N | N(FK) | `상담케이스.caseId` |
| 4 | `fileName` | string | Y | N | Y(파일명에 학생명 포함 가능) | 생성 파일명 |
| 5 | `driveFileId` | string | Y | N | N | 실제 파일 본문이 있는 Drive 파일 참조(원문은 D1/외부 미노출) |
| 6 | `createdAt` | string(ISO datetime) | Y | N | N | 생성 시각 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: **확인 필요 — legacy `생성문서`(`SHEETS.DOCS`) 탭은 이번 심층분석에서도 쓰기 코드를 전혀 찾지 못했다.** 탭 순서·숨김 탭 목록에만 존재하고, 읽기도 `getCaseDetailRaw_`에서 결과를 가져오지만 실제로 쓰이지 않는다. 실사용 여부 자체가 불명이므로 v1 구조가 legacy와 대응되는지 확인할 근거가 없음.

### 2.16 일정관리

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `scheduleId` | string(UUID) | Y | Y(PK) | N | 일정 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `caseId` | string | N | N | N(FK) | 선택적 연결 |
| 4 | `scheduledAt` | string(ISO datetime) | Y | N | N | 일정 일시 |
| 5 | `title` | string | Y | N | Y(학생명 포함 가능) | 일정 제목 |

- **사용 API/화면**: 없음.
- **기존 필드 출처**: legacy `일정관리`(`DASHBOARD_SCHEDULE_HEADERS`)는 `학생명`을 케이스번호로 조인하지 않고 **매번 직접 입력하는 중복 컬럼**으로 갖고 있었다(3·4절 — 이름 정정 시 어긋날 수 있는 위험 패턴). v1은 `title`에 자유 입력하도록 되어 있어 같은 함정이 재발할 수 있음 — **화면 구현 시 `caseId`로 학생명을 조회해서 보여주고 별도 입력란을 만들지 않을 것을 권장**.

### 2.17 일정완료

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `completionId` | string(UUID) | Y | Y(PK) | N | 완료 기록 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `scheduleId` | string | Y | N | N(FK) | `일정관리.scheduleId` |
| 4 | `completedAt` | string(ISO datetime) | Y | N | N | 완료 처리 시각 |

- **사용 API/화면**: 없음. **기존 필드 출처**: legacy `일정완료`(`DASHBOARD_COMPLETION_HEADERS`)와 개념적으로 대응하나 legacy는 `원본구분/원본ID` 등으로 일정 외 다른 완료 대상도 포괄했음 — v1은 일정 전용으로 단순화됨.

### 2.18 변경이력

| 열 순서 | 헤더(fieldName) | 자료형 | 필수 | 고유 | 개인정보 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `logId` | string(UUID) | Y | Y(PK) | N | 로그 식별자 |
| 2 | `tenantId` | string | Y | N | N | = schoolPublicId |
| 3 | `actor` | string | Y | N | Y(낮음, 교직원 식별자) | 작업자 |
| 4 | `action` | string | Y | N | N | 작업 유형 |
| 5 | `targetId` | string | N | N | N | 대상 레코드 ID(가변 참조) |
| 6 | `timestamp` | string(ISO datetime) | Y | N | N | 기록 시각 |

- **사용 API/화면**: 없음. **기존 필드 출처**: legacy `변경이력`(`로그ID, 일시, 사용자, 작업유형, 대상시트, 대상ID, 변경내용, 비고`)에 있던 `대상시트`(어느 탭이 바뀌었는지)와 `변경내용`(diff 내용)이 v1에 없음.

## 3. 가장 위험한 데이터 연결 문제 (legacy 근거)

legacy `findStudent_`(학생 자동 매칭 함수)는 **학년도+학년+반+정규화된 이름(+선택적으로 번호)**만으로 기존 학생 레코드를 찾는다. 번호가 한쪽이라도 비어 있으면 번호 비교 자체를 건너뛴다. 이로 인해 실제로 발생 가능한 두 가지 실패가 코드로 확인됨:

1. **거짓 음성(false negative)**: 이름 표기가 조금만 달라져도(공백, 오탈자) 기존 학생을 못 찾아 **중복 학생코드가 새로 발급**되고, 한 학생의 이력이 두 레코드로 쪼개진다.
2. **거짓 양성(false positive)**: 같은 학년·반에 이름이 같은 학생이 둘 있고 번호가 비어 있으면, **서로 다른 두 학생의 상담 이력이 한 레코드로 합쳐진다.**

두 경우 모두 확인 화면이나 사용자 확인 절차 없이 `find()` 결과를 그대로 쓴다. v1의 `학생정보.studentUuid`(UUID)는 이 문제를 구조적으로 차단하기 위한 것이며, **어떤 신규 기능도 이름/학년/반으로 학생을 찾거나 병합해서는 안 된다** — 반드시 `studentUuid`로만 조인한다.

## 4. 결정 필요 항목 (요약)

### 4.1 이번에 확정된 항목

| 항목 | 확정 내용 |
|---|---|
| 학생 영구 식별자 | `studentId` → **`studentUuid`**로 개명, UUID 기반. 모든 관계는 `studentUuid → caseId → sessionId`로만 연결(이름/학년/반 매칭 금지) |
| **학생정보 필드(Milestone 2 CRUD 구현 기준)** | `studentUuid, tenantId, name, grade, class, studentNumber, enrollmentStatus, createdAt, updatedAt` 확정. `grade`/`class`/`studentNumber`는 string 통일 |
| 상담케이스.status | `진행중`/`보류`/`종결` 3값 확정 |
| 실천목표.currentStatus | `진행중`/`완료`/`중단` 3값으로 신규 추가(화면 표시명: 현재상태) |
| 설정 탭 | 탭 이름은 `설정`으로 **유지(리네임 안 함)**. `schemaVersion`, `updatedAt` 키 추가. `installationVersion`은 앱 버전으로 유지 |

### 4.2 보류(추후 마일스톤에서 재검토)

| 항목 | 내용 |
|---|---|
| 상담회기 SOAP/PES 필드 구성 | 구조(4단/3단) 유지 방향만 정함, 열 구성은 상담기록 구현 단계에서 재검토(2.7절) |

### 4.3 아직 결정 필요

| 항목 | 내용 |
|---|---|
| 헤더 언어 | 현재 SSOT는 영문 카멜케이스 헤더(fieldName과 동일). 원래 설계 원칙(한글 표시 헤더/영문 fieldName 분리)과 다름 — 유지할지 바꿀지 결정 필요(바꾸면 기존 설치본 마이그레이션 필요) |
| `학년도` | 학생정보에 추가할지(legacy엔 있음, 이번 확정 범위엔 포함 안 됨) |
| `enrollmentStatus` 세부 값 | `재학`/`비활성` 외 휴학/전출/자퇴 등 세분화 여부 |
| `상담접수`/`보호자동의`의 `status` enum 값 목록 | 아직 미정(Milestone 4·5 범위) |
| `생성문서` 탭 존속 여부 | legacy에서도 쓰기 코드가 확인되지 않음 — 유지/삭제/용도 재정의 결정 필요 |

## 5. 참고

- 세부 legacy 코드 근거(라인 번호 포함)는 이번 Milestone 2 분석 세션에서 생성된 조사 결과를 기반으로 한다. 별도 상세 근거 문서(`docs/database-schema-analysis.md`)는 아직 작성되지 않았다 — 필요 시 후속 작업으로 별도 요청.
- `docs/schema-mapping-legacy-to-v1.md`, `docs/schema-migration-plan.md`도 아직 작성되지 않았다.
