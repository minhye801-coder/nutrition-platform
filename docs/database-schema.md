# 데이터베이스 스키마 (Google Sheets 기반)

플랫폼은 별도의 관계형 DB를 두지 않고, 학교(tenant)별 Google Sheets를 데이터 저장소로 사용합니다. 이 문서는 시트 설계의 기준이 되는 핵심 식별자와 탭 구조를 정의합니다.

## 1. 핵심 식별자

| 식별자 | 설명 | 발급 주체 | 비고 |
|---|---|---|---|
| `tenantId` | 학교(테넌트) 고유 식별자 | 플랫폼(관리자 설정 시 생성) | 모든 데이터 행의 최상위 구분자 |
| `studentId` | 학생 고유 식별자 | 학교별 시트 내에서 발급 | 학교 내부 식별자, 전역 고유는 아님 |
| `caseId` | 상담 건(케이스) 식별자 | 상담 매니저 | 한 학생이 여러 케이스를 가질 수 있음 |
| `intakeId` | 상담신청 접수 식별자 | 상담신청 모듈 | 신청 1건 = 1 intakeId, 승인 시 caseId와 연결 |
| `consentId` | 보호자동의 식별자 | 보호자동의 모듈 | intakeId 또는 caseId에 연결 |
| `assessmentId` | 영양 평가/분석 결과 식별자 | 상담 매니저(AI 분석 포함) | caseId에 종속 |

모든 ID는 `tenantId`를 접두어 또는 별도 컬럼으로 포함하여, 시트가 잘못 공유되거나 병합되더라도 학교 간 데이터가 섞이지 않도록 한다.

## 2. 필요한 Google Sheet 탭 목록 (초안)

| 탭 이름 | 주요 컬럼(예시) | 설명 |
|---|---|---|
| `Tenants` | tenantId, schoolName, schoolPublicId, driveRootFolderId, createdAt | 플랫폼 관리자 설정에서 관리하는 학교 마스터(관리자 계정 소유 시트에만 존재하거나, 학교별 시트의 메타 탭으로 존재) |
| `Students` | studentId, tenantId, name(암호화/최소화 검토), grade, class, createdAt | 학생 기본 정보 |
| `Cases` | caseId, tenantId, studentId, status, openedAt, closedAt | 상담 케이스 진행 상태 |
| `Intakes` | intakeId, tenantId, studentId(연결 전 null 가능), submittedAt, status, rawAnswers | 상담신청 원본 데이터 |
| `Consents` | consentId, tenantId, intakeId, caseId, guardianName, agreedAt, method | 보호자동의 기록 |
| `Assessments` | assessmentId, tenantId, caseId, createdAt, aiModel, summary, driveFileId | AI 영양 평가/분석 결과 및 산출물 참조 |
| `Settings` | tenantId, geminiApiKeyRef, driveRootFolderId, sheetIds..., updatedAt | 학교별 관리자 설정(민감정보는 값 자체가 아닌 참조/암호화된 형태 저장) |
| `AuditLog` | logId, tenantId, actor, action, targetId, timestamp | 주요 데이터 변경 이력(선택, 보안/신뢰성 강화용) |

> 실제 컬럼 세부 사항은 기존 시스템(맛마을 탐험소, 상담신청/동의 등) 코드가 이관되는 시점에 `current-system-analysis.md`의 분석 결과를 반영하여 확정한다.

## 3. 탭 간 관계

```
Tenants (1) ── (N) Students
Students (1) ── (N) Cases
Intakes  (1) ── (0..1) Cases        // 신청이 승인되면 Case로 연결
Intakes  (1) ── (0..N) Consents     // 하나의 신청에 여러 동의 이력이 있을 수 있음
Cases    (1) ── (0..N) Consents
Cases    (1) ── (0..N) Assessments
Tenants  (1) ── (1) Settings
```

- 모든 하위 엔터티(Students, Cases, Intakes, Consents, Assessments)는 `tenantId`를 필수로 포함한다.
- `Intakes`는 학생이 아직 시스템에 등록되지 않은 상태(신규 신청)에서도 생성될 수 있어 `studentId`는 초기에는 비어 있을 수 있다.
- `Consents`는 `intakeId` 또는 `caseId` 중 하나 이상과 연결되어야 하며, 두 값 모두 없는 동의 레코드는 유효하지 않다.
- `Settings`는 학교당 1행(또는 별도 탭 전체가 1개 학교 전용 시트일 경우 파일 자체가 Settings 역할)으로 관리한다.

## 4. 저장 방식 관련 원칙

- 하나의 물리적 Google Sheets 파일을 학교(tenant) 단위로 분리할지, 하나의 시트에 `tenantId` 컬럼으로 논리 분리할지는 2단계(Google 로그인/최초 설치) 설계 시 결정한다. 현재 문서는 두 방식 모두에 적용 가능한 논리 모델만 정의한다.
- 개인정보/민감정보 컬럼은 `security-principles.md`의 원칙을 따른다.
