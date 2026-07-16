-- 교사 본인의 Gemini API Key를 저장한다(Milestone 4 — 검사 결과 PDF 자동추출에 사용).
-- oauth_tokens와 동일한 원칙으로 평문 저장하지 않는다: SESSION_SECRET에서 유도한 키로
-- AES-GCM 암호화한 ciphertext/iv만 저장한다(functions/_lib/tokenCipher.ts).
-- installations에 두는 이유: 이 키도 "사용자 1명당 1개"로 installations의 기존
-- 1:1 관계(userId 기준)와 정확히 같다 — 별도 테이블을 만들 이유가 없다.
ALTER TABLE installations ADD COLUMN gemini_api_key_ciphertext TEXT;
ALTER TABLE installations ADD COLUMN gemini_api_key_iv TEXT;
