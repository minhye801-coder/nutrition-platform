-- Milestone 1 최초 설치 실행(실제 Drive 폴더/Spreadsheet 생성)에 필요한 스키마 추가.
--
-- installations는 "설치가 완료된 계정"만 한 행을 갖는 기존 의미를 그대로 유지한다
-- (행 존재 여부 = 설치 완료 여부, functions/api/installation.ts GET이 그대로 사용).
-- 여기에 완료된 설치가 소유한 Drive 루트 폴더/Spreadsheet의 내부 ID만 추가로 보관한다.
-- 이 두 컬럼은 서버(functions/_lib) 밖으로 원본 ID 그대로 노출하지 않는다 —
-- 클라이언트에는 항상 완성된 Google URL 형태로만 내려준다(security-principles.md 4절).
ALTER TABLE installations ADD COLUMN root_folder_id TEXT;
ALTER TABLE installations ADD COLUMN spreadsheet_id TEXT;

-- 설치가 완료되기 전(Drive/Sheets 생성 도중)의 단계별 진행 상태를 담는 별도 테이블.
-- installations와 분리한 이유: installations는 "완료된 설치 = 행 1개" 불변식을 그대로
-- 유지해야 기존 GET /api/installation·useInstallation 로직이 영향을 받지 않는다.
-- 이 테이블은 설치가 진행/재시도되는 동안에만 의미가 있고, 완료 후에는 마지막 실행
-- 기록으로 남아있어도 무해하다(설치 완료 판정은 installations 테이블 행 존재로만 한다).
CREATE TABLE IF NOT EXISTS installation_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  school_public_id TEXT NOT NULL,
  root_folder_id TEXT,
  folder_ids_json TEXT NOT NULL DEFAULT '{}',
  spreadsheet_id TEXT,
  headers_written INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | completed | failed
  current_step TEXT,
  error_step TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
