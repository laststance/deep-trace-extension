import { defineConfig } from 'vitest/config'

/**
 * Limits Vitest to the source tests so compiled output is never re-run,
 * and writes the coverage reports consumed by Codecov and Fallow.
 */
export default defineConfig({
  test: {
    include: ['src/test/**/*.test.ts'],
    exclude: ['out/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/test/**'],
      reporter: ['json', 'lcov', 'text-summary'],
    },
  },
})
