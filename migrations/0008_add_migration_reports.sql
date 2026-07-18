-- 기존(단일 Spreadsheet) 설치를 학생식별정보/상담데이터 두 Spreadsheet로 분리하는
-- 마이그레이션(요구사항 12절)의 실행 이력. 학생 이름 등 원문은 저장하지 않고 건수와
-- 결과 요약만 남긴다 — 이 테이블 자체가 학생 데이터를 담지 않는다는 원칙은 그대로
-- 유지한다(docs/security-principles.md).
CREATE TABLE IF NOT EXISTS migration_reports (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- completed | failed
  backup_spreadsheet_id TEXT,
  students_migrated INTEGER NOT NULL DEFAULT 0,
  intakes_migrated INTEGER NOT NULL DEFAULT 0,
  duplicate_candidates INTEGER NOT NULL DEFAULT 0,
  unresolved_references INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL
);
