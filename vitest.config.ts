import { defineConfig } from "vitest/config";

/**
 * Limits Vitest to the source tests so compiled output is never re-run.
 */
export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts"],
    exclude: ["out/**", "node_modules/**"]
  }
});
