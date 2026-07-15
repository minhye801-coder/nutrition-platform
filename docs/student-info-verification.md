# 학생정보 기능 검증 보고서 (student-info-verification)

> 이 문서는 `legacy/counseling-manager/code.gs.txt`(6892줄), `legacy/intake-consent/code.gs.txt`(329줄), `legacy/taste-village/{code.gs,homeBadge.gs,MealApi.gs,WebApp.gs}`를 직접 열람·grep하여 재검증한 결과이며, 모든 서술에 `파일:라인` 근거를 붙였습니다. 확인하지 못한 부분은 "확인 필요"로 명시했습니다. 코드는 수정하지 않았습니다(분석 전용).

---

## 1. 학생정보를 읽거나 쓰는 모든 함수 (전수 조사)

### 1.1 `legacy/counseling-manager/code.gs.txt`

| 함수 | 라인 | 역할 |
|---|---|---|
| `studentMap_()` | `5836-5840` | `학생정보` 전체를 `{학생코드: row}` 맵으로 읽음(읽기 전용, 캐시 없이 매번 재조회) |
| `findStudent_(schoolYear, grade, classNo, studentNo, studentName)` | `5842-5851` | 학년도+학년+반+정규화이름(+선택적 번호)으로 기존 학생 탐색(2절 상세) |
| `upsertStudent_(obj)` | `5853-5855` | `updateOrAppendByKey_`를 `학생코드` 키로 호출 — 있으면 갱신, 없으면 추가 |
| `createCaseFromIntakeRow_(row)` | `2990-3059` | 접수 승인 시 `findStudent_` → 없으면 `nextId_`로 신규 `학생코드` 채번 후 `upsertStudent_` 호출(`2993-3011`) |
| `listStudentCaseOptions(statuses)` | `3061-3084` | `상담케이스`를 `studentMap_()`으로 조인해 학생명/학년반 표시 |
| `listAllStudentCaseOptions()` | `3085` | 위와 유사(전체 케이스 대상, 상세는 확인 필요) |
| `getStudentCounselingOverview(caseId)` | `3170`, `3190` 이하 | `학생정보`를 `학생코드`로 조인해 학생 종합화면 구성 |
| `saveStudentAssent(payload)` | `3682` | 학생 참여의사 저장(보호자동의 관련, `학생정보` 직접 쓰기는 아님 — 확인 필요) |
| `extractDiagnosisWithGemini_(blobs, student)` | `4015` | 진단 PDF Gemini 추출 시 `student` 객체(학년/반/이름)를 프롬프트 컨텍스트로 사용 |
| `syncTasteMindCase_(caseId, options)` | `1409-1569` | `studentMap_()[caseRow['학생코드']]`로 학생 조회(`1417`) 후 taste-village `학생계정` 시트에 학년도/학년/반/번호/학생명을 복제 기록(`1511-1517`) |
| `formatGradeClass_(student)` | `6868` | 학년/반 표시 포맷 유틸 |
| `deleteSelectedTestData(caseIds)` | `6139-6360`대 | **테스트 데이터 정리 기능**. 선택 케이스 삭제 후, 남은 케이스가 없는 학생만 `학생정보`에서 하드 삭제(`6303-6328`). 일반 "학생 삭제" 기능이 아니라 관리자용 정리(cleanup) 도구(`6137` 주석) |

### 1.2 `legacy/intake-consent/code.gs.txt`

| 함수 | 라인 | 역할 |
|---|---|---|
| `submitPublicIntake_`(`36-80`) | `56-62` | 공개 신청 제출 시 `학생정보`에는 쓰지 않음 — `상담접수`에 `학생코드:''`(빈값, `57`), `학생명`(`62`)만 저장. **학생정보 연결은 승인 시점(counseling-manager)까지 없음** |
| `getConsentPageData`(`82-108`) | `92-93, 100-102` | `학생정보`를 `학생코드`로 조회 후 `maskName_()`로 마스킹된 이름만 노출(`100`, `318-323`), 학년/반은 마스킹 없이 노출(`101-102`) |
| `submitGuardianConsent`(`~141-217`) | `141-142` | 위와 동일하게 `학생정보`를 읽어 문서 본문에 이름/학년/반 삽입(`197`) |

### 1.3 `legacy/taste-village/*`

`학생정보` 시트 자체(메인 스프레드시트)를 직접 읽는 코드는 taste-village에 **없습니다**(확인됨 — taste-village는 자신의 스프레드시트만 `getActiveSpreadsheet()`로 열며 `openById`로 메인 시트에 접근하는 코드가 없음). 대신 counseling-manager가 밀어넣은 사본을 자신의 `학생계정` 시트에서 사용합니다.

| 함수 | 파일:라인 | 역할 |
|---|---|---|
| `verifyStudentExplorerLogin(payload)` | `code.gs:565-598` | `학년`+`반`+정규화이름+`탐험코드`로 `학생계정` 시트에서 로그인 매칭(3절 상세) |
| `syncManagerStudents`(구조상 존재 추정) | — | **확인 필요** — 정확한 함수명/라인을 재확인하지 못함. `학생계정` 갱신은 counseling-manager 쪽 `syncTasteMindCase_`가 대부분 수행(`1505-1533`) |
| `getExplorerAccountByCaseId` | `code.gs:596` 호출부 확인 | 케이스번호로 계정 조회. 정의부 라인은 확인 필요 |

---

## 2. `학생정보` 시트의 실제 헤더 전체와 각 열 용도

명시적인 `STUDENT_HEADERS` 상수 배열은 코드에 없습니다(다른 시트들, 예 `DASHBOARD_SCHEDULE_HEADERS`(`65-77`), `GROWTH_HEADERS`(`176`)와 달리). 대신 `createCaseFromIntakeRow_`의 `upsertStudent_` 호출 객체 리터럴(`3000-3010`)에서 실제 쓰는 열 전체를 확인했습니다:

| 열 | 자료형(코드상 근거) | 근거 |
|---|---|---|
| `학생코드` | string, `"{PREFIX}-0001"` 형식(기본 프리픽스 `S`) | `2999`(`nextId_`), `5917-5926`(순번 카운터, 잠금 없음) |
| `학년도` | number | `3002`, `findStudent_`에서 `Number(r['학년도'])` 비교(`5845`) |
| `학년` | number | `3003` |
| `반` | number | `3004` |
| `번호` | string 또는 빈값 허용 | `3005`(`row['번호'] || ''`) |
| `학생명` | string | `3006` |
| `재학상태` | string, 생성 시 `'재학'` 고정 | `3007` — **이 값을 읽거나 필터링하는 코드는 legacy 전체에 없음**(`grep "재학상태" Index.html` 0건) |
| `등록일` | Date | `3008` |
| `비고` | string, 생성 시 빈값 | `3009` |

총 9개 열. 순서(물리 열 위치)는 헤더 원본이 저장소에 없어 **확인 필요**입니다(코드는 헤더명으로 값을 매칭하므로 순서에 의존하지 않음, `appendObject_` `5857-5863`).

---

## 3. 학생을 찾고 연결하는 기존 식별 방식

### 3.1 `findStudent_` 정확한 매칭 로직 (`5842-5851`)

```javascript
function findStudent_(schoolYear, grade, classNo, studentNo, studentName) {
  const normalizedName = normalize_(studentName);
  return getSheetObjects_(SHEETS.STUDENTS).find(r =>
    Number(r['학년도']) === Number(schoolYear) &&
    Number(r['학년']) === Number(grade) &&
    Number(r['반']) === Number(classNo) &&
    normalize_(r['학생명']) === normalizedName &&
    (!studentNo || !r['번호'] || Number(r['번호']) === Number(studentNo))
  );
}
```

- **매칭 필드**: 학년도(숫자), 학년(숫자), 반(숫자), 정규화된 학생명(필수), 번호(조건부).
- **이름 정규화**(`normalize_`, `6874-6876`): 공백 전체 제거 + 소문자화. 오탈자·표기 차이는 흡수하지 못함.
- **번호 비교의 특이점**: `!studentNo || !r['번호']` — **신규 요청의 번호가 없거나, 기존 학생 레코드의 번호가 없으면 번호 비교 자체를 건너뜁니다.**
- **선형 탐색**: `Array.find`로 전체 학생정보를 매번 순회(`5844`), 인덱스 없음.

### 3.2 이 방식의 실패 사례 (코드로 확인됨)

1. **거짓 음성**: 이름에 공백/오탈자가 있으면 매칭 실패 → 새 `학생코드` 발급 → 동일 학생이 두 레코드로 분리.
2. **거짓 양성**: 같은 학년·반에 동명이인이 있고 둘 다 번호가 비어 있으면 잘못 연결됨. 사용자 확인 절차 없음(`find()` 결과를 그대로 사용, `2996`).

### 3.3 `학생코드` 채번 방식 (`5917-5926`, `nextId_`)

해당 헤더의 모든 값에서 숫자 접미사를 뽑아 최댓값+1. `LockService` 없이 매번 전체 시트 스캔 — 이론적으로 동시 요청 시 중복 발급 위험이 있으나, `approveIntake`는 `LockService.getScriptLock()`으로 감싸져 있어(`2968-2969`) 승인 경로에서는 직렬화됨. 학생 직접 등록 경로 자체가 legacy에 없으므로 이 위험이 실제 발현되는 지점은 확인되지 않음.

---

## 4. 상담케이스·보호자동의·taste-village 학생계정과의 연결 방식

### 4.1 상담케이스 ↔ 학생정보
- 키: `상담케이스.학생코드`(`3021`) → `학생정보.학생코드`.
- 조회는 항상 `studentMap_()[caseRow['학생코드']]` 형태의 **인메모리 조인**(`3068`, `3089`, `3126`, `3170`, `5653`) — 수식 기반 VLOOKUP은 사용하지 않음(확인됨).
- 학생정보 필드(`학년도/학년/반/학생명`)는 케이스 쪽에 저장되지 않고 매번 조인해서 표시(중복 저장 없음).

### 4.2 보호자동의 ↔ 학생정보
- `보호자동의` 시트 자체에는 `학생코드` 컬럼이 없음(`3034-3055`). **`상담케이스.학생코드`를 거쳐 간접 연결**.
- 공개 동의 페이지는 `caseRow['학생코드']`로 `학생정보`를 조회해 이름을 마스킹(`maskName_`, `intake-consent/code.gs.txt:318-323`)하고 학년/반은 평문 노출(`101-102`).

### 4.3 taste-village 학생계정 ↔ 학생정보
- **API 호출이 아니라 counseling-manager가 taste-village 스프레드시트를 `openById`로 직접 열어 쓰는 구조**(`1426`, `TASTE_MIND_DEFAULTS.SPREADSHEET_ID`).
- `syncTasteMindCase_`(`1409-1569`)가 `학생정보`의 `학생코드/학년도/학년/반/번호/학생명` 5개 필드를 그대로 복제해 `학생계정` 시트에 씀(`1511-1517`). 조인 키는 `학생계정.케이스번호`(`1507`).
- taste-village 로그인(`verifyStudentExplorerLogin`, `code.gs:565-598`)은 **학년+반+정규화이름+탐험코드** 4개로 매칭하며, `학생정보.학생코드`나 `상담케이스.케이스번호`는 로그인 자격 증명에 관여하지 않음(성공 후에야 `케이스번호`로 데이터 조회, `592-596`).
- **결론**: taste-village는 학생정보 시트를 직접 참조하지 않고 counseling-manager가 뿌려주는 사본에만 의존. 자동 재동기화 트리거 존재 여부는 **확인 필요**.

---

## 5. 현재 구현과의 항목별 비교

### 5.1 학생정보 헤더 비교

| legacy 열 | 현재(`studentSheet.ts:7-17`) | 비고 |
|---|---|---|
| `학생코드` | `studentUuid` | 순번 문자열(`S-0001`) → `crypto.randomUUID()`(`studentSheet.ts:261`)로 교체 |
| `학년도` | **없음** | 7절에서 상술 — 매칭 로직 핵심 조건이었음 |
| `학년` | `grade`(string) | legacy는 number, 현재는 string 통일(`database-schema.md` 결정) |
| `반` | `class`(string) | 동일 |
| `번호` | `studentNumber`(string) | 동일 |
| `학생명` | `name` | 명칭만 다름 |
| `재학상태` | `enrollmentStatus`(`재학`/`비활성`) | legacy는 값 자체를 읽는 코드가 없음(6절) |
| `등록일` | `createdAt`(ISO datetime) | Date 객체 → ISO 문자열 |
| `비고` | **없음** | 7절에서 상술 |
| (없음) | `tenantId` | legacy에는 대응 개념 없음(1스프레드시트=1학교 전제가 암묵적으로만 성립) |
| (없음) | `updatedAt` | legacy는 수정 이력을 `변경이력` 시트에만 남김 |

### 5.2 식별/매칭 로직 비교

| 항목 | legacy `findStudent_` | 현재 `findPotentialDuplicate`(`studentSheet.ts:223-243`) |
|---|---|---|
| 매칭 필드 | 학년도+학년+반+이름(+선택적 번호) | 이름+학년+반+번호(학년도 없음) |
| 번호 처리 | 한쪽이라도 비면 비교 생략(느슨함) | `studentNumber` 정확히 일치해야 함(둘 다 빈 문자열이면 일치, 하나만 비면 불일치) |
| 대상 범위 | 전체 학생(재학상태 무관) | `enrollmentStatus === '재학'`인 학생만(`231`) |
| 용도 | **자동 연결**(승인 시 자동 채택, 사용자 확인 없음) | **경고만**(409 응답 후 사용자가 "그래도 등록" 선택) — legacy의 거짓양성 위험을 구조적으로 제거한 설계 |
| 이름 정규화 | 공백 제거+소문자화 | 동일(`normalizeName`, `studentSheet.ts:154-156`) |

### 5.3 CRUD·API 비교

| 기능 | legacy | 현재 |
|---|---|---|
| 목록 조회 | `studentMap_()`(전체, 필터 없음) | `GET /api/students`(이름검색·학년·반·상태 필터) |
| 단건 조회 | 없음(항상 케이스 통해 간접 조회) | **없음**(`[studentUuid]/index.ts`는 PATCH만, GET 없음 — 5.5절) |
| 생성 | 접수 승인의 부산물로만 발생. **독립 "학생 직접 등록" 기능이 legacy에 없음** | `POST /api/students`(독립 기능, 중복 경고 포함) |
| 수정 | 없음(재학상태 포함 수정 UI/함수 없음, 확인됨) | `PATCH /api/students/:studentUuid` |
| 비활성/복원 | 없음 | `POST .../deactivate`, `POST .../restore`(soft delete) |
| 삭제(하드) | `deleteSelectedTestData`(테스트 정리 전용) | 없음(설계상 의도적 배제로 보임) |

### 5.4 화면 비교
- legacy `Index.html`에는 학생정보를 독립적으로 관리하는 탭/화면이 없음(`cases` 탭에서 "학생·상담 통합검색"으로만 간접 노출). 현재 `StudentsPage.tsx`는 legacy에 없던 **완전히 새로운 화면**이며, 이는 축소가 아니라 `docs/counseling-workflow-v1.md`의 "학생 직접 등록은 보조 흐름" 설계와 일치.

### 5.5 발견된 gap: 단건 조회 API 부재
`functions/api/students/[studentUuid]/index.ts`에는 `onRequestPatch`만 있고 `onRequestGet`이 없음. 상담케이스 상세 화면(향후 마일스톤)에서 필요해질 gap.

---

## 6. `studentUuid`/`tenantId`/비활성 처리가 legacy 기능에 미치는 영향

### 6.1 `학생코드`(순번 문자열) → `studentUuid`(UUID)
- legacy 어디에도 `학생코드`의 **포맷**에 의존하는 파싱 로직은 없음 — 모든 참조가 문자열 완전 일치 비교이거나 `nextId_`가 숫자 접미사만 추출(`5921-5923`)하는 용도. **UUID로 바뀌어도 조회/조인 자체는 깨지지 않음.**
- 단, **"legacy 스프레드시트에 남아있는 기존 `학생코드`(예: S-0007)를 그대로 두고 신규 학생만 UUID로 추가하는 혼재 마이그레이션"을 하면, legacy `nextId_`가 UUID를 숫자로 파싱하지 못해(정규식 `/(\d+)$/`) 다음 채번이 오작동할 위험**이 있음 — 이는 "legacy 코드와 신규 코드가 같은 시트를 동시에 사용하는 경우"에만 발생(8절 참고).

### 6.2 `tenantId` 추가
- legacy 시트에는 `tenantId` 개념 자체가 없음(학교당 스프레드시트 1개 전제가 코드 밖에서 성립). 컬럼 추가는 기존 조회 로직에 영향 없음(헤더명 기반 접근이라 새 열 추가는 무시됨).
- **다만 현재 구현도 실제로는 `tenantId`로 필터링하지 않음**(`studentSheet.ts`의 `listStudents`는 스프레드시트 자체가 이미 학교별로 분리돼 있어 `tenantId`를 조회 조건에 쓰지 않음, `193-217`) — `tenantId`는 현재 감사/표시용 메타데이터일 뿐, 접근 제어는 "스프레드시트 자체가 사용자별로 분리"라는 상위 구조가 담당(`requireInstalledAccess.ts:37-47`).

### 6.3 비활성 처리(`enrollmentStatus`)
- **legacy는 `재학상태` 값을 생성 시 `'재학'`으로 한 번 쓸 뿐(`3007`), 어디서도 읽거나 필터링하지 않음**(재확인 완료). legacy에는 "비활성 처리" 개념 자체가 없었고, 유일한 삭제 경로는 `deleteSelectedTestData`의 하드 삭제뿐.
- 현재의 소프트 삭제는 **legacy 기능의 변형이 아니라 완전히 새로 추가된 기능**이며, legacy 상담케이스/보호자동의/taste-village 연동에 미치는 영향은 없음(그 어떤 조인 로직도 재학상태를 조건절에 쓰지 않음).
- **결정 필요**: 향후 상담케이스 자동 생성(승인 시 학생 매칭 재구현)에서 "비활성 학생을 매칭 대상에서 제외할지" — 현재 `findPotentialDuplicate`는 이미 재학생만 대상이지만 이는 "중복 경고" 용도이지 상담케이스 자동연결용 매칭 함수가 아직 없으므로 미결정 상태(`counseling-workflow-v1.md` 7절 미결정 1과 동일 사안).

---

## 7. 누락된 필드와 수정이 필요한 부분

### 7.1 legacy에 있으나 현재 구현에 없는 필드

| 필드 | legacy 근거 | 실사용 여부 | 권고 |
|---|---|---|---|
| `학년도`(school year) | `3002`, `findStudent_`의 1차 매칭 조건(`5845`) | **매칭 로직의 핵심 조건**(학년도가 다르면 다른 학생으로 취급) — 단순 표시용 아님 | 상담접수 자동생성 구현 전에 반드시 추가 여부 결정 필요. 학년/반만으로는 여러 해에 걸친 학생을 구분할 수 없음(같은 반이 매년 다른 학생) |
| `비고`(자유 메모) | `3009` | 생성 시 항상 빈 값 — 실제 입력 사례 확인 안 됨(**확인 필요**) | 우선순위 낮음 |

### 7.2 필드명/구조 불일치 (내부 정합성 문제)

**`installTemplate.ts`의 다른 탭들이 여전히 `studentId`를 쓰고 있어 `studentUuid`와 이름이 불일치합니다.**
- `상담접수` 헤더: `['intakeId', 'tenantId', 'studentId', ...]`(`installTemplate.ts:56`)
- `상담케이스` 헤더: `['caseId', 'tenantId', 'studentId', ...]`(`installTemplate.ts:73`)
- `맛마을검사`/`맛마을결과` 헤더도 `studentId`(`installTemplate.ts:105, 113`)
- 반면 `docs/database-schema.md` 2.3/2.5절과 `studentSheet.ts`는 전부 `studentUuid`로 명명.
- **이는 legacy 대비 누락이 아니라, Milestone 2 학생정보 확정 작업이 아직 다른 탭 헤더에 소급 반영되지 않은 상태** — 상담접수/상담케이스 구현 착수 전 `installTemplate.ts`의 `studentId → studentUuid` 일괄 수정이 선행되어야 하며, 이미 설치된 스프레드시트가 있다면 헤더 마이그레이션도 필요.

### 7.3 자료형 관련
- `grade`/`class`/`studentNumber`를 string으로 통일한 결정(`database-schema.md` 2.2절)은 legacy의 `Number(...)` 강제 변환(`5845-5847`)과 다름 — 이미 의도적 결정으로 확정돼 있으므로 문제는 아니지만, 향후 상담케이스 자동생성에서 legacy 스타일 숫자 비교가 재도입되지 않도록 주의 필요(문자열 `"01"`과 `"1"`은 다른 값으로 취급됨).

---

## 8. 기존 데이터가 있을 때 마이그레이션 방법

**전제**: 이 저장소에는 실제 legacy 스프레드시트 데이터 export가 없으므로(`legacy/sheet-structure/README.md` 비어 있음), 아래는 코드 구조에서 도출한 **절차 설계**이며 실제 데이터 검증은 하지 않았습니다.

### 8.1 마이그레이션이 필요한 이유
- legacy `학생정보`는 `학생코드`(순번 문자열), `학년도`(숫자) 등 9개 필드.
- 현재 스키마는 `studentUuid`(UUID), `tenantId`, `enrollmentStatus`, `updatedAt`을 추가로 요구하고 `학년도`가 없음.
- 같은 시트 이름(`학생정보`)을 쓰므로, legacy 운영 학교가 전환할 때 시트를 재사용할지 새로 만들지부터 결정해야 함.

### 8.2 제안 절차

1. **legacy 원본 백업**: 대상 스프레드시트를 복제해 원본 보존.
2. **`학생코드` → `studentUuid` 매핑 테이블 생성**: 각 행에 `crypto.randomUUID()`를 새로 발급하고 `{legacy학생코드: newStudentUuid}` 매핑 저장 — 상담케이스/보호자동의/taste-village 학생계정의 `학생코드` 참조를 함께 치환할 때 필요(4절에서 확인한 대로 여러 시트가 동일 값을 참조하므로 일관 적용 필수).
3. **헤더 변환**: `학생코드→studentUuid`(값 치환), `학년→grade`(문자열화), `반→class`, `번호→studentNumber`, `학생명→name`, `재학상태→enrollmentStatus`(legacy가 전부 `'재학'`이므로 그대로 매핑 가능), `등록일→createdAt`(Date→ISO 문자열), `tenantId`(신규, `schoolPublicId` 삽입), `updatedAt`(신규, `createdAt`과 동일값 초기화).
4. **`학년도` 처리 결정 필요**: (a) 열을 추가해 그대로 이관하거나 (b) 폐기 — 7.1절 미결정 사항과 동일, 이 문서에서 임의로 정하지 않음.
5. **연쇄 참조 갱신**: 2번 매핑표로 `상담케이스.학생코드`, `taste-village.학생계정.학생코드`(및 복제된 학년도/학년/반/학생명)까지 일괄 치환 필요. 상담케이스/taste-village 스키마가 아직 확정되지 않았으므로, **학생정보 단독으로는 마이그레이션을 완결할 수 없고 상담케이스 스키마 확정과 동시에 진행해야** 실행 가능.
6. **중복 학생코드 사전 정리**: 3절에서 확인한 거짓음성/거짓양성 이력으로 인해, 실제 운영 데이터에는 동일 학생이 여러 `학생코드`로 중복 등록돼 있을 가능성이 구조적으로 존재. 자동 병합 금지, 사람이 먼저 검토하는 단계 권고(`database-schema.md` 3절 원칙과 동일).
7. **`nextId_` 충돌 방지**: 마이그레이션 이후에도 같은 시트에서 legacy 코드가 계속 실행될 가능성이 있다면 UUID 값에 대해 `nextId_`의 정규식이 어떤 값을 추출하는지 사전 테스트 필요 — 동시 운영 시나리오 자체가 실제로 발생하는지는 **확인 필요**(전면 전환을 전제한다면 해당 없음).

### 8.3 이번 범위에서 결정하지 않은 것
- 마이그레이션 수행 주체(사용자 셀프서비스 vs 관리자 수동 스크립트)와 실행 시점(설치 시 자동 감지 vs 별도 메뉴)은 범위 밖.

---

## 요약: 즉시 결정이 필요한 항목

1. `학년도` 필드를 학생정보에 추가할지 (상담케이스 매칭 로직의 핵심 조건이었음, 7.1절)
2. `installTemplate.ts`의 `상담접수`/`상담케이스`/`맛마을검사`/`맛마을결과` 헤더가 여전히 `studentId`로 남아있어 `studentUuid`와 불일치 — 상담접수 구현 착수 전 수정 필요(7.2절)
3. 비활성(`enrollmentStatus`) 학생을 상담케이스 자동 매칭 대상에서 제외할지 (6.3절, `counseling-workflow-v1.md` 7절 미결정 1과 연동)
4. 학생 단건 조회 GET API 부재 — 상담케이스 상세 화면 구현 시 필요(5.5절)
