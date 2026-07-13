# 권장 마이그레이션 계획 (recommended-migration-plan)

> `legacy-system-map.md`, `integration-flow.md`, `google-data-inventory.md`, `hardcoded-values-report.md`, `migration-risks.md`의 분석 결과를 바탕으로, 기존 기능을 유지하면서 범용 플랫폼(`development-roadmap.md`)으로 옮기기 위한 단계별 계획입니다. 이 문서는 계획만 다루며, 실제 구현은 포함하지 않습니다.

## 1. Google OAuth·최초 설치를 시작하기 전에 해결해야 할 선행조건

`development-roadmap.md`의 2단계(Google 로그인과 최초 설치)에 착수하기 전에, 아래 항목은 반드시 먼저 확인/해결되어야 합니다. 근거는 `migration-risks.md`의 P0 항목과 동일합니다.

1. **실제 시트 스키마 원본 확보** — `legacy/sheet-structure/`가 현재 비어 있어, 이 저장소의 모든 문서는 코드에서 역산한 구조입니다. 실제 운영 스프레드시트의 헤더(값은 제외/마스킹)를 확보해 `database-schema.md`·`google-data-inventory.md`와 대조 검증해야 합니다.
2. **counseling-manager ↔ intake-consent 스프레드시트 공유 구조 정리** — 두 프로젝트가 물리적으로 하나의 스프레드시트를 쓰는 현재 구조를, 3단계(학교별 시트/폴더 자동 생성)에서 "하나의 tenant = 하나의 스프레드시트 세트"로 만들 때 두 모듈이 항상 같은 ID를 주입받도록 설치 절차를 설계해야 합니다.
3. **taste-village의 학교 종속값 자동화 설계** — 학교명, NEIS 코드, 스프레드시트 ID가 하드코딩되어 있는 현재 구조는 학교마다 코드를 복제·수정해야 합니다. 3단계 설치 스크립트가 이 값들을 tenant 설정에서 자동 주입하도록 먼저 설계해야, 여러 학교가 동시에 안전하게 사용할 수 있습니다.
4. **보호자동의 토큰 정책 재설계** — 만료 시각이 없는 현재 방식은 개인정보 노출 경로이므로, OAuth/설치 단계 이전에 토큰 TTL·1회성 사용 정책을 확정해야 이후 단계(7단계 보호자동의 이전)에서 동일한 실수를 반복하지 않습니다.
5. **`?k=` 짧은링크 처리 불일치 재검증** — 실제 배포본에서 짧은코드 링크가 동작하는지 확인 필요(코드만으로는 미확인). 동작하지 않는다면 신규 설계에서는 아예 짧은코드 방식을 재구현할지, 폐기할지 결정해야 합니다.
6. **`appsscript.json` 및 실제 배포 설정 확보** — 세 프로젝트 모두 배포 매니페스트가 저장소에 없어, 실행 계정/액세스 범위를 코드만으로 확인할 수 없습니다. OAuth 설계 전 반드시 실제 배포 설정을 확인해야 "누가 어떤 권한으로 실행되는지"를 신규 아키텍처에 정확히 반영할 수 있습니다.

## 2. 단계별 계획

### 1단계 — 현재 구조 분석 (완료)
- 본 6개 문서로 완료. 후속 조사 필요 항목은 3항에 정리.

### 2단계 착수 전 준비 (신규, 1.5단계 성격)
- 위 6개 선행조건 해결
- `security-principles.md` 기준으로 토큰/ID 노출 정책을 코드 레벨 체크리스트로 구체화

### 2단계 — Google 로그인과 최초 설치
- 영양교사 Google OAuth 로그인 구현
- 로그인 계정과 "학교(tenant)" 매핑 판별 로직 설계 (신규 학교 vs 기존 학교)
- 기존 `설정` 시트의 키-값 목록(`PUBLIC_APP_URL`, `GEMINI_MODEL`, `ROOT_FOLDER_ID`, `SCHOOL_NAME` 등, `google-data-inventory.md` 1절)을 그대로 tenant 설정 스키마의 초기값으로 채택

### 3단계 — 학교별 시트/폴더 자동 생성
- counseling-manager + intake-consent가 공유하던 단일 스프레드시트 구조를 tenant 초기화 시 한 번에 생성
- taste-village 스프레드시트도 동일 tenant 초기화에 포함(현재는 별도 스프레드시트이므로, 하나로 통합할지 별도 유지할지 결정 필요 — 통합 시 `integration-flow.md` 3절의 `openById` 동기화 로직 자체가 불필요해짐)
- Drive 케이스 폴더 구조(`google-data-inventory.md` 3절, 01~06 서브폴더)를 tenant 소유 Drive에 자동 생성

### 4단계 — 영양상담 관리자 이전
- `legacy-system-map.md` 2절의 10개 탭 기능을 `/app`으로 이관
- Gemini 3개 호출 지점(`extractDiagnosisWithGemini_`, `generateCounselingDraft`, `generateNextSessionPreparation`)을 Cloudflare Functions API로 우선 이전(`migration-risks.md`의 분류 A 항목)
- Drive 파일 업로드/케이스 폴더 생성은 초기에는 Apps Script 유지 검토(Docs/Drive API 재구현 비용 고려)

### 5단계 — 맛마을 탐험소 이전
- 학생용 SPA(`Index.html`)를 `/explore`로 이관(정적 자산, Sheets 비의존이라 이전 용이)
- NEIS 급식 조회를 Cloudflare Workers로 이전(외부 REST 호출만 존재, Sheets 의존 없음)
- 로그인/세션은 studentId 기반으로 재설계(현재 이름+4자리코드 방식의 위험 해소)

### 6단계 — 상담신청 이전
- `Intake.html.txt` 공개 폼을 `/intake`로 이관
- 스팸 방지를 허니팟 단독에서 Turnstile 등으로 강화
- 신청 데이터 저장을 tenant 스프레드시트(또는 향후 DB) API 호출로 전환

### 7단계 — 보호자동의 이전
- `Consent.html.txt`를 `/consent`로 이관
- 토큰 발급(현재 counseling-manager 담당)과 소비(현재 intake-consent 담당)를 하나의 `/consent` + Cloudflare Functions API로 통합해 두 프로젝트 간 URL 조합 방식 의존을 제거
- PDF 생성(`createConsentPdf_`)은 Google Docs/Drive API 재구현 비용을 고려해 초기 Apps Script 유지 검토

### 8단계 — Gemini API 설정
- `/setup`에서 학교별 Gemini API Key 등록 UI 구현(현재의 `ui.prompt` 방식을 서버 저장 폼으로 대체)
- 모델명 설정을 3곳 중복 하드코딩(`gemini-3.1-flash-lite`)에서 tenant 설정 단일값으로 통합

### 9단계 — Cloudflare 자동 배포
- 4~7단계에서 A로 분류된 기능(Gemini 호출, 학생 UI, NEIS 조회, 공개 폼)부터 우선 배포 파이프라인 구성
- Apps Script에 남는 기능(Docs/PDF, Forms 연동)은 별도 유지보수 경로로 문서화

## 3. 첫 번째 구현 목표 제안

`migration-risks.md`의 분류(A/B/C)와 `development-roadmap.md`의 순서를 종합하면, **2단계 이전에 다음 두 가지를 첫 목표로 제안합니다**:

1. **`legacy/sheet-structure/`에 실제 시트 스키마 원본 채우기** — 모든 후속 설계(database-schema.md 검증, tenant 초기화 스크립트)의 기초 자료이므로 코드 개발 전에 먼저 완료하는 것이 리스크가 가장 낮습니다.
2. **보호자동의 토큰 정책 재설계 문서 작성** — 유일하게 "즉시 개인정보 노출로 이어지는" P0 보안 위험이며, 7단계 실제 구현 전에 정책을 확정해두면 이후 개발이 반복 수정 없이 진행됩니다.

두 항목 모두 코드 작성 없이 문서/자료 확보만으로 진행 가능해, "아직 실제 기능 개발을 시작하지 않는다"는 현재 프로젝트 단계 원칙과도 부합합니다.
