import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// vitest.config.ts에는 test.globals가 꺼져 있어(암묵적 전역 금지 원칙 유지) testing-library의
// 자동 afterEach(cleanup) 등록이 동작하지 않는다 — 같은 파일 안의 여러 컴포넌트 테스트가
// DOM을 공유해 서로 오염시키지 않도록 여기서 명시적으로 매 테스트 뒤에 정리한다.
afterEach(() => {
  cleanup()
})
