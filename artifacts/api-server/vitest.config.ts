import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only. Integration tests (.integration.test.ts) require live DB
    // connections and are excluded from this suite.
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
    environment: "node",
    globals: false,
    // Sets stub env vars before modules load so packages that throw on missing
    // required env vars (e.g. @workspace/db checking CORE_DATABASE_URL) can be
    // imported and then mocked by individual test files. No real DB connections
    // are made — any attempt to query these non-existent hosts will fail, which
    // is correct for unit tests (they must use vitest mocks).
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
