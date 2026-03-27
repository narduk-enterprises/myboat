import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/server/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['server/**/*.ts'],
      exclude: ['server/database/schema.ts'],
    },
  },
})
