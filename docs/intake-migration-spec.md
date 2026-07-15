# 상담접수 이전 명세 (intake-migration-spec)

> 조사 범위: `legacy/intake-consent/*`, `legacy/counseling-manager/code.gs.txt`(상담접수·보호자동의 관련), `legacy/counseling-manager/Index.html`(intakes/consents 섹션). 코드는 수정하지 않았습니다. 모든 서술은 `파일경로:라인번호` 근거를 달았고, 근거를 찾지 못한 부분은 "확인 필요"로 표시했습니다.
>
> **관련 문서**: `docs/counseling-workflow-v1.md`, `docs/feature-priority-v1.md`, `docs/route-and-menu-plan.md`(설계 초안), `docs/database-schema.md`(탭/헤더 SSOT), `docs/student-info-verification.md`(학생정보 검증).

---

## 0. 요약 — `counseling-workflow-v1.md`와 실제 legacy 코드의 불일치 (가장 중요한 발견)

기존 설계 문서(`docs/counseling-workflow-v1.md`)를 실제 legacy 코드로 재검증한 결과, **2건의 명확한 불일치**를 발견했습니다. 이 문서를 그대로 갱신하지는 않았으며(범위 밖), 아래에 사실만 기록합니다 — 반영 여부는 사용자 확인 필요.

| # | `counseling-workflow-v1.md`의 서술 | 실제 legacy 코드 확인 결과 | 판정 |
|---|---|---|---|
| 1 | 4.2절: 보호자동의 상태값 `미발송/발송/제출/확인완료`에 `거부`를 **"v1 신규 추가"**로 명시 | `intake-consent/code.gs.txt:156`에서 보호자가 비동의를 선택하면 `확인상태`가 **`'비동의'`**로 저장됨. `counseling-manager/code.gs.txt:3664`(`markConsentSent`), `:3737`(`confirmGuardianConsent`), `Index.html:1583`(`consentStatusClass`)이 모두 `'비동의'` 상태를 별도 처리하는 기존 로직을 갖고 있음. **"거부"(비동의)는 legacy에 이미 존재하는 상태이며 v1 신규가 아님.** | **불일치 — 정정 필요** |
| 2 | 4.1절: 상담접수 상태값을 legacy `신규 접수/접수 완료/검토 대기/케이스 생성` **4단계가 실제로 동작**하는 것처럼 서술 | `listPendingIntakes`(`code.gs.txt:2947`)의 필터 배열에는 4개 값이 모두 있지만, 실제로 **저장 코드가 존재하는 값은 `'신규 접수'`(제출 시, `intake-consent/code.gs.txt:67`)와 `'케이스 생성'`(승인 시, `code.gs.txt:2979`) 단 2개뿐**. `'접수 완료'`/`'검토 대기'`로 전이시키는 코드는 3개 프로젝트 전체에서 발견되지 않음(교사가 시트를 직접 수동으로 고칠 때만 발생 가능한 값으로 추정 — 확인 필요). "검토중" 상태 전이 UI/API도 없음. | **불일치 — "4단계가 실제로 동작"이라는 서술은 과장, 정정 필요** |

또한 `counseling-workflow-v1.md` 5절 규칙3의 "consentToken은 링크 발송 액션 시점에 생성(legacy와 동일한 타이밍)"이라는 서술은 **부정확**합니다. legacy는 토큰/링크 **생성**(`generateConsentLink`, "동의 링크 생성" 버튼)과 **발송 표시**(`markConsentSent`, "발송 처리" 버튼)가 **서로 다른 두 개의 액션**이며, 토큰은 발송 표시가 아니라 **링크 생성 시점**에 이미 만들어집니다(8절 참고).

---

## 1. 상담신청 페이지(`Intake.html.txt`)의 모든 입력 항목과 유효성 검사

### 1.1 클라이언트 폼 필드 전체

| name 속성 | 라벨 | 입력 종류 | 필수 | 옵션/제약 | 근거 |
|---|---|---|---|---|---|
| `website` | (숨김, 허니팟) | text, `tabindex=-1`, `class=hp` | 아니오 | 값이 채워지면 스팸으로 간주 | `Intake.html.txt:23` |
| `schoolYear` | (숨김) | hidden | - | `getPublicConfig()` 응답의 `schoolYear`로 자동 채움 | `Intake.html.txt:24, 65` |
| `applicantType` | 신청자 유형 | select | Y | `학생`/`보호자`/`담임교사`/`보건교사`/`기타 교직원` | `Intake.html.txt:25` |
| `applicantName` | 신청자 이름 | text | Y | - | `Intake.html.txt:26` |
| `relation` | 학생과의 관계 | select | Y | `본인`/`부`/`모`/`보호자`/`담임교사`/`보건교사`/`기타` | `Intake.html.txt:27` |
| `contact` | 보호자 연락처 | tel, `inputmode=numeric`, `maxlength=13` | Y | placeholder: "학생 본인 번호가 아닌 보호자 휴대전화 번호" | `Intake.html.txt:33-41` |
| `grade` | 학년 | select | Y | `1`~`6`(숫자 문자열 value) | `Intake.html.txt:47` |
| `classNo` | 반 | number, `min=1` | Y | - | `Intake.html.txt:48` |
| `studentNo` | 번호 | number, `min=1` | **아니오** | - | `Intake.html.txt:49` |
| `studentName` | 학생 이름 | text | Y | - | `Intake.html.txt:50` |
| `topic` | 상담 주제 | select | Y | `편식·균형 식생활`/`아침식사·결식`/`간식·단 음료`/`체중·성장`/`식품 알레르기`/`식사습관`/`기타` | `Intake.html.txt:51` |
| `requestText` | 상담을 신청하는 이유 | textarea | Y | - | `Intake.html.txt:52` |
| `preferredTime` | 희망 상담 시간 | select | 아니오 | `상관없음`(기본)/`점심시간`/`방과 후`/`영양교사와 협의` | `Intake.html.txt:53` |
| `urgency` | 확인 필요 정도 | select | 아니오 | `일반`(기본)/`가급적 빠른 확인` | `Intake.html.txt:54` |
| `note` | 기타 전달사항 | textarea | 아니오 | - | `Intake.html.txt:55` |
| `privacyConsent` | 개인정보 수집·이용 동의 | checkbox | Y | 체크 시 값 `'동의'`, 아니면 `''` | `Intake.html.txt:56, 66` |

**클라이언트 유효성 검사**: HTML `required` 속성에 의한 브라우저 기본 검증뿐이며, JS 별도 클라이언트측 검증 로직은 없음(`Intake.html.txt:66`의 제출 핸들러는 `FormData`를 그대로 객체화해 전송).

### 1.2 서버측 유효성 검사 (`submitPublicIntake`, `intake-consent/code.gs.txt:36-80`)

| 순서 | 검사 내용 | 근거 |
|---|---|---|
| 1 | 허니팟: `payload.website`가 존재하면 `'잘못된 요청입니다.'` 에러 | `code.gs.txt:37` |
| 2 | 필수값 검사(`validateRequired_`): `applicantType, applicantName, relation, schoolYear, grade, classNo, studentName, topic, requestText, contact, privacyConsent` — **11개 필드**. 값이 `undefined`/`null`/공백문자열(trim 후)이면 에러 | `code.gs.txt:38-41, 300-306` |
| 3 | `privacyConsent !== '동의'`이면 `'상담 접수를 위한 개인정보 수집·이용 동의가 필요합니다.'` 에러 | `code.gs.txt:42` |
| 4 | `LockService.getScriptLock()`으로 동시 제출 직렬화(최대 30초 대기) | `code.gs.txt:44-45` |

**주의**: `studentNo`(번호)는 필수값 목록에 없고 클라이언트 `required`도 없음 — **번호는 공식적으로 선택 입력**입니다.

---

## 2. 신청자 유형별 동작 차이

- 서버(`submitPublicIntake_`)에는 `applicantType`(신청자유형) 값에 따라 분기하는 로직이 **전혀 없습니다**. 모든 유형이 동일하게 저장됩니다(`code.gs.txt:36-80` 전체에 조건문 없음, 확인됨).
- 클라이언트에서만 `applicantType` 선택 시 `relation`(학생과의 관계) select 값을 자동으로 미리 채워주는 편의 기능이 있습니다:
  ```js
  function updateRelation(type){const el=document.querySelector('[name="relation"]');const map={학생:'본인',보호자:'보호자',담임교사:'담임교사',보건교사:'보건교사'};if(map[type])el.value=map[type]}
  ```
  (`Intake.html.txt:67`) — `기타 교직원`은 매핑 테이블에 없어 자동 선택되지 않음. 자동채움 값은 사용자가 직접 바꿀 수 있음(강제 아님).
- **결론**: 신청자 유형에 따른 서버측 동작 차이는 없음. 클라이언트에서 "관계" 필드의 기본값 힌트만 다름.

---

## 3. 상담접수 시트의 실제 전체 헤더

물리적 시트 원본(export)이 저장소에 없으므로, 아래는 `submitPublicIntake_`의 `appendObject_` 호출 객체 리터럴 키 순서에서 역산한 것입니다(`intake-consent/code.gs.txt:51-71`). `appendObject_`(`268-271`)는 헤더명으로 매칭해 쓰므로, 실제 물리 열 순서는 시트 자체가 결정하며 이 순서는 "코드가 기대하는 헤더 이름 목록"으로만 신뢰할 수 있습니다.

| # | 헤더명 | 값 출처 |
|---|---|---|
| 1 | `접수ID` | `nextIntakeId_()` → `REQ-{연도}-{4자리}` |
| 2 | `접수일` | `new Date()`(제출 시각) |
| 3 | `신청자유형` | `payload.applicantType` |
| 4 | `신청자명` | `payload.applicantName` |
| 5 | `학생과의관계` | `payload.relation` |
| 6 | `학생코드` | 제출 시 항상 `''`(빈 값) |
| 7 | `학년도` | `Number(payload.schoolYear)` |
| 8 | `학년` | `Number(payload.grade)` |
| 9 | `반` | `Number(payload.classNo)` |
| 10 | `번호` | `payload.studentNo || ''` |
| 11 | `학생명` | `payload.studentName` |
| 12 | `상담주제` | `payload.topic` |
| 13 | `신청내용` | `payload.requestText` |
| 14 | `희망시간` | `payload.preferredTime || ''` |
| 15 | `긴급도` | `payload.urgency || '일반'` |
| 16 | `처리상태` | 제출 시 항상 `'신규 접수'` |
| 17 | `연락처` | `payload.contact` |
| 18 | `개인정보동의` | 제출 시 항상 `'동의'`(검증 통과했으므로) |
| 19 | `비고` | `payload.note || ''` |

근거: `intake-consent/code.gs.txt:51-71`. counseling-manager 쪽에 별도 헤더 상수(`INTAKE_HEADERS` 등)를 찾지 못함 — **확인 필요**: 물리 시트에 위 19개 외 추가 열이 있는지는 저장소만으로 확정 불가.

---

## 4. 신청 제출 시 생성되는 값과 기본 상태

| 항목 | 생성 로직 | 근거 |
|---|---|---|
| `접수ID` | `nextIntakeId_(sheet, schoolYear)` — 시트 전체 스캔 후 `접수ID` 열에서 정규식 `(\d+)$`로 숫자 추출, 최댓값+1을 4자리 zero-pad. 형식: `REQ-{학년도}-{0000}` | `intake-consent/code.gs.txt:255-266, 49` |
| `접수일` | 서버 `new Date()`(제출 처리 시각, 클라이언트 시각 아님) | `code.gs.txt:50, 53` |
| `처리상태`(기본값) | 항상 `'신규 접수'` — 조건 분기 없음 | `code.gs.txt:67` |
| `학생코드`(기본값) | 항상 `''`(빈 값) — 매칭·생성은 승인 시에만 수행 | `code.gs.txt:57` |
| 채번 동시성 보호 | `LockService.getScriptLock().waitLock(30000)` | `code.gs.txt:44-46` |

응답으로 클라이언트에 반환되는 값은 `{ ok: true, intakeId, submittedAt }` 뿐(`code.gs.txt:72-76`). `submittedAt`은 `formatDateTime_`으로 `yyyy-MM-dd HH:mm` 포맷된 서버 타임존(`Session.getScriptTimeZone()`) 문자열.

**참고**: ID 채번이 "행 스캔 후 max+1" 방식이라 순번 카운터지만, 동시 요청 시 Apps Script 스크립트 락에 의존하는 구조입니다. `database-schema.md` 1절이 이미 지적한 "legacy 순번 카운터 방식은 잠금 없는 동시성 위험"과 일치 — `crypto.randomUUID()` 대체는 이미 결정된 방침이므로 이번 조사에서 새로 제안하는 것은 아닙니다.

---

## 5. 교사 매니저에서 접수 목록을 조회하는 방식

`listPendingIntakes()` (`counseling-manager/code.gs.txt:2945-2965`) 개요:

```js
function listPendingIntakes() {
  return getSheetObjects_(SHEETS.INTAKE)
    .filter(r => ['신규 접수', '접수 완료', '검토 대기'].includes(String(r['처리상태'] || '')))
    .map(r => ({ intakeId, intakeDate, applicantType, applicantName, relation,
                 schoolYear, grade, classNo, studentNo, studentName, topic,
                 requestText, contact, privacyConsent }))
    .reverse();
}
```

- **필터 기준**: `처리상태`가 `신규 접수`/`접수 완료`/`검토 대기` 중 하나인 행만(`케이스 생성`으로 전환된 행 제외). 3절에서 확인했듯 실제로 코드로 생성되는 값은 `신규 접수` 뿐.
- **정렬**: 시트 상 행 순서(오래된 순)를 가져온 뒤 `.reverse()` — **최신 접수가 먼저** 표시됨. 별도 날짜 기준 정렬 없음.
- **반환 필드**: `intakeId, intakeDate, applicantType, applicantName, relation, schoolYear, grade, classNo, studentNo, studentName, topic, requestText, contact, privacyConsent` 14개. `연락처`는 `normalizeContactValue_()`로 정규화 반환. `희망시간`/`긴급도`/`비고`는 목록 응답에 **포함되지 않음**(확인됨).
- **호출 경로**: `getBootstrapData()`(`code.gs.txt:1870-1887`) 안에서 `pendingIntakes: listPendingIntakes()`로 대시보드 최초 로드 시 실려옴. `doGet()`(`1863`) → `Index.html` → 페이지 로드 시 `getBootstrapData()` 호출(`Index.html:1132`) → `renderPendingIntakes(data.pendingIntakes)`(`Index.html:1131`). **개별 접수만 다시 조회하는 API는 없음** — 승인 후에도 항상 `refreshAll()`로 전체 부트스트랩을 다시 불러옴(`Index.html:1581`).

---

## 6. 접수 처리(승인/거절/보류 등) 가능한 액션

### 6.1 UI 상 가능한 액션 (`Index.html:601-605, 1577-1581`)

`상담 접수 관리`(`intakes`) 섹션은 **표 형태 목록 하나와 "케이스 생성" 버튼 하나**만 갖습니다:

```html
<td><button class="btn success" onclick="approveIntake('${escapeJs(r.intakeId)}')">케이스 생성</button></td>
```
```js
function approveIntake(id){if(!confirm('이 접수를 상담 케이스로 생성할까요?'))return; ... .approveIntake(id)}
```
(`Index.html:1581`)

**즉 UI에는 승인(케이스 생성) 액션만 존재합니다. 거절/반려/보류 버튼은 없습니다.** `Index.html`, `code.gs.txt` 전체를 `반려|거절|거부|보류|reject|deny|hold`로 검색했으나 상담접수/보호자동의 문맥에서 일치하는 기능 코드가 없음 — **확인됨, legacy에는 명시적 반려/보류 흐름이 없습니다.**

### 6.2 서버 함수 (`approveIntake`, `counseling-manager/code.gs.txt:2967-2988`)

```js
function approveIntake(intakeId) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const row = getSheetObjects_(SHEETS.INTAKE).find(r => String(r['접수ID']) === String(intakeId));
    if (!row) throw new Error('접수 건을 찾을 수 없습니다.');
    if (String(row['처리상태']) === '케이스 생성') {
      return { ok: true, message: '이미 상담 케이스로 전환된 접수입니다.' };  // 멱등 처리
    }
    const result = createCaseFromIntakeRow_(row);
    updateRowByKey_(SHEETS.INTAKE, '접수ID', intakeId, {
      '처리상태': '케이스 생성',
      '학생코드': result.studentCode,
      '비고': appendText_(row['비고'], '케이스번호: ' + result.caseId)
    });
    log_('APPROVE', SHEETS.INTAKE, intakeId, '공개 접수 승인 및 케이스 생성');
    return result;
  } finally { lock.releaseLock(); }
}
```

- **멱등성**: 이미 `케이스 생성` 상태면 새로 만들지 않고 성공 메시지만 반환.
- **동시성 보호**: `LockService`로 직렬화.
- **부수효과**: `상담접수.처리상태 = '케이스 생성'`, `상담접수.학생코드`에 매칭/생성된 학생코드 기록, `상담접수.비고`에 생성된 케이스번호를 텍스트로 덧붙임(원본 비고를 지우지 않고 이어붙임 — `appendText_` 정확한 구현은 **확인 필요**).
- **가능한 액션은 이 함수 하나뿐**입니다. "검토중" 전이나 "반려" 처리 함수는 존재하지 않습니다.

---

## 7. 승인 시 학생정보와 상담케이스에 생성/수정되는 데이터

`createCaseFromIntakeRow_(row)` (`counseling-manager/code.gs.txt:2990-3059`) 전체 로직:

### 7.1 학생 매칭/생성 (`findStudent_`, `code.gs.txt:5842-5851`)

매칭 실패 시:
```js
studentCode = nextId_(SHEETS.STUDENTS, settings.STUDENT_PREFIX || 'S', '학생코드', 4);
upsertStudent_({
  '학생코드': studentCode, '학년도': schoolYear, '학년': Number(row['학년']),
  '반': Number(row['반']), '번호': row['번호'] || '', '학생명': row['학생명'],
  '재학상태': '재학', '등록일': new Date(), '비고': ''
});
```
(`code.gs.txt:2996-3011`) — 상세 매칭 로직은 `docs/student-info-verification.md` 3절 참고(동일 함수).

### 7.2 상담케이스 생성 (`code.gs.txt:3013-3059`)

```js
caseId = nextId_(SHEETS.CASES, (settings.CASE_PREFIX || 'NC') + '-' + schoolYear, '케이스번호', 4);
folder = createCaseFolder_(caseId, schoolYear);   // Drive 케이스 폴더 즉시 생성(6개 하위폴더 포함)
appendObject_(SHEETS.CASES, {
  '케이스번호': caseId, '학생코드': studentCode, '접수ID': row['접수ID'],
  '접수일': intakeDate, '신청경로': row['신청자유형'], '주상담주제': row['상담주제'],
  '현재단계': '동의 대기', '다음일정': '', '담당자': Session.getActiveUser().getEmail(),
  'Drive폴더URL': folder.getUrl(), '종결일': '', '비고': row['신청내용'] || ''
});
appendObject_(SHEETS.CONSENTS, {
  '케이스번호': caseId, '동의토큰': '', '동의링크': '', '확인상태': '미발송',
  '보호자명': '', '학생과의관계': '', '보호자연락처': normalizeContactValue_(row['연락처']),
  '학생참여의사': '미확인', '상담동의': '미확인', '개인정보동의': '미확인',
  '민감정보동의': '미확인', '진단결과활용동의': '미확인', 'AI보조안내확인': '미확인',
  '발송일': '', '제출일시': '', '동의일': '', '동의서파일URL': '', '확인일': '', '확인자': '', '비고': ''
});
```

- **상담케이스 헤더(역산, 12열)**: `케이스번호, 학생코드, 접수ID, 접수일, 신청경로, 주상담주제, 현재단계, 다음일정, 담당자, Drive폴더URL, 종결일, 비고`
- **보호자동의 헤더(역산, 21열 — `짧은코드`는 `generateConsentLink` 최초 호출 시 자가치유로 추가되는 22번째 열, 8절 참고)**: `케이스번호, 동의토큰, 동의링크, 확인상태, 보호자명, 학생과의관계, 보호자연락처, 학생참여의사, 상담동의, 개인정보동의, 민감정보동의, 진단결과활용동의, AI보조안내확인, 발송일, 제출일시, 동의일, 동의서파일URL, 확인일, 확인자, 비고`
- `케이스번호` 채번: `settings.CASE_PREFIX`(기본 `'NC'`) + `'-'` + 학년도, 4자리 순번(예: `NC-2026-0001`).
- **상담케이스 초기 `현재단계`는 항상 `'동의 대기'`** — `CASE_STATUS_VALUES`(`code.gs.txt:54-63`) 8단계 중 첫 단계.
- **보호자동의 레코드는 승인과 동시에(자동으로) 기본 골격이 만들어짐** — 토큰/링크는 이 시점엔 비어있고, 확인상태는 `'미발송'`.
- `Drive폴더URL`은 `createCaseFolder_()`가 생성한 케이스 폴더 URL — `intake-consent`의 `createConsentPdf_`가 나중에 다시 읽어 PDF 저장 경로를 찾음(`intake-consent/code.gs.txt:185`).
- 로그: `log_('CREATE', SHEETS.CASES, caseId, '공개 접수에서 상담 케이스 생성')`.
- 최종 반환: `{ ok: true, caseId, studentCode, folderUrl }`.

---

## 8. 보호자동의 링크 생성과의 연결

**핵심 확인 사항**: 승인(`approveIntake`) 시점에는 **보호자동의 토큰/링크가 생성되지 않습니다.** 7.2절에서 보듯 `동의토큰`/`동의링크`는 빈 문자열로 생성될 뿐입니다. 토큰 생성은 **교사가 별도로 "동의 링크 생성" 버튼을 눌러야 실행되는 완전히 분리된 액션**입니다.

### 8.1 `generateConsentLink(caseId)` (`counseling-manager/code.gs.txt:3456-3546`)

- 트리거: `consents` 화면 상세 패널의 "동의 링크 생성"/"링크 확인·재표시" 버튼(`Index.html:1625, 1633`).
- `PUBLIC_APP_URL`(설정 시트)이 없으면 즉시 에러.
- `짧은코드` 헤더가 없으면 `ensureSheetHeaders_`로 자가치유 추가(`3473-3476`) — 레거시 스프레드시트에 이 열이 아예 없을 수도 있었다는 뜻.
- **토큰**: 기존 값 재사용 또는 `Utilities.getUuid().replace(/-/g, '')`(하이픈 제거된 UUID, 32자 hex).
- **짧은코드**: 기존 값 재사용 또는 `generateUniqueConsentShortCode_()` — 알파벳 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`(혼동되기 쉬운 `I/O/0/1` 제외) 중 10자 무작위 조합, 최대 1000회 재시도로 중복 회피(`3548-3577`).
- **두 종류의 링크**를 함께 만듦:
  - `shortLink = baseUrl + '?k=' + shortCode`
  - `legacyLink = baseUrl + '?mode=consent&token=' + token`
- `updateOrAppendByKey_`로 `보호자동의` 시트 upsert(케이스번호 키).
- 반환: `{ ok, link: shortLink, shortLink, legacyLink, shortCode, token }`. 클라이언트는 `navigator.clipboard.writeText(r.link)`로 **짧은 링크를 자동 클립보드 복사**(`Index.html:1633`).

### 8.2 ⚠️ 짧은 링크(`?k=`)가 실제로 동작하지 않을 가능성 — 기존 `integration-flow.md` 지적 사항 재확인

`intake-consent/code.gs.txt:17-25`의 `doGet(e)`는 `e.parameter.mode`와 `e.parameter.token`만 읽습니다. `e.parameter.k`를 처리하는 코드가 `intake-consent` 어디에도 없습니다(전수 재확인). **즉 `generateConsentLink`가 클립보드에 복사하는 "짧은 링크"(`?k=...`)는 현재 코드만으로는 `mode` 파라미터가 없어 `Intake.html`(상담신청 폼)로 라우팅되며, `token`도 비어 있어 보호자동의 폼이 열리지 않습니다.** `docs/integration-flow.md` 4절에서 이미 발견된 불일치이며, 이번 재조사로도 동일하게 확인됨(신규 발견 아님).

### 8.3 발송 표시 — `markConsentSent(caseId)` (`code.gs.txt:3611-3680`)

- 트리거: 동의 링크가 이미 생성된 상태에서 "발송 처리" 버튼(`Index.html:1626, 1637-1646`, `canMarkSent = Boolean(link) && !guardianSubmitted && !consentCompleted && !consentRejected`일 때만 노출).
- 이미 보호자가 제출(4개 필수 동의항목 모두 `'동의'`)했다면 상태를 `'교사 확인 필요'`로 정정하고 발송 처리를 건너뜀.
- 그 외의 경우 `확인상태 = '동의 요청'`, `발송일 = 기존값 || now` 기록.

### 8.4 보호자 제출 — `submitGuardianConsent` (`intake-consent/code.gs.txt:110-181`)

- 허니팟(`payload.website`), 필수값(`token, guardianName, relation, contact, decision, signatureName`), **보호자 이름과 전자서명 이름 일치**(`normalize_` 비교) 검사.
- `decision`은 `'동의'`/`'비동의'`만 허용.
- `decision === '동의'`일 때만 5개 필수 체크박스(`counselingConsent, personalConsent, sensitiveConsent, diagnosisUseConsent, aiNotice`) 전부 확인 요구.
- 이미 제출된 상태(`확인상태`가 `'교사 확인 필요'`/`'동의 완료'`/`'비동의'`)면 재제출 거부.
- 제출 시 저장: `보호자명, 학생과의관계, 보호자연락처, 상담동의, 개인정보동의, 민감정보동의, 진단결과활용동의, AI보조안내확인, 제출일시, 동의일(동의일 때만), 확인상태('교사 확인 필요' 또는 '비동의'), 비고`.
- `decision==='동의'`일 때 `createConsentPdf_()`로 PDF 생성 시도 → 성공 시 `동의서파일URL` 저장, 실패해도 **동의 데이터 자체는 저장됨**(PDF 실패는 `비고`에 경고만 덧붙임, `code.gs.txt:160-168`).

### 8.5 교사 최종 확인 — `confirmGuardianConsent(caseId)` (`code.gs.txt:3704-3788`)

- 4개 필수 동의항목이 모두 `'동의'`이고 보호자 제출 흔적(`제출일시`/`동의일`/`동의서파일URL`/`보호자명` 중 하나)이 있어야 통과.
- 통과 시: `확인상태 = '동의 완료'`, `확인일 = now`, `확인자 = 교사 이메일`. **그리고 상담케이스 `현재단계`를 `'동의 대기' → '진단 대기'`로 자동 전이**(`updateCaseStatus(caseId, '진단 대기', '')`, `:3773`). 이미 `'동의 완료'`면 멱등 응답만.
- 부수효과로 `syncTasteMindCaseSafe_()` 호출(맛마을 탐험소 학생계정 동기화 — 이번 조사 범위 밖이나 연결 지점으로 기록).

### 8.6 보호자동의 상태값 전체 (실측, 5가지)

| 상태 | 진입 조건 | 근거 |
|---|---|---|
| `미발송` | 케이스 생성 직후 기본값 | `code.gs.txt:3038` |
| `동의 요청` | 교사 "발송 처리" 액션(`markConsentSent`) | `code.gs.txt:3669` |
| `교사 확인 필요` | 보호자가 `동의`로 제출 | `intake-consent/code.gs.txt:156` |
| `비동의` | 보호자가 `비동의`로 제출 | `intake-consent/code.gs.txt:156` |
| `동의 완료` | 교사 "동의 완료 처리" 액션(`confirmGuardianConsent`) | `code.gs.txt:3768` |

---

## 9. 관련 Apps Script 함수 및 HTML 이벤트 목록

| google.script.run 함수 | 정의 위치 | 트리거하는 HTML 이벤트 | 근거 |
|---|---|---|---|
| `getPublicConfig()` | `intake-consent/code.gs.txt:27-34` | `Intake.html.txt` `DOMContentLoaded` 시 자동 호출 | `Intake.html.txt:65` |
| `submitPublicIntake(payload)` | `intake-consent/code.gs.txt:36-80` | `#intakeForm` `submit`("상담 신청하기" 버튼) | `Intake.html.txt:66` |
| `getConsentPageData(token)` | `intake-consent/code.gs.txt:82-108` | `Consent.html.txt` `DOMContentLoaded` 시 자동 호출 | `Consent.html.txt:54` |
| `submitGuardianConsent(payload)` | `intake-consent/code.gs.txt:110-181` | `#consentForm` `submit`("동의서 제출" 버튼) | `Consent.html.txt:57` |
| `getBootstrapData()` | `counseling-manager/code.gs.txt:1870-1887` | 매니저 앱 최초 로드 시(`refreshAll()`) | `Index.html:1121-1132` |
| `listPendingIntakes()` | `counseling-manager/code.gs.txt:2945-2965` | (직접 호출 안 됨 — `getBootstrapData` 내부에서만 사용) | `code.gs.txt:1878` |
| `approveIntake(intakeId)` | `counseling-manager/code.gs.txt:2967-2988` | `intakes` 섹션 표의 "케이스 생성" 버튼 | `Index.html:1578, 1581` |
| `listConsentCases()` | `counseling-manager/code.gs.txt:3409-3439` | (`getBootstrapData` 내부) | `code.gs.txt:1879` |
| `getConsentDetail(caseId)` | `counseling-manager/code.gs.txt:3441-3454` | `consents` 섹션 표의 "관리" 버튼(`openConsent`) | `Index.html:1584-1585` |
| `generateConsentLink(caseId)` | `counseling-manager/code.gs.txt:3456-3546` | "동의 링크 생성"/"링크 확인·재표시" 버튼 | `Index.html:1625, 1633` |
| `regenerateConsentShortLink(caseId)` | `counseling-manager/code.gs.txt:3579-3609` | **UI 호출 지점을 찾지 못함**(확인 필요) | - |
| `markConsentSent(caseId)` | `counseling-manager/code.gs.txt:3611-3680` | "발송 처리" 버튼 | `Index.html:1626, 1637-1646` |
| `saveStudentAssent(payload)` | `counseling-manager/code.gs.txt:3682-3702` | "학생 참여 의사" 저장 버튼(`saveAssent`) | `Index.html:1648` |
| `confirmGuardianConsent(caseId)` | `counseling-manager/code.gs.txt:3704-3788` | "동의 완료 처리" 버튼(`confirmConsent`) | `Index.html:1647` |
| `saveConsent(payload)` | `counseling-manager/code.gs.txt:3797-3827` | **UI 호출 지점을 찾지 못함**(확인 필요, 수동 편집용 API로 추정) | - |

---

## 10. 필요한 React 화면, Pages Functions API, Google Sheets 접근 모듈 목록 (제안)

> 아래는 legacy에 **실제로 있는** 흐름·상태값만 반영한 제안입니다. 반려/보류 등 legacy에 없는 흐름은 추가하지 않았습니다 — 다만 `feature-priority-v1.md`가 이미 `POST /api/intakes/:intakeId/reject`를 Milestone 2A 항목으로 넣어둔 것은 **legacy에 대응 기능이 없는 v1 신규 결정**임을 명시합니다(사용자 확인 필요).

### 10.1 화면(React, `src/pages/`)

| 화면 | 라우트(`route-and-menu-plan.md` 기준) | legacy 대응 |
|---|---|---|
| 공개 상담신청 폼 | `/intake/:schoolPublicId`(비로그인) | `Intake.html.txt` |
| 접수 목록 | `/intakes` | `Index.html` `intakes` 섹션 |
| 접수 상세(승인 액션) | `/intakes/:intakeId` | `Index.html` 표의 인라인 "케이스 생성" 버튼(legacy는 별도 상세 화면 없이 목록에서 바로 승인) |
| 보호자동의 목록·관리 | `/consents` | `Index.html` `consents` 섹션 |
| 공개 보호자동의 제출 폼 | `/consent/:token` | `Consent.html.txt` |

### 10.2 Pages Functions API (`functions/api/`)

| 엔드포인트 | 목적 | legacy 대응 함수 | 인증 |
|---|---|---|---|
| `POST /api/public/intakes/:schoolPublicId` | 공개 신청 제출 | `submitPublicIntake` | 없음(공개) — 10.4절 참고 |
| `GET /api/public/intakes/:schoolPublicId/config` | 학교명/학년도 등 공개 설정 조회 | `getPublicConfig` | 없음(공개) |
| `GET /api/intakes` | 접수 목록(신규 접수만, `listPendingIntakes` 필터 그대로) | `listPendingIntakes` | 세션 필요 |
| `POST /api/intakes/:intakeId/approve` | 승인 → 학생 매칭/생성 + 케이스 생성 + 동의 기본 레코드 생성(멱등) | `approveIntake` + `createCaseFromIntakeRow_` | 세션 필요 |
| `POST /api/cases/:caseId/consent/link` | 동의 토큰/짧은코드 생성(멱등) | `generateConsentLink` | 세션 필요 |
| `POST /api/cases/:caseId/consent/mark-sent` | 발송 처리(상태 전이만) | `markConsentSent` | 세션 필요 |
| `GET /api/public/consents/:token` | 공개 동의 페이지 데이터(마스킹된 학생명 등) | `getConsentPageData` | 없음(공개) |
| `POST /api/public/consents/:token` | 보호자 제출(동의/비동의) | `submitGuardianConsent` | 없음(공개) — PDF 생성 포함 |
| `POST /api/cases/:caseId/consent/confirm` | 교사 최종 확인 → 케이스 `동의 대기→진단 대기` 자동 전이 | `confirmGuardianConsent` | 세션 필요 |

### 10.3 Google Sheets 접근 모듈 (`functions/_lib/`, 기존 `studentSheet.ts` 패턴 준용)

- `intakeSheet.ts` — `상담접수` 탭 CRUD(헤더 상수 배열 + `ensureHeaders` 자가치유 + `listIntakes`/`createIntake`/`approveIntake`).
- `caseSheet.ts` — `상담케이스` 탭 CRUD. `createCaseFromIntake` 시 `intakeSheet`/`studentSheet`/`consentSheet`를 함께 갱신하는 오케스트레이션 필요(legacy `createCaseFromIntakeRow_`가 3개 시트를 한 함수에서 순차 기록하는 것과 동일 책임 범위).
- `consentSheet.ts` — `보호자동의` 탭 CRUD + 토큰/짧은코드 생성.
- `publicPortalAccess.ts`(신규 개념) — `schoolPublicId`로 설치를 조회해 **세션 없이** Sheets 쓰기 권한(access token)을 얻는 모듈. 10.4절 참고.

### 10.4 ⚠️ 아키텍처 상 확인 필요 — 공개(비로그인) 제출이 쓰기 권한을 얻는 경로가 현재 없음

- 현재 `functions/_lib/requireInstalledAccess.ts:28-54`는 **로그인 세션(`requireSession`)이 있어야만** access token을 얻음(`ensureDriveAccessToken(env, session)`).
- `functions/_lib/installationStore.ts:49-66`(`InstallationStore` 인터페이스)에는 **`schoolPublicId`로 설치를 조회하는 메서드가 없음**(`get(userId)`만 존재). 공개 상담신청(`/intake/:schoolPublicId`)은 로그인하지 않은 학생/보호자가 접속하므로, 서버는 URL의 `schoolPublicId`만으로 "이 학교 스프레드시트가 무엇이고 쓸 수 있는 access token을 어떻게 얻을지"를 알아내야 하는데, **이 경로 자체가 현재 코드베이스에 없습니다.**
- `migrations/0001_create_auth_tables.sql:18-27`의 `oauth_tokens` 테이블은 `user_id`로 refresh token을 저장하므로(`refresh_token_ciphertext`), 이론적으로는 `schoolPublicId → installations.user_id → oauth_tokens.refresh_token`을 거쳐 세션 없이도 access token을 재발급받는 것이 **가능은 함**.
- 다만 이는 **새로 만들어야 하는 코드**이며(`InstallationStore.getBySchoolPublicId()` 추가, 세션 비의존 access-token 발급 함수 추가), "공개 URL 하나로 학교 스프레드시트에 쓰기 권한을 얻는" 경로이므로 rate limit·재검증 방식을 별도 설계해야 합니다. **이번 분석에서는 이 문제의 존재만 확인했고, 해결 방식은 결정하지 않았습니다** — 사용자 확인 필요.

### 10.5 명시적으로 결정을 미룬 부분 (임의로 정하지 않음)

- 학생 매칭 기준(이름+학년+반+번호 완전일치 vs 유사도 매칭) — `counseling-workflow-v1.md` 7절 미결정1과 동일. legacy 방식(`findStudent_`)을 그대로 옮기면 `docs/student-info-verification.md` 3절에서 지적된 오탐 위험을 그대로 물려받는다는 점만 재확인.
- 토큰 만료 정책 — legacy에 만료 로직이 없음(`code.gs.txt` 전체에 만료 체크 코드 없음 재확인). v1에서 만료를 추가할지는 미결정.
- `?k=` 짧은코드 라우팅 — legacy 자체가 깨져 있는 상태(8.2절)이므로, v1에서 짧은코드 개념을 유지할지 폐기하고 토큰 전용으로 갈지는 결정 필요.

---

## 11. 기존 동작과 새 구현을 비교할 테스트 체크리스트

### 11.1 공개 상담신청 제출

- [ ] `website`(허니팟) 필드에 값이 있으면 제출이 거부되어야 한다.
- [ ] `applicantType, applicantName, relation, schoolYear, grade, classNo, studentName, topic, requestText, contact, privacyConsent` 중 하나라도 비어 있으면(공백만 있어도) 거부되어야 한다.
- [ ] `studentNo`(번호)는 비워도 제출이 성공해야 한다.
- [ ] `privacyConsent`가 `'동의'`가 아니면 거부되어야 한다.
- [ ] 제출 성공 시 `접수ID`가 `REQ-{학년도}-{4자리}` 형식으로 채번되고, 같은 학년도 내에서 기존 최댓값+1이어야 한다.
- [ ] 제출 직후 저장된 행의 `처리상태`는 `'신규 접수'`, `학생코드`는 빈 값이어야 한다.
- [ ] `applicantType` 값이 무엇이든 서버 저장/검증 로직이 달라지지 않아야 한다(분기 없음이 정상 동작).
- [ ] 동시에 여러 건이 제출돼도 `접수ID`가 중복되지 않아야 한다.

### 11.2 교사의 접수 승인

- [ ] 접수 목록에는 `처리상태='신규 접수'`인 행만 나타나야 한다.
- [ ] 접수 목록은 최신 제출이 위에 오도록 정렬돼야 한다.
- [ ] 승인 시 학년도+학년+반+이름(+번호, 있는 경우)이 기존 재학생과 완전히 일치하면 **새 학생을 만들지 않고 기존 학생코드를 그대로 사용**해야 한다.
- [ ] 일치하는 학생이 없으면 신규 학생이 `재학상태='재학'`으로 생성되고, 새 학생코드가 상담접수/상담케이스 양쪽에 반영돼야 한다.
- [ ] 승인 시 상담케이스가 `현재단계='동의 대기'`로 생성돼야 한다.
- [ ] 승인 시 보호자동의 레코드가 `확인상태='미발송'`, `동의토큰=''`, `동의링크=''`로 **자동 생성**되어야 한다 — 이 시점에는 토큰이 아직 없어야 한다.
- [ ] 같은 접수ID로 승인을 두 번 요청해도 케이스가 중복 생성되지 않고, 두 번째 호출은 안내 메시지만 반환해야 한다.
- [ ] 승인 후 원본 상담접수 행의 `처리상태`가 `'케이스 생성'`으로 바뀌고 `학생코드`가 채워져야 한다.
- [ ] **거절/반려/보류 액션은 legacy에 없으므로, 새 구현에서 이 액션을 넣는다면 legacy와의 "동일 동작" 비교 대상이 아니라 v1 신규 기능임을 별도로 표시해야 한다.**

### 11.3 보호자동의 링크 생성·발송

- [ ] "동의 링크 생성"은 기존 토큰/짧은코드가 있으면 재사용하고, 없을 때만 새로 발급해야 한다.
- [ ] 짧은코드는 10자, 혼동 문자(`I,O,0,1`) 제외 알파벳만 사용해야 한다.
- [ ] "발송 처리"는 링크가 생성되지 않은 상태에서는 호출할 수 없어야 한다.
- [ ] 이미 보호자가 제출한 뒤 "발송 처리"를 눌러도 상태가 잘못 되돌아가지 않아야 한다.

### 11.4 보호자 제출

- [ ] 유효하지 않거나 이미 제출된 토큰으로는 동의 페이지 데이터를 조회할 수 없어야 한다.
- [ ] 동의 페이지에 표시되는 학생 이름은 마스킹되어야 한다(예: `홍○동`).
- [ ] `보호자 이름`과 `전자서명 이름`이 공백/대소문자 차이를 무시하고도 다르면 제출이 거부돼야 한다.
- [ ] `decision='동의'`일 때 5개 필수 확인항목 중 하나라도 빠지면 거부돼야 한다.
- [ ] `decision='비동의'`일 때는 5개 필수항목 체크 없이도 제출이 성공해야 한다.
- [ ] 이미 제출된 동의서로는 재제출이 거부돼야 한다.
- [ ] `동의` 제출 시 PDF 생성이 실패해도 동의 데이터 자체는 저장되고, 사용자에게는 경고만 표시돼야 한다.

### 11.5 교사 최종 확인

- [ ] 4개 필수 동의항목이 모두 `'동의'`가 아니면 확인 처리가 거부돼야 한다.
- [ ] 보호자 제출 흔적이 전혀 없으면 확인 처리가 거부돼야 한다.
- [ ] 확인 완료 시 상담케이스가 `'동의 대기' → '진단 대기'`로 **자동 전이**해야 한다(케이스 상태가 이미 `동의 대기`가 아니면 전이하지 않아야 함).
- [ ] `비동의`로 확인된 건에 대해 확인 처리를 시도하면 명확한 에러가 나야 한다.
- [ ] 이미 `동의 완료`인 건에 다시 확인 처리를 호출해도 안전하게 멱등 응답을 반환해야 한다.

---

## 12. 참고 — 이번 조사에서 다루지 않은 것

- 맛마을 탐험소 동기화(`syncTasteMindCaseSafe_` 등)는 이번 조사 범위 밖(6/7/8절에서 부수효과로만 언급).
- `saveConsent`, `regenerateConsentShortLink`를 실제로 호출하는 UI 경로를 찾지 못함(9절 표에 명시) — 수동/관리자용 백도어 함수로 추정되나 **확인 필요**.
- 물리 시트의 실제 열 순서·추가 열 존재 여부는 `legacy/sheet-structure/`가 비어 있어 코드 역산 이상으로 확정 불가.
- `appendText_` 함수의 정확한 구현(비고 필드에 텍스트를 어떻게 이어붙이는지)은 찾지 못함 — **확인 필요**.
