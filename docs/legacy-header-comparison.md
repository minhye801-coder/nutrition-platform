# legacy ↔ 현재(v1) 시트 헤더 1:1 비교표 (legacy-header-comparison)

> 이 문서는 `legacy/counseling-manager/code.gs.txt` 전수 재조사(헤더 상수 `XXX_HEADERS` + `appendObject_`/`appendRow` 객체 리터럴 키 순서 기준)와 현재 `functions/_lib/installTemplate.ts`(2026-07-15 기준, `studentUuid` 통일 + `schoolYear` 추가 반영 후)를 탭별로 나란히 비교한 것이다. legacy 필드는 **축소·삭제하지 않고 있는 그대로** 나열하며, v1에 아직 반영되지 않은 필드는 "미반영(TBD)"로 표시한다 — 삭제 결정이 아니다.
>
> **범례**: 일치=이름만 다르고 의미 동일 / 신규=legacy에 없던 v1 전용 필드(tenantId, UUID PK 등) / 미반영=legacy에 있으나 v1에 아직 없음(향후 마일스톤에서 결정) / 확인 필요=legacy 원본 자체가 불명확.

---

## 1. 설정

| v1 헤더 | legacy 대응 | 상태 | 비고 |
|---|---|---|---|
| 키 | 설정 키(1열) | 일치 | |
| 값 | 설정 값(2열) | 일치 | |
| (없음) | 3번째 열(헤더명 불명, `setSetting_`이 항상 `'자동 생성'` 리터럴만 씀) | **확인 필요** | 코드에서 읽는 곳이 전혀 없음 — 용도 불명, 재조사로도 확정 못함 |

**키(값 목록) 비교**:

| v1 키 | legacy 대응 키 | 상태 |
|---|---|---|
| schoolName | SCHOOL_NAME | 일치 |
| managerName | (대응 legacy 키 미상) | 확인 필요 |
| schoolPublicId | (legacy엔 개념 자체 없음) | 신규 |
| installationVersion | (legacy엔 개념 자체 없음) | 신규 |
| schemaVersion | (legacy엔 개념 자체 없음) | 신규 |
| createdAt | (legacy엔 개념 자체 없음) | 신규 |
| updatedAt | (legacy엔 개념 자체 없음) | 신규 |
| (없음) | PUBLIC_APP_URL | 미반영 — 보호자동의/공개 상담신청 링크 생성 시 필요(Milestone 3) |
| (없음) | GEMINI_MODEL | 미반영 — Gemini 연동 마일스톤에서 결정 |
| (없음) | ROOT_FOLDER_ID | 미반영 — v1은 Drive 루트 폴더 ID를 D1(`installations.root_folder_id`)에 저장, 시트에 두지 않음(설계 차이, 축소 아님) |
| (없음) | CASE_PREFIX | 미반영 — v1은 caseId를 UUID로 발급하므로 프리픽스 개념 자체가 불필요(설계 차이) |
| (없음) | STUDENT_PREFIX | 미반영 — 위와 동일 이유 |

---

## 2. 학생정보

| # | v1 헤더(fieldName) | legacy 대응 헤더 | 상태 | 비고 |
|---|---|---|---|---|
| 1 | studentUuid | 학생코드 | 일치(개명+ID방식 변경) | 순번 문자열(`S-0001`) → UUID |
| 2 | tenantId | (없음) | 신규 | |
| 3 | schoolYear | 학년도 | 일치 | 오늘 확정, number→string |
| 4 | name | 학생명 | 일치 | |
| 5 | grade | 학년 | 일치 | number→string |
| 6 | class | 반 | 일치 | number→string |
| 7 | studentNumber | 번호 | 일치 | |
| 8 | enrollmentStatus | 재학상태 | 일치(의미 확장) | legacy는 `'재학'` 고정 기록만, 읽는 코드 없음(`docs/student-info-verification.md` 6.3절). v1은 `재학`/`비활성` 실제로 필터링에 사용 |
| 9 | createdAt | 등록일 | 일치 | Date→ISO 문자열 |
| 10 | updatedAt | (없음) | 신규 | legacy는 개별 행 수정시각 없음(변경이력 시트에만 감사로그) |
| (없음) | 비고 | 미반영(TBD) | 자유 메모 필드, 실사용 사례 확인 안 됨 |

---

## 3. 상담접수

legacy 19개 컬럼(`intake-consent/code.gs.txt:51-71` 역산) vs v1 6개 컬럼(현재 최소 골격).

| # | v1 헤더 | legacy 대응 헤더 | 상태 | 비고 |
|---|---|---|---|---|
| 1 | intakeId | 접수ID | 일치(ID방식 변경) | `REQ-연도-0000` 순번 → UUID 권장(`docs/public-intake-auth-design.md` 3.5절) |
| 2 | tenantId | (없음) | 신규 | |
| 3 | studentUuid | 학생코드 | 일치(개명) | v1은 `studentId`였던 걸 이번에 `studentUuid`로 통일함 |
| 4 | status | 처리상태 | 일치(값 재정의) | legacy 4값(`신규 접수`/`접수 완료`/`검토 대기`/`케이스 생성`, 실제 코드가 만드는 값은 2개뿐) — v1 값 목록은 Milestone 4(상담접수 이전)에서 확정 필요 |
| 5 | submittedAt | 접수일 | 일치 | |
| 6 | updatedAt | (없음, `처리상태` 갱신 시각을 별도로 안 남김) | 신규 | |
| (없음) | 접수일 이후 나머지 13개 legacy 필드 전부 | **미반영(TBD)** | 아래 표 참고 — Milestone 4(상담접수 이전) 착수 시 확정 |

**미반영 legacy 필드 상세** (`docs/intake-migration-spec.md` 3절 근거):

| legacy 헤더 | 설명 | v1 반영 계획 |
|---|---|---|
| 신청자유형 | `학생`/`보호자`/`담임교사`/`보건교사`/`기타 교직원` | Milestone 4에서 `applicantType`으로 반영 예정 |
| 신청자명 | 신청자 이름 | `applicantName` |
| 학생과의관계 | 신청자-학생 관계 | `relationToStudent` |
| 학년도 | 신청 시점 입력 학년도(학생정보와 별개로 폼에서 직접 받음) | `schoolYear`(폼 입력값, 승인 시 학생정보 매칭에 사용) |
| 학년 | | `grade` |
| 반 | | `class` |
| 번호 | 선택 입력 | `studentNumber`(선택) |
| 학생명 | | `studentName` |
| 상담주제 | select(7개 값) | `topic` |
| 신청내용 | textarea | `content` |
| 희망시간 | select(4개 값), 선택 입력 | `preferredTime`(선택) |
| 긴급도 | select(2개 값), 선택 입력 | `urgency`(선택) |
| 연락처 | 보호자 연락처 | `contactInfo` |
| 개인정보동의 | 제출 시 항상 `'동의'` | `privacyConsent` |
| 비고 | 선택 입력 + 승인 시 케이스번호 자동 추가 | `note`(선택) |

---

## 4. 보호자동의

legacy 20개 컬럼 + 자가치유로 추가되는 `짧은코드`(`counseling-manager/code.gs.txt:3034-3055`, `3473-3476` 역산) vs v1 8개 컬럼.

| # | v1 헤더 | legacy 대응 헤더 | 상태 | 비고 |
|---|---|---|---|---|
| 1 | consentId | (없음, legacy는 케이스번호가 곧 PK) | 신규 | v1은 별도 UUID PK를 둠 |
| 2 | tenantId | (없음) | 신규 | |
| 3 | intakeId | (없음, legacy는 상담케이스를 거쳐 간접 연결) | 신규 | |
| 4 | caseId | 케이스번호 | 일치(개명) | |
| 5 | consentToken | 동의토큰 | 일치 | legacy: `Utilities.getUuid()` 하이픈 제거 |
| 6 | status | 확인상태 | 일치(값 재정의) | legacy 실측 5값: `미발송`/`동의 요청`/`교사 확인 필요`/`비동의`/`동의 완료`(`docs/intake-migration-spec.md` 8.6절). v1 값 목록 확정 필요 |
| 7 | requestedAt | 발송일 | 일치(의미 근사) | legacy는 "발송" 액션 시각, v1 필드명은 "요청" — 명명 재검토 여지 있음 |
| 8 | respondedAt | 제출일시 또는 동의일 | 일치(의미 근사) | legacy는 제출일시/동의일 2개로 분리, v1은 1개로 병합 — Milestone 3 확정 시 분리 여부 재검토 |
| (없음) | 동의링크 | 미반영(TBD) | `?k=`/`?mode=consent&token=` 조합형 URL. `?k=` 라우팅 자체가 legacy에 버그 있음(`docs/intake-migration-spec.md` 8.2절) — v1 재설계 필요 |
| (없음) | 짧은코드 | 미반영(TBD) | 위와 동일 사안, 유지 여부 결정 필요 |
| (없음) | 보호자명 | 미반영(TBD) | |
| (없음) | 학생과의관계 | 미반영(TBD) | |
| (없음) | 보호자연락처 | 미반영(TBD) | |
| (없음) | 학생참여의사 | 미반영(TBD) | `saveStudentAssent`로 별도 저장(`counseling-manager/code.gs.txt:3682`) |
| (없음) | 상담동의 | 미반영(TBD) | 5개 필수 동의항목 중 1 |
| (없음) | 개인정보동의 | 미반영(TBD) | 5개 필수 동의항목 중 2 (상담접수의 `개인정보동의`와는 별개 필드) |
| (없음) | 민감정보동의 | 미반영(TBD) | 5개 필수 동의항목 중 3 |
| (없음) | 진단결과활용동의 | 미반영(TBD) | 5개 필수 동의항목 중 4 |
| (없음) | AI보조안내확인 | 미반영(TBD) | 5개 필수 동의항목 중 5 |
| (없음) | 동의서파일URL | 미반영(TBD) | PDF 산출물 Drive 링크 |
| (없음) | 확인일 | 미반영(TBD) | 교사 최종 확인 시각(`confirmGuardianConsent`) |
| (없음) | 확인자 | 미반영(TBD) | 교사 이메일 |
| (없음) | 비고 | 미반영(TBD) | |

---

## 5. 상담케이스

legacy 12개 컬럼(`counseling-manager/code.gs.txt:3021-3032` 역산) vs v1 6개 컬럼.

| # | v1 헤더 | legacy 대응 헤더 | 상태 | 비고 |
|---|---|---|---|---|
| 1 | caseId | 케이스번호 | 일치(ID방식 변경) | `NC-연도-0000` 순번 → UUID |
| 2 | tenantId | (없음) | 신규 | |
| 3 | studentUuid | 학생코드 | 일치(개명) | 이번에 `studentId`→`studentUuid` 통일 |
| 4 | status | 현재단계 | 일치(값 대폭 재정의) | legacy 8값(`동의 대기/진단 대기/결과 확인/상담 예정/실천 중/추적상담 예정/종결 검토/종결`) — v1 값 목록은 Milestone 4/5에서 확정. `docs/counseling-workflow-v1.md` 4.3절이 7단계 안을 제시했으나 이번 조사에서 `보류` 상태가 이전 초안(3값)에 있었다가 폐기된 이력이 확인됨(재확인 필요 — 최신 결정을 따를 것) |
| 5 | openedAt | 접수일 | 일치(의미 근사) | |
| 6 | closedAt | 종결일 | 일치 | |
| (없음) | 접수ID | 미반영(TBD) | `intakeId` FK 필요 — `docs/counseling-workflow-v1.md` 7절이 이미 "신규 컬럼 필요"로 지적 |
| (없음) | 신청경로 | 미반영(TBD) | legacy `신청자유형` 복사값 |
| (없음) | 주상담주제 | 미반영(TBD) | |
| (없음) | 다음일정 | 미반영(TBD) | |
| (없음) | 담당자 | 미반영(TBD) | 현재 v1은 "학교당 단일 계정" 모델이라 우선순위 낮음(`counseling-workflow-v1.md` 1절) |
| (없음) | Drive폴더URL | 미반영(TBD) | 케이스별 하위 폴더 자동 생성 여부 자체가 TBD(`counseling-workflow-v1.md` 8절 체크리스트) |
| (없음) | 비고 | 미반영(TBD) | |

---

## 6. 진단결과

legacy **54개 컬럼**(`counseling-manager/code.gs.txt`의 `saveDiagnosis`/`mapExtractedDiagnosis_` 객체 리터럴, 이번 재조사로 확정 — 기존 문서의 "47개"는 부정확했음) vs v1 4개 컬럼(식별자만).

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | assessmentId | 진단ID | 일치(ID방식 변경) |
| 2 | tenantId | (없음) | 신규 |
| 3 | caseId | 케이스번호 | 일치(개명) |
| 4 | round | 검사차수 | 일치 |
| 5 | timepoint | 평가시점 | 일치(`사전`/`사후`) |
| 6 | createdAt | 검사일 | 일치(의미 근사) |

**미반영(TBD) legacy 필드 48개** — 신체계측·식습관·정신건강 등 가장 민감한 실제 데이터가 전부 여기 포함되며, v1에는 아직 담을 자리가 없다:

학생코드, 학생명, 학년도, 학년, 반, 결과PDF_URL, 응답PDF_URL, 성별, 나이, 신장_cm, 신장백분위, 체중_kg, 체중백분위, BMI, BMI백분위, 주관적건강상태, 체형인식, 식사빈도, 규칙적식사, 식사속도, 식사량, 종합등급, 종합점수, 균형등급, 균형점수, 절제등급, 절제점수, 실천등급, 실천점수, 섭식태도, 섭식태도점수, 알레르기, 질환, 수면습관, 수면시간, 정신건강, 스마트폰사용습관, 평일스마트폰시간, 주말스마트폰시간, 스마트폰과의존, 추가요청사항, 이상값경고, AI추출상태, AI추출일, 교사확인, 확인일, 확인자, AI추출원문, 비고

> 이 48개는 Milestone 4(진단·검사) 착수 시 "실제로 필요한 것만 추리는" 작업이 별도로 필요하다(`docs/database-schema.md` 2.6절이 이미 명시) — 이번 문서는 그 판단을 하지 않고 legacy 원문 그대로 나열만 한다.

---

## 7. 상담회기

legacy 23개 컬럼(`saveSession`, `counseling-manager/code.gs.txt:5476-5500`) vs v1 6개 컬럼.

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | sessionId | 회기ID | 일치(ID방식 변경) |
| 2 | tenantId | (없음) | 신규 |
| 3 | caseId | 케이스번호 | 일치(개명) |
| 4 | sessionDate | 상담일 | 일치 |
| 5 | summary | SOAP, PES(2개 필드를 1개로 병합 표시) | 부분 일치 | v1 `summary` 단일 필드로는 SOAP 4단/PES 3단 구조를 담을 수 없음 — `docs/database-schema.md` 2.7절이 이미 "보류, 상담기록 구현 단계에서 재검토"로 표시 |
| 6 | createdAt | (없음, `상담일`과 별개 기록 시각 없음) | 신규 |

**미반영(TBD) legacy 필드 17개**: 회기, 상담시간(분), 학생주요호소, 학생이말한원인, 학생강점, 교사관찰, 변화준비도, 연계검토, 교사추천활동, 추천상담기법, 추천상담콘텐츠, 교육중점코멘트, 활동실시상태, 활동실시메모, 교사승인, 승인일, 담당자, 비고 (SOAP/PES 자체는 위 5번 행에서 이미 "부분 일치"로 별도 표시)

---

## 8. 실천목표

legacy 17개 컬럼(`saveSession` 내 goalText 분기, `counseling-manager/code.gs.txt:5503-5527`) vs v1 6개 컬럼.

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | goalId | 목표ID | 일치(ID방식 변경) |
| 2 | tenantId | (없음) | 신규 |
| 3 | caseId | 케이스번호 | 일치(개명) |
| 4 | sessionId | 회기ID | 일치(개명) |
| 5 | content | 목표문장 | 일치(개명) |
| 6 | createdAt | (없음) | 신규 |
| (v1 신규 추가) currentStatus | 결과(개념상 가장 근접) | 일치(값 재정의) | v1: `진행중`/`완료`/`중단` 3값 신규 확정(`database-schema.md` 4.1절) |

**미반영(TBD) legacy 필드 11개**: 시작일, 종료일, 목표횟수, 실제횟수, 달성률, 확인방법, 학생소감, 어려움, 도움요인, 다음결정, 다음상담일 (+ 비고)

---

## 9. 목표점검

legacy `GOAL_CHECK_HEADERS`(`counseling-manager/code.gs.txt:187-190`), 14개 컬럼 — v1과 구조가 가장 근접한 탭 중 하나(`database-schema.md`가 이미 언급).

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | checkId | 점검ID | 일치(ID방식 변경) |
| 2 | tenantId | (없음) | 신규 |
| 3 | goalId | 목표ID | 일치(개명) |
| 4 | checkedAt | 점검일 | 일치 |
| 5 | result | 결과 | 일치 |
| (없음) | 케이스번호 | 미반영(TBD) | legacy는 목표점검에서도 케이스번호를 중복 보유(조인 대신 직접 저장) — v1은 goalId만 거쳐 간접 연결(설계 차이, 의도적) |

**미반영(TBD) legacy 필드 7개**: 실제횟수, 달성률, 학생소감, 어려움, 도움요인, 다음결정, 다음상담일 (+ 담당자, 비고)

---

## 10. 효과평가

legacy `EFFECT_HEADERS`(`counseling-manager/code.gs.txt:167-174`), 28개 컬럼 vs v1 5개 컬럼.

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | evaluationId | 평가ID | 일치(ID방식 변경) |
| 2 | tenantId | (없음) | 신규 |
| 3 | caseId | 케이스번호 | 일치(개명) |
| 4 | timepoint | 평가시점 | 일치(`사전`/`사후`) |
| 5 | createdAt | 평가일 | 일치(의미 근사) |

**미반영(TBD) legacy 필드 23개**: 식생활만족도, 목표이해, 실천자신감, 변화중요도, 변화준비도, 목표행동명, 목표행동실천횟수, 실천방법이해, 도움요청능력, 상담만족도, 상담도움정도, 도움된점, 어려웠던점, 유지할행동, 상담후달라진점, 추가상담필요, 영양교사에게한말, 도움요인선택, 방해요인선택, 응답출처, 폼제출일시, 교사종합평가, 담당자 (+ 비고)

> Google Form 연동(`ensureEffectEvaluationForm_`) 자체를 v1에서 유지할지도 미결정(`database-schema.md` 2.10절).

---

## 11. 성장측정

legacy `GROWTH_HEADERS`(`counseling-manager/code.gs.txt:176-181`), 13개 컬럼 — v1과 구조가 가장 근접(`database-schema.md`가 이미 언급).

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | measurementId | 측정ID | 일치(ID방식 변경) |
| 2 | tenantId | (없음) | 신규 |
| 3 | caseId | 케이스번호 | 일치(개명) |
| 4 | measuredAt | 측정일 | 일치 |
| 5 | height | 신장_cm | 일치(개명) |
| 6 | weight | 체중_kg | 일치(개명) |
| (없음) | 측정시점 | 미반영(TBD) | `사전`/`사후` 구분 — v1엔 없음, 진단결과의 timepoint와 역할 중복 가능성 검토 필요 |

**미반영(TBD) legacy 필드 5개**: BMI, 신장백분위, 체중백분위, BMI백분위, 자료출처 (+ 비고, 등록자)

---

## 12. 다음회기준비

legacy `NEXT_PREP_HEADERS`(`counseling-manager/code.gs.txt:192-199`), 32개 컬럼 vs v1 6개 컬럼.

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | preparationId | 준비ID | 일치(ID방식 변경) |
| 2 | tenantId | (없음) | 신규 |
| 3 | caseId | 케이스번호 | 일치(개명) |
| 4 | sessionId | 기준회기ID | 일치(개명) |
| 5 | content | 회기목표(개념상 가장 근접) | 부분 일치 |
| 6 | createdAt | 생성일 | 일치 |

**미반영(TBD) legacy 필드 26개**: 기준회기, 준비회기, 상담영역, 주요장벽, 학년, 상담시간, 상담단계, 재료유형, 추가요청, 상담질문, 상담기법, 추천재료, 체험활동, 행동실험, 다음확인질문, 연계확인사항, 시간별진행안, 상담후기록틀, 실제실시활동, 학생새발언, 학생선택행동실험, 교사관찰반응, 다음확인내용, 상태, 상담기록전환, 담당자 (+ 비고)

---

## 13~14. 맛마을검사 / 맛마을결과

legacy taste-village는 이 두 v1 탭과 **1:1로 대응하지 않는다** — taste-village는 7개 탭(`학생계정`/`회기활동`/`급식성찰`/`실천미션`/`미션점검`/`스티커북`/`매니저연계`, `docs/google-data-inventory.md` 2절)으로 구성되어 있고, v1의 "맛마을검사"/"맛마을결과" 2탭 구조는 taste-village 데이터를 단순화한 **목표 스키마**일 뿐 실제 매핑은 아직 수행되지 않았다.

| v1 헤더 | 상태 |
|---|---|
| 전체 | **미반영/확인 필요** — `database-schema.md` 2.13/2.14절이 이미 "taste-village 심층분석 전이라 이번 라운드에서 확정하지 않음"으로 명시. 이번 상담접수 조사 범위에도 포함되지 않았다. studentId→studentUuid 통일만 이번에 반영함(1절) |

---

## 15. 생성문서

| v1 헤더 | legacy 대응 | 상태 |
|---|---|---|
| docId, tenantId, caseId, fileName, driveFileId, createdAt | **확인 필요** | legacy `생성문서`(`SHEETS.DOCS`)는 이번 재조사로도 헤더 정의(상수 배열이든 `appendObject_` 호출이든)를 전혀 찾지 못했다. 유일한 단서는 정리(cleanup) 로직의 `{ sheetName: SHEETS.DOCS, keyHeader: '케이스번호' }`(`counseling-manager/code.gs.txt:6010`)뿐 — "케이스번호로 조인된다"는 것만 알 수 있고 나머지 컬럼 구성 근거가 없다. **v1 구조가 legacy와 대응되는지 확인할 근거 자체가 없음**(추측 금지 원칙에 따라 매핑표 작성 불가) |

---

## 16. 일정관리

legacy `DASHBOARD_SCHEDULE_HEADERS`(`counseling-manager/code.gs.txt:65-77`), 11개 컬럼 vs v1 5개 컬럼.

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | scheduleId | 일정ID | 일치(ID방식 변경) |
| 2 | tenantId | (없음) | 신규 |
| 3 | caseId | 케이스번호 | 일치(개명) |
| 4 | scheduledAt | 일정일(+시작시간) | 부분 일치 | legacy는 일정일과 시작/종료시간이 분리, v1은 datetime 1개로 병합 |
| 5 | title | 제목 | 일치 |

**미반영(TBD) legacy 필드 6개**: 종료시간, 일정유형, 학생명(직접입력 중복컬럼 — `database-schema.md` 2.16절이 이미 "위험 패턴"으로 지적, v1은 caseId 조인으로 대체 권장), 메모, 생성일시, 수정일시

---

## 17. 일정완료

legacy `DASHBOARD_COMPLETION_HEADERS`(`counseling-manager/code.gs.txt:79-89`), 9개 컬럼 vs v1 4개 컬럼.

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | completionId | 완료키 | 일치(개명) |
| 2 | tenantId | (없음) | 신규 |
| 3 | scheduleId | (원본ID, 원본구분='일정'일 때만 해당) | 부분 일치 | legacy는 일정 외 다른 완료 대상도 포괄(`원본구분`), v1은 일정 전용으로 단순화(`database-schema.md`가 이미 명시한 의도적 결정) |
| 4 | completedAt | 완료일시 | 일치 |

**미반영(TBD) legacy 필드 5개**: 원본구분(v1엔 없음 — 일정 전용으로 단순화됐으므로 구조상 불필요), 케이스번호, 일정일, 일정명, 완료여부(v1은 행 존재=완료로 간주하는 구조로 추정, 수정일시)

---

## 18. 변경이력

legacy `log_`(`counseling-manager/code.gs.txt:5940-5950`), 8개 컬럼 vs v1 6개 컬럼.

| # | v1 헤더 | legacy 대응 헤더 | 상태 |
|---|---|---|---|
| 1 | logId | 로그ID | 일치(ID방식 변경) |
| 2 | tenantId | (없음) | 신규 |
| 3 | actor | 사용자 | 일치(개명) |
| 4 | action | 작업유형 | 일치 |
| 5 | targetId | 대상ID | 일치 |
| 6 | timestamp | 일시 | 일치 |

**미반영(TBD) legacy 필드 2개**: 대상시트(어느 탭이 바뀌었는지), 변경내용(diff 내용) — `database-schema.md` 2.18절이 이미 "v1에 없음"으로 명시.

---

## 전체 요약

| 탭 | legacy 컬럼 수 | v1 컬럼 수 | 미반영 legacy 필드 수 | 비고 |
|---|---|---|---|---|
| 설정 | 3(추정, 3번째 열 불명) | 2 | - | 키-값 구조라 컬럼 수 비교 의미 낮음 |
| 학생정보 | 9 | 10 | 1(비고) | 이번에 schoolYear 추가로 legacy와 필드 커버리지가 가장 근접해짐 |
| 상담접수 | 19 | 6 | 13 | Milestone 4 착수 시 대폭 확장 필요 |
| 보호자동의 | 21(20+짧은코드) | 8 | 13 | 동일 |
| 상담케이스 | 12 | 6 | 6 | intakeId FK 추가 등 Milestone 4/5에서 확장 |
| 진단결과 | 54 | 6 | 48 | 가장 민감하고 가장 축소된 탭 |
| 상담회기 | 23 | 6 | 17(+SOAP/PES 구조 보류) | |
| 실천목표 | 17 | 6+1(currentStatus 신규) | 11 | |
| 목표점검 | 14 | 5 | 7 | v1과 가장 근접 |
| 효과평가 | 28 | 5 | 23 | |
| 성장측정 | 13 | 6 | 5 | v1과 가장 근접 |
| 다음회기준비 | 32 | 6 | 26 | |
| 맛마을검사/결과 | (taste-village 7탭, 미매핑) | 4+6 | 전체 확인 필요 | taste-village 심층분석 이후 |
| 생성문서 | 확인 불가 | 6 | 확인 불가 | legacy 헤더 정의 자체를 못 찾음 |
| 일정관리 | 11 | 5 | 6 | |
| 일정완료 | 9 | 4 | 5(구조 단순화로 일부 불필요) | |
| 변경이력 | 8 | 6 | 2 | |

**해석**: v1이 "축소"한 것처럼 보이는 탭 대부분(진단결과/상담회기/효과평가/다음회기준비)은 **삭제 결정이 아니라 아직 해당 마일스톤에 도달하지 않아 최소 골격만 있는 상태**다(`installTemplate.ts` 상단 주석, `database-schema.md` 0절과 일치). 이번 문서의 "미반영(TBD)" 필드 목록은 각 마일스톤 착수 시 그대로 반영 여부를 결정하는 체크리스트로 쓸 수 있다 — **임의로 빠뜨리지 않는다는 원칙(사용자 지정)에 따라 여기 나열된 필드는 전부 legacy에 실재하는 필드이며, 향후 "확인 필요"가 아니라 "반영할지 결정 필요" 상태다.**
