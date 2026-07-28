/**
 * PR #43 — Credit reconciliation integration tests (live Neon only).
 *
 * These tests require DATABASE_URL pointing to the canonical FinanceOS Core Neon database
 * AND Migration 006 to be applied first. They are skipped in CI and local runs
 * unless NEON_INTEGRATION_TESTS=true is explicitly set.
 *
 * DO NOT run these against Replit operational DB or Supabase.
 * DO NOT apply Migration 006 without explicit approval from Allison.
 *
 * @group integration
 */

import { describe, it, expect, beforeAll } from "vitest";

const INTEGRATION = process.env["NEON_INTEGRATION_TESTS"] === "true";
const maybeDescribe = INTEGRATION ? describe : describe.skip;

maybeDescribe("PR #43 — Neon credit reconciliation integration", () => {
  const TEST_ENTITY_ID = process.env["NEON_TEST_ENTITY_ID"] ?? "";

  beforeAll(() => {
    if (!process.env["DATABASE_URL"]) {
      throw new Error("DATABASE_URL is required for Neon integration tests");
    }
    if (!TEST_ENTITY_ID) {
      throw new Error("NEON_TEST_ENTITY_ID is required for Neon integration tests");
    }
  });

  /**
   * N33: getArApReconciliation includes creditMemoCoverage + vendorCreditCoverage arrays.
   *
   * After Migration 006 is applied, the function must return both arrays.
   * Arrays may be empty if sync_run_objects has no rows for this entity, but
   * they must never be undefined.
   */
  it("N33: getArApReconciliation returns creditMemoCoverage and vendorCreditCoverage arrays", async () => {
    const { getArApReconciliation } = await import("../db/snapshots.js");
    const result = await getArApReconciliation(TEST_ENTITY_ID);

    expect(Array.isArray(result.creditMemoCoverage)).toBe(true);
    expect(Array.isArray(result.vendorCreditCoverage)).toBe(true);

    // Each element must have the required fields
    for (const detail of result.creditMemoCoverage) {
      expect(detail).toHaveProperty("syncStatus");
      expect(detail).toHaveProperty("dataSourceUsed");
      expect(detail).toHaveProperty("verificationStatus");
      expect(detail).toHaveProperty("coverageComplete");
      expect(detail).toHaveProperty("currency");
    }
  });

  /**
   * N34: success_with_exceptions from sync_run_objects never produces verificationStatus="verified".
   */
  it("N34: success_with_exceptions rows never produce verificationStatus=verified", async () => {
    const { getArApReconciliation } = await import("../db/snapshots.js");
    const result = await getArApReconciliation(TEST_ENTITY_ID);

    const allDetails = [...result.creditMemoCoverage, ...result.vendorCreditCoverage];
    const withExceptions = allDetails.filter(d => d.syncStatus === "success_with_exceptions");

    for (const detail of withExceptions) {
      expect(detail.verificationStatus).not.toBe("verified");
      expect(detail.coverageComplete).toBe(false);
    }
  });
});
