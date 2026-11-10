// wordRules1110 の単体の読み込みだけを流す設定（npm test には入らない）。
// node node_modules/vitest/vitest.mjs run --config scripts/e2e/wordRules1110/vitest.config.mts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: fileURLToPath(new URL('../../..', import.meta.url)),
  define: { __BUILD_ID__: JSON.stringify('dev') },
  test: { include: ['scripts/e2e/wordRules1110/**/*.unit.ts'], testTimeout: 600000, hookTimeout: 600000 },
})
