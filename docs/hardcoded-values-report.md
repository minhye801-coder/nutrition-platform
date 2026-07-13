# 하드코딩 값 보고서 (hardcoded-values-report)

> `legacy/` 3개 프로젝트 전수 조사 결과입니다. 실제 값은 앞 4자리+뒤 4자리만 남기고 마스킹했습니다. "민감도"는 유출 시 실질적 피해 가능성 기준(높음/중간/낮음)입니다.

## 1. Spreadsheet ID / Web App URL

| 값 종류 | 파일:라인 | 마스킹된 값 | 민감도 | 범용화 시 분리 방법 |
|---|---|---|---|---|
| 메인(counseling-manager) Spreadsheet ID | `counseling-manager/Index.html:488` (클라이언트 정적 링크) | `19MY****YMbI` | **높음** — 페이지 소스만 보면 누구나 확인 가능 | 클라이언트에서 완전히 제거, 서버측 환경변수/tenant 설정으로 이동 |
| 메인 Spreadsheet ID(동일 값, 별도 프로젝트) | `intake-consent/code.gs.txt:7` (`DATA_SPREADSHEET_ID`) | `19MY****YMbI` | **높음** — 서버 코드지만 프로젝트 복제 시 함께 유출/오적용 위험 | tenant 설정 API 또는 환경변수로 주입 |
| taste-village Spreadsheet ID | `counseling-manager/code.gs.txt:30` (`TASTE_MIND_DEFAULTS.SPREADSHEET_ID`) | `1Zpj****ITus` | **높음** | Script Properties/tenant 설정 기본값으로만 사용, 하드코딩 폴백 제거 |
| taste-village Spreadsheet ID(중복) | `counseling-manager/Index.html:500` (클라이언트 정적 링크) | `1Zpj****ITus` | **높음** | 클라이언트에서 제거 |
| taste-village Spreadsheet ID(자체 검증용) | `taste-village/code.gs:14` (`EXPECTED_SPREADSHEET_ID`) | `1Zpj****ITus` | 중간 — 설치 스크립트 검증 목적이라 완전 제거는 어려움 | tenant 설치 시 동적 발급으로 전환 |
| taste-village Web App URL | `counseling-manager/code.gs.txt:31` (`TASTE_MIND_DEFAULTS.WEB_APP_URL`) | `https://script.google.com/macros/s/AKfy****gC99/exec` | 중간 | 설정 시트/환경변수 기본값 폴백 제거 |
| taste-village Web App URL(중복) | `counseling-manager/Index.html:470` (클라이언트 정적 링크) | `https://script.google.com/macros/s/AKfy****gC99/exec` | 중간 | 클라이언트에서 제거 |

## 2. 학교/기관 식별값

| 값 종류 | 파일:라인 | 값 | 민감도 | 범용화 시 분리 방법 |
|---|---|---|---|---|
| 학교명 | `taste-village/code.gs:118`, `MealApi.gs:9`, `WebApp.gs:19` | "구미봉곡초등학교"(3곳 반복) | 낮음(공개 정보) — 단, 여러 학교 복제 배포 시 잔존 위험 | tenant 설정(`설정` 시트 또는 DB)의 `SCHOOL_NAME` 단일 값만 사용, 코드 상수 제거 |
| NEIS 교육청 코드 | `taste-village/MealApi.gs:10` (`OFFICE_CODE`) | `R10` | 낮음 | tenant 설정값으로 이동 |
| NEIS 학교 코드 | `taste-village/MealApi.gs:11` (`SCHOOL_CODE`) | `8801088` | 낮음~중간(학교 특정 가능) | tenant 설정값으로 이동 |

## 3. API Key / 모델명

| 값 종류 | 파일:라인 | 상태 | 민감도 | 비고 |
|---|---|---|---|---|
| Gemini API Key | `counseling-manager/code.gs.txt:1844-1861` | **코드에 값 없음** — `PropertiesService.getScriptProperties()`에만 저장 | 해당 없음(양호) | 현재 관행 유지, Cloudflare 이전 시 서버측 시크릿 저장소로 동일하게 관리 |
| Gemini 기본 모델명 | `counseling-manager/code.gs.txt:4022, 4746, 5116` | `gemini-3.1-flash-lite`(3곳 중복 하드코딩, 설정 시트로 오버라이드 가능) | 낮음(값 자체는 비밀 아님) | 설정값 단일화, 코드 중복 제거 |
| NEIS API 인증키 | `taste-village/MealApi.gs:12` | **코드에 값 없음** — `PropertiesService`에 저장(`registerNeisApiKey`, `21-50`) | 해당 없음(양호) | 유지. 단, `fetchMealRowsForDate_`(`293-391`)가 키를 URL 쿼리 파라미터로 전송(`328`)하는 점은 일반적인 GET 인증 패턴의 공통 위험 |
| 매니저 스프레드시트 ID(taste-village 측) | `taste-village/code.gs:16` | **코드에 값 없음** — `PropertiesService`(`MANAGER_SPREADSHEET_ID`), 교사가 UI 프롬프트로 입력 | 해당 없음(양호) | 유지 |

## 4. 시트명 / 폴더명

| 값 종류 | 위치 | 값 | 민감도 | 비고 |
|---|---|---|---|---|
| 메인 시스템 시트명(17개) | `counseling-manager/code.gs.txt:1-18` 등 | 학생정보, 상담접수, 상담케이스, 보호자동의, 진단결과, 상담회기, 실천목표, 목표점검, 생성문서, 효과평가, 성장측정, 다음회기준비, 일정관리, 일정완료, 설정, 변경이력 | 낮음 | 국문 고정 상수 — 다국어/이름변경 요구 시 전체 재작성 필요하나 보안 위험은 아님 |
| taste-village 시트명(8개) | `taste-village/code.gs:17-26` | 설정, 학생계정, 회기활동, 급식성찰, 실천미션, 미션점검, 스티커북, 매니저연계 | 낮음 | 동일 |
| intake-consent 시트명(5개) | `intake-consent/code.gs.txt:9-14` | 설정, 학생정보, 상담접수, 상담케이스, 보호자동의 | 낮음 | 동일 |
| Drive 서브폴더명(6개) | `counseling-manager/code.gs.txt:5815-5829` | 01_접수, 02_보호자동의, 03_공식진단, 04_상담기록, 05_실천자료, 06_상담결과 | 낮음 | 동일 |
| Drive 서브폴더명(intake-consent 측) | `intake-consent/code.gs.txt:188` | 02_보호자동의(counseling-manager와 동일 문자열 재사용) | 낮음 | 두 프로젝트가 폴더명 문자열을 각자 하드코딩 — 상수 공유 필요 |

## 5. 학생 식별 방식 (하드코딩된 "규칙")

| 프로젝트 | 위치 | 매칭 기준 | 민감도 |
|---|---|---|---|
| counseling-manager | `code.gs.txt:5842-5851` (`findStudent_`) | 학년도+학년+반+이름(공백제거+소문자 정규화)+선택적 번호 | 중간 — 개인정보(이름) 기반 매칭이 데이터 무결성에 직결 |
| taste-village | `code.gs:565-598` (`verifyStudentExplorerLogin`) | 학년+반+이름(정규화)+4자리 탐험코드 | 중간 |

두 프로젝트 모두 studentId 단독으로는 매칭하지 않고 이름을 필수로 사용합니다 — `security-principles.md`의 "학생 개인정보 최소 저장" 원칙과 충돌 소지가 있어 범용화 시 재설계가 필요합니다(`migration-risks.md` 참고).

## 6. 공개 토큰/코드

| 값 종류 | 위치 | 형식 | 민감도 | 비고 |
|---|---|---|---|---|
| 보호자동의 토큰 | `counseling-manager/code.gs.txt:3489-3500` 생성, `intake-consent/code.gs.txt:308-312` 검증 | UUID(하이픈 제거), 영숫자 20자 이상 검증만 | **높음** | 만료 시각 없음(`integration-flow.md` 2절 참고) |
| 보호자동의 짧은코드 | `counseling-manager/code.gs.txt:3548-3577` | 혼동문자 제외 알파벳 10자리 랜덤 | 중간 | intake-consent `doGet`에 `?k=` 처리 코드 미확인(불일치 의심, `integration-flow.md` 참고) |
| taste-village 탐험코드 | `taste-village/code.gs:1052-1057` (`generateUniqueExplorerCode_`) | 4자리 숫자(1000~9999) 랜덤 | **높음** — 무차별 대입 방어(rate limit) 없음 | 로그인 시도 횟수 제한 필요 |

## 7. 기타 정적 값 (민감정보 아님, 참고용)

| 값 | 위치 | 비고 |
|---|---|---|
| 국민건강영양조사 계산기 링크 | `counseling-manager/Index.html:410, 446` | 공개 정부 서비스 URL |
| Gemini API 엔드포인트 | `counseling-manager/code.gs.txt:4098, 4837, 5199` | 공개 API 엔드포인트 |

## 8. 요약 — 즉시 조치가 필요한 상위 3개

1. **counseling-manager/Index.html에 하드코딩된 자기 자신 및 taste-village의 Spreadsheet ID/Web App URL** — 클라이언트 HTML은 로그인 여부와 무관하게 소스가 노출되므로 최우선 제거 대상.
2. **보호자동의 토큰의 만료 시각 부재** — 개인정보(학생 마스킹 정보) 노출 경로가 되므로 마이그레이션 설계 시 최우선 반영.
3. **taste-village 4자리 탐험코드에 대한 무차별 대입 방어 부재** — 학생 계정 탈취로 직결.
