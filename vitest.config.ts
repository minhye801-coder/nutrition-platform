import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    // 서버(functions/_lib, functions/api) 테스트는 node 환경 기본값을 쓰고, 컴포넌트
    // 테스트(.test.tsx)만 각 파일 맨 위의 `// @vitest-environment jsdom` 주석으로
    // jsdom을 켠다(Vitest 4에는 environmentMatchGlobs가 없다).
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setupTests.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
