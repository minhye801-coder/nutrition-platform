-- 학생식별정보(이름 포함)와 상담데이터(StudentID만)를 별도의 Google Spreadsheet 파일로
-- 분리한다(요구사항 5절 "탭만 분리하지 말고 별도의 Spreadsheet 파일로 분리"). 기존
-- installations.spreadsheet_id는 그대로 "상담데이터" Spreadsheet를 가리키는 값으로
-- 유지하고(이름 변경 없음 — 기존 참조 코드가 계속 동작), 새로 추가하는
-- identity_spreadsheet_id가 "학생식별정보" Spreadsheet를 가리킨다.
--
-- 이 컬럼이 비어 있는(NULL) 기존 설치는 학생정보/상담접수가 아직 예전 단일 Spreadsheet
-- 안에 있다는 뜻이다 — functions/_lib/requireInstalledAccess.ts가 이 경우
-- spreadsheet_id를 identitySpreadsheetId로도 함께 내려줘 하위호환을 유지하고,
-- 관리자가 "설정 > 계정 및 개인정보 보호"의 마이그레이션 도구(Phase 8)로 분리를
-- 실행하면 이 컬럼이 채워진다.
ALTER TABLE installations ADD COLUMN identity_spreadsheet_id TEXT;
ALTER TABLE installation_progress ADD COLUMN identity_spreadsheet_id TEXT;
ALTER TABLE installation_progress ADD COLUMN identity_headers_written INTEGER NOT NULL DEFAULT 0;
