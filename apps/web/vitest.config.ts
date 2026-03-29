import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '~': __dirname,
      '~~': __dirname,
      '#server': resolve(__dirname, 'server'),
      '#layer': resolve(__dirname, '../../layers/narduk-nuxt-layer'),
    },
  },
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
