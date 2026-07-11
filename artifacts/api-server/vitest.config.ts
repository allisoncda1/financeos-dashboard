import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run unit tests (no DB) automatically; integration tests require DATABASE_URL
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
    environment: "node",
    globals: false,
  },
});
