-- 마이그레이션 결과에 실제 검증 지표를 추가한다(요구사항 12절 "연결되지 않은 데이터
-- 검사"). 기존 unresolved_references 컬럼은 0009 이전까지 항상 0으로만 기록되던
-- 하드코딩 값이었다 — 이제 실제 계산값을 담는다. 학생 이름 등 원문은 여전히 담지
-- 않고 건수만 남긴다(docs/security-principles.md).
ALTER TABLE migration_reports ADD COLUMN total_students INTEGER NOT NULL DEFAULT 0;
ALTER TABLE migration_reports ADD COLUMN total_records INTEGER NOT NULL DEFAULT 0;
ALTER TABLE migration_reports ADD COLUMN linked_records INTEGER NOT NULL DEFAULT 0;
ALTER TABLE migration_reports ADD COLUMN duplicate_identifier_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE migration_reports ADD COLUMN samename_review_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE migration_reports ADD COLUMN conversion_failure_count INTEGER NOT NULL DEFAULT 0;
