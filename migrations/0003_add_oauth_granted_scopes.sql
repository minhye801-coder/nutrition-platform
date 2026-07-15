-- 설치 흐름(Drive/Sheets 점진 동의)에서 현재 세션이 어떤 OAuth 스코프를 실제로
-- 부여받았는지 판단하기 위해 토큰 교환 시 Google이 내려주는 scope 문자열을 그대로
-- 저장한다. 값이 있으면 매 설치 요청마다 Google에 별도로 물어보지 않고도
-- drive.file 스코프 보유 여부를 판정할 수 있다 (functions/_lib/googleOAuth.ts의
-- hasDriveScope 참고). 토큰 자체가 아니므로 암호화하지 않는다.
ALTER TABLE oauth_tokens ADD COLUMN granted_scopes TEXT NOT NULL DEFAULT '';
