-- 인증/세션 전용 최소 스키마.
-- 학생 데이터(설문/상담 기록 등)는 이 데이터베이스(AUTH_DB)에 저장하지 않는다 —
-- 그 데이터는 각 학교 담당자 본인의 Google Sheets/Drive에만 저장되는 것이 이
-- 플랫폼의 원칙이다 (docs/security-principles.md). 여기 저장되는 것은 로그인
-- 세션 유지에 필요한 최소한의 사용자/토큰 메타데이터뿐이다.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,          -- Google 계정의 OpenID 'sub' 값을 그대로 사용
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  picture TEXT,
  created_at INTEGER NOT NULL,  -- epoch ms
  updated_at INTEGER NOT NULL
);

-- access/refresh token은 평문으로 저장하지 않는다. SESSION_SECRET에서 유도한 키로
-- AES-GCM 암호화한 ciphertext/iv만 저장한다 (functions/_lib/tokenCipher.ts 참고).
CREATE TABLE IF NOT EXISTS oauth_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token_ciphertext TEXT NOT NULL,
  access_token_iv TEXT NOT NULL,
  refresh_token_ciphertext TEXT,
  refresh_token_iv TEXT,
  access_token_expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- session_id_hash는 쿠키에 담기는 원본 세션 ID의 SHA-256 해시다. 원본 세션 ID
-- 자체는 저장하지 않으므로, 이 테이블이 유출되어도 세션을 재사용할 수 없다.
CREATE TABLE IF NOT EXISTS sessions (
  session_id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- 로그인한 Google 계정이 학교 작업공간 설치를 마쳤는지 여부만 기록한다.
-- 설치 관련 실제 리소스(스프레드시트 ID 등)는 후속 마일스톤에서 별도 테이블로 추가한다.
CREATE TABLE IF NOT EXISTS installations (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  installed_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
