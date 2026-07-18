-- 계정 정책 단순화(2026-07-18 결정)에 필요한 컬럼. school_use_confirmed는 기존
-- 컬럼을 그대로 재사용하고("workspaceConfirmed"와 동일한 의미), 안내문 버전 추적을
-- 위해 두 컬럼만 추가한다. 기존 데이터를 지우거나 바꾸는 명령은 없다.
--
-- 주의(운영 배포 전 필독): 이 마이그레이션은 이번 변경분과 함께 커밋되었지만
-- production D1에는 아직 적용하지 않았다 — 별도 확인 후 명시적으로 실행할 것
-- (0001~0009 적용 시 d1_migrations 추적 테이블과 실제 스키마가 어긋나 있던 사고가
-- 있었으므로, 적용 전 `wrangler d1 migrations list --remote`로 현재 상태를 먼저
-- 확인한다).
ALTER TABLE users ADD COLUMN confirmation_version TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN confirmed_at INTEGER;
