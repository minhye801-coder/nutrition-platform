-- 최초 설치 화면에서 입력하는 학교명/담당자명과 발급된 schoolPublicId를
-- installations에 추가한다.
--
-- Google OAuth 프로필 이름(users.name)은 인증용 기본정보로만 유지한다.
-- 화면에 표시할 담당자명은 이 manager_name 컬럼을 우선 사용하고, 값이 비어 있을
-- 때만 users.name(Google 프로필 이름)을 fallback으로 사용한다
-- (functions/api/installation.ts, src 쪽 useInstallation/managerName 처리 참고).
ALTER TABLE installations ADD COLUMN school_name TEXT NOT NULL DEFAULT '';
ALTER TABLE installations ADD COLUMN manager_name TEXT NOT NULL DEFAULT '';
ALTER TABLE installations ADD COLUMN school_public_id TEXT NOT NULL DEFAULT '';

-- schoolPublicId로 설치를 조회하는 공개 라우트(예: /explore/:publicId, /intake/:publicId,
-- platform-v1-architecture.md 참고)를 대비한 조회용 인덱스. 유니크 제약은 걸지 않았으므로
-- 애플리케이션(functions/api/installation.ts)에서 충분한 엔트로피로 값을 생성한다.
CREATE INDEX IF NOT EXISTS idx_installations_school_public_id ON installations(school_public_id);
