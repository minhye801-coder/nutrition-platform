-- 계정 모드(SCHOOL_WORKSPACE/PERSONAL_DEMO/WORKSPACE_PENDING) 판정 결과를 저장한다.
-- 로그인마다 Google ID Token의 hosted domain(hd) 클레임을 서버에서 검증해 갱신하므로
-- (functions/_lib/googleIdToken.ts, functions/_lib/accountMode.ts), 클라이언트가 값을
-- 조작해도 서버 판정에는 영향을 줄 수 없다. 학생 데이터는 여전히 이 DB에 저장하지 않는다
-- (docs/security-principles.md) — 여기 추가하는 컬럼은 "이 Google 계정이 학교 업무용인지"
-- 라는 계정 속성일 뿐이다.
ALTER TABLE users ADD COLUMN hosted_domain TEXT;
ALTER TABLE users ADD COLUMN account_mode TEXT NOT NULL DEFAULT 'PERSONAL_DEMO';
ALTER TABLE users ADD COLUMN school_use_confirmed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN domain_approval_status TEXT NOT NULL DEFAULT 'not_applicable';

-- 승인된 학교/교육청 Workspace 도메인 목록. 이번 범위에는 관리자 UI가 없으므로
-- 운영자가 wrangler d1execute로 직접 행을 추가하거나(또는 APPROVED_SCHOOL_DOMAINS
-- 환경변수로 보완, functions/_lib/accountMode.ts 참고) 관리한다.
CREATE TABLE IF NOT EXISTS approved_school_domains (
  domain TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  approved_at INTEGER NOT NULL
);
