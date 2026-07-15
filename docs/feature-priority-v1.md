# 기능 구현 우선순위 v1

> **문서 상태**: 설계 확정(v1). 아직 코드 구현 없음.
> **관련 문서**: `docs/counseling-workflow-v1.md`(흐름/상태값 상세), `docs/route-and-menu-plan.md`(메뉴/라우트 상세), `docs/database-schema.md`(탭/헤더).

## 0. 우선순위 원칙

1. **주 흐름(상담접수 → 승인 → 자동생성 → 동의 → 검사 → 케이스)을 순서대로 완성**하는 것을 최우선으로 한다. 상담케이스 CRUD를 단독 기능으로 먼저 만들지 않는다 — 접수 승인의 부산물로 자동 생성되는 경로가 먼저 동작해야, 상담케이스 화면이 실제로 의미 있는 데이터를 다룰 수 있다.
2. **각 마일스톤은 이전 마일스톤이 만든 탭/헤더/API에 의존**한다 — 순서를 건너뛰지 않는다.
3. 보조 흐름(교사 직접 등록/직접 케이스 생성, 동의·검사 생략)은 주 흐름 완성 이후 여유가 있을 때 붙이는 백로그로 취급한다(6절).

## 1. Milestone 2A — 공개 상담신청 + 접수 관리

**목표**: 학생/보호자가 QR/URL로 상담을 신청할 수 있고, 교사가 그 목록을 검토·승인/반려할 수 있다. (아직 승인해도 케이스/학생/동의가 자동 생성되지는 않는다 — 그건 2B.)

- **백엔드**
  - `POST /api/public/intakes/:schoolPublicId` — 공개 제출(인증 없음, `schoolPublicId`로 대상 학교 스프레드시트 식별).
  - `GET /api/intakes` — 목록(로그인 필요, 상태/검색 필터).
  - `GET /api/intakes/:intakeId` — 상세.
  - `POST /api/intakes/:intakeId/review` — 검토 시작(`검토중` 전이).
  - `POST /api/intakes/:intakeId/approve` — 승인(2B에서 자동 생성 로직 연결 전까지는 상태 전이만).
  - `POST /api/intakes/:intakeId/reject` — 반려(사유 기록 여부는 구현 시 결정).
- **프런트**
  - `/intake/:schoolPublicId` — 공개 신청 폼(비로그인, `RootLayout` 하위이나 `AuthGuard` 미적용).
  - `/intakes` — 접수 목록(상태/검색 필터).
  - `/intakes/:intakeId` — 접수 상세 + 승인/반려 액션.
- **시트/헤더**
  - `installTemplate.ts`의 `상담접수` 헤더를 `docs/database-schema.md` 2.3절 확정안대로 갱신(현재는 `studentId` 등 최소 골격만 있음 — `intakeId, tenantId, applicantType, applicantName, relationToStudent, name, grade, class, studentNumber, topic, content, contactInfo, privacyConsent, status, submittedAt, updatedAt` 수준으로 확장 검토, 정확한 필드명은 구현 착수 시 확정).
  - `status` enum: `신규/검토중/승인/반려`(`counseling-workflow-v1.md` 4.1절).
- **완료 기준**: 공개 폼 제출 → 접수 목록에 반영 → 검토중 전이 → 승인/반려 처리까지 새로고침 유지, 다른 사용자 스프레드시트 접근 차단.

## 2. Milestone 2B — 접수 승인 시 자동 생성

**목표**: 승인 액션 하나로 학생 확인/생성 → 케이스 생성 → 동의 기본 레코드 생성이 한 번에 일어난다.

- **백엔드**
  - `POST /api/intakes/:intakeId/approve` 확장 — `counseling-workflow-v1.md` 5절 규칙 그대로 구현(학생 매칭/생성, 케이스 생성, 동의 레코드 생성, 멱등성 가드).
  - 학생 매칭 로직은 기존 `findPotentialDuplicate`류를 재사용하되, 미결정 사항(중복 매칭 기준)을 먼저 확정해야 착수 가능.
- **프런트**
  - 접수 상세 화면에 "승인 시 생성될 항목 미리보기"(신규 학생 여부, 케이스 생성 안내) 추가 검토.
  - 승인 완료 후 생성된 케이스 상세로 바로 이동하는 링크 제공.
- **시트/헤더**
  - `상담케이스` 헤더 확정 및 `installTemplate.ts` 갱신: `caseId, tenantId, studentUuid, intakeId, caseTitle, status, referralReason, assignedManager, openedAt, closedAt, createdAt, updatedAt`(정확한 필드셋은 착수 시 `database-schema.md` 2.5절과 함께 재확정 — 특히 `intakeId` 신규 FK, `studentId→studentUuid` 명명 수정 포함).
  - `보호자동의` 헤더도 함께 확정(2.4절 갱신 대상).
- **완료 기준**: `counseling-workflow-v1.md` 7절 검증 시나리오 중 "재학생에게 케이스 생성", "학생 자동 생성", "중복 승인 방지" 통과.

## 3. Milestone 3 — 보호자동의 링크 및 제출

**목표**: 교사가 동의 링크를 발송하고, 보호자가 비로그인 상태로 제출하며, 교사가 확인한다.

- **백엔드**
  - `POST /api/cases/:caseId/consent/send` — 토큰 발급 + 발송 처리(`발송` 전이).
  - `GET /api/public/consents/:token` — 공개 조회(케이스 요약 최소 정보만).
  - `POST /api/public/consents/:token` — 보호자 제출(`제출` 전이) 또는 거부(`거부` 전이).
  - `POST /api/cases/:caseId/consent/confirm` — 교사 확인(`확인완료` 전이, 케이스 `검사대기`로 자동 전이).
  - 동의 기록 PDF 생성 — Drive API로 생성, D1/원문 미저장.
- **프런트**
  - `/consents` — 동의 목록(케이스별 상태).
  - `/consent/:token` — 공개 제출 폼(비로그인).
- **완료 기준**: 링크 발송 → 보호자 제출 → 교사 확인 → 케이스 자동 전이까지 확인. 토큰 만료(미결정 2) 처리 방식은 이 마일스톤 착수 전 확정 필요.

## 4. Milestone 4 — 검사 및 PDF 관리

**목표**: 검사 결과 PDF를 업로드/기록하고, 교사가 검토해 진단결과를 확정한다.

- **백엔드**
  - `POST /api/cases/:caseId/assessments` — 검사 결과 업로드/기록(업로드 방식은 미결정 4).
  - `PATCH /api/cases/:caseId/assessments/:assessmentId` — 교사 검토/수정 저장.
- **프런트**
  - `/assessments` — 검사 목록/상태.
- **시트/헤더**: `진단결과` 헤더 확정(현재 최소 골격, `database-schema.md` 2.6절 "가장 민감한 탭" 주의사항 반영 — 47개 legacy 컬럼 중 실제 필요한 것만 추림, 이번 마일스톤 착수 시 별도 확정).
- **완료 기준**: 결과 저장 → 케이스 `검사완료` → 교사 확인 후 `상담예정` 전이.

## 5. Milestone 5 — 상담회기 및 목표관리

**목표**: SOAP/PES 회기 기록, 실천목표 설정/점검, 종결 처리.

- **백엔드**
  - `POST /api/cases/:caseId/sessions` — 회기 기록(케이스 `상담진행` 전이).
  - `POST /api/cases/:caseId/goals`, `POST /api/goals/:goalId/checks` — 목표/점검.
  - `POST /api/cases/:caseId/close` — 종결(`closedAt` 기록).
- **프런트**
  - `/sessions` — 상담기록 목록/작성.
  - 케이스 상세 내 목표 관리 섹션.
- **시트/헤더**: `상담회기`(SOAP/PES 7개 필드는 `database-schema.md` 2.7절에 "보류 — 상담기록 구현 단계에서 재검토"로 명시돼 있음 — 이번 마일스톤 착수 시 확정), `실천목표`, `목표점검`.
- **완료 기준**: `counseling-workflow-v1.md` 2절의 12~14단계 전부 동작, 종결 후 상태 유지 확인.

## 6. 보조 기능 백로그 (우선순위 낮음, 순서 미지정)

이 항목들은 위 5개 마일스톤과 독립적으로, 여유가 있을 때 아무 순서로나 붙일 수 있다.

- **교사 직접 학생 등록** — 이미 구현됨. 문구/메뉴 위치 조정만 남음(`route-and-menu-plan.md` 1절과 함께 처리 가능, 별도 마일스톤 불필요).
- **교사 직접 상담 시작(직접 케이스 생성)** — Milestone 2B의 케이스 생성 로직을 재사용하는 대체 진입점. 2B 완료 후 아무 때나 추가 가능.
- **동의/검사 생략 조건 처리** — 미결정 사항(동의 생략 조건)이 먼저 확정돼야 착수 가능. Milestone 3~4 완료 후 검토.

## 7. 마일스톤 의존 관계

```
Milestone 2A (접수 제출/검토/승인·반려)
        │
        ▼
Milestone 2B (승인 시 학생·케이스·동의 자동생성)  ← 학생관리(기존) 재사용
        │
        ▼
Milestone 3 (보호자동의 링크/제출)
        │
        ▼
Milestone 4 (검사/PDF)
        │
        ▼
Milestone 5 (상담회기/목표관리/종결)

보조 백로그(교사 직접 등록/직접 시작/생략 조건)는 2B 완료 이후 아무 지점에서나 병행 가능.
```
