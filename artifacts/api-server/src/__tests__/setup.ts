/**
 * Vitest global setup — runs before every test file.
 *
 * Purpose: prevent module-initialization throws for packages that validate
 * required env vars at import time. In unit tests, all real DB calls are
 * mocked by individual test files; the only reason these vars are needed is
 * to satisfy the throw guard in @workspace/db/src/index.ts so that vitest can
 * collect and mount the module graph before mocks are applied.
 *
 * These are NOT real database connections. Any attempt to actually query them
 * will fail (no real Postgres is running), which is correct — unit tests must
 * use vitest mocks, not live databases.
 */

// Prevent @workspace/db from throwing during module initialization.
// Tests that need real DB connections must be .integration.test.ts files
// (excluded from the unit suite via vitest.config.ts exclude pattern).
if (!process.env["CORE_DATABASE_URL"]) {
  process.env["CORE_DATABASE_URL"] = "postgresql://test:test@localhost:5432/core_test_nonexistent";
}
if (!process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/ops_test_nonexistent";
}
if (!process.env["SESSION_SECRET"]) {
  process.env["SESSION_SECRET"] = "test-session-secret-not-for-production-use";
}
if (!process.env["PORT"]) {
  process.env["PORT"] = "5001";
}
// Prevent plaidClient.ts from throwing during module initialization in unit tests.
// Individual test files mock plaidClient.js — these stub values satisfy the
// fail-closed guard so vitest can collect the module graph before mocks apply.
// No real Plaid calls are made in unit tests.
if (!process.env["PLAID_ENV"]) {
  process.env["PLAID_ENV"] = "production";
}
if (!process.env["PLAID_CLIENT_ID"]) {
  process.env["PLAID_CLIENT_ID"] = "test_client_id_stub_not_real";
}
if (!process.env["PLAID_SECRET"]) {
  process.env["PLAID_SECRET"] = "test_secret_stub_not_real";
}
