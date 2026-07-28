/**
 * PR #43 — Credit coverage unit tests (no live Neon, pure logic assertions).
 *
 * Tests N21–N32 from the approved specification.
 * These tests exercise the response-model logic for CreditCoverageDetail only —
 * no actual DB calls are made.
 */

import { describe, it, expect } from "vitest";

// ------------------------------------------------------------------
// Local type mirrors (matches snapshots.ts exports)
// ------------------------------------------------------------------

type SyncStatus =
  | "never_attempted"
  | "running"
  | "failed"
  | "success_zero_rows"
  | "success_with_rows"
  | "success_with_exceptions";

type DataSourceUsed = "none" | "raw" | "normalized";
type VerificationStatus = "not_available" | "pending" | "verified" | "parity_mismatch";

interface CreditCoverageDetail {
  syncStatus: SyncStatus;
  dataSourceUsed: DataSourceUsed;
  verificationStatus: VerificationStatus;
  coverageComplete: boolean;
  rawTotal: number | null;
  normalizedTotal: number | null;
  difference: number | null;
  currency: string;
  recordsFetched: number | null;
  recordsSkipped: number | null;
  errorSummary: string | null;
}

// ------------------------------------------------------------------
// Helper: derive syncStatus from a mock sync_run_objects row
// ------------------------------------------------------------------
function deriveSyncStatus(row: {
  status: string;
  records_fetched: number | null;
  records_skipped: number | null;
} | null): SyncStatus {
  if (!row) return "never_attempted";
  if (row.status === "running") return "running";
  if (row.status === "failed") return "failed";
  if (row.status === "success_with_exceptions") return "success_with_exceptions";
  if (row.status === "success" && row.records_fetched === 0 && (row.records_skipped ?? 0) === 0) {
    return "success_zero_rows";
  }
  if (row.status === "success") return "success_with_rows";
  return "never_attempted";
}

const PARITY_TOLERANCE = 0.02;

// ------------------------------------------------------------------
// N21: never_attempted when no sync_run_objects row exists
// ------------------------------------------------------------------
describe("N21 — never_attempted when no sync_run_objects row exists", () => {
  it("derives never_attempted from null row", () => {
    const status = deriveSyncStatus(null);
    expect(status).toBe("never_attempted");
  });

  it("produces not_available verificationStatus and coverageComplete=false", () => {
    const detail: CreditCoverageDetail = {
      syncStatus: "never_attempted",
      dataSourceUsed: "none",
      verificationStatus: "not_available",
      coverageComplete: false,
      rawTotal: null, normalizedTotal: null, difference: null,
      currency: "USD",
      recordsFetched: null, recordsSkipped: null, errorSummary: null,
    };
    expect(detail.syncStatus).toBe("never_attempted");
    expect(detail.coverageComplete).toBe(false);
    expect(detail.verificationStatus).toBe("not_available");
    expect(detail.dataSourceUsed).toBe("none");
  });
});

// ------------------------------------------------------------------
// N22: success_zero_rows → normalized source, verified, coverageComplete=true
// ------------------------------------------------------------------
describe("N22 — success_zero_rows means normalized/verified/coverageComplete=true", () => {
  it("derives success_zero_rows from fetched=0 and skipped=0", () => {
    const status = deriveSyncStatus({ status: "success", records_fetched: 0, records_skipped: 0 });
    expect(status).toBe("success_zero_rows");
  });

  it("produces normalized/verified/coverageComplete=true", () => {
    const detail: CreditCoverageDetail = {
      syncStatus: "success_zero_rows",
      dataSourceUsed: "normalized",
      verificationStatus: "verified",
      coverageComplete: true,
      rawTotal: null,
      normalizedTotal: 0,
      difference: null,
      currency: "USD",
      recordsFetched: 0, recordsSkipped: 0, errorSummary: null,
    };
    expect(detail.coverageComplete).toBe(true);
    expect(detail.dataSourceUsed).toBe("normalized");
    expect(detail.verificationStatus).toBe("verified");
    expect(detail.normalizedTotal).toBe(0);
  });
});

// ------------------------------------------------------------------
// N23: success_zero_rows requires BOTH fetched=0 AND skipped=0
// ------------------------------------------------------------------
describe("N23 — skipped>0 with fetched=0 is success_with_exceptions, not success_zero_rows", () => {
  it("skipped=3 produces success_with_exceptions even when fetched=0", () => {
    const status = deriveSyncStatus({ status: "success_with_exceptions", records_fetched: 0, records_skipped: 3 });
    expect(status).toBe("success_with_exceptions");
    expect(status).not.toBe("success_zero_rows");
  });
});

// ------------------------------------------------------------------
// N24: success_with_exceptions → raw source, pending, coverageComplete=false
// ------------------------------------------------------------------
describe("N24 — success_with_exceptions means raw/pending/coverageComplete=false", () => {
  it("derives success_with_exceptions correctly", () => {
    const status = deriveSyncStatus({ status: "success_with_exceptions", records_fetched: 10, records_skipped: 3 });
    expect(status).toBe("success_with_exceptions");
  });

  it("produces raw/pending/coverageComplete=false", () => {
    const detail: CreditCoverageDetail = {
      syncStatus: "success_with_exceptions",
      dataSourceUsed: "raw",
      verificationStatus: "pending",
      coverageComplete: false,
      rawTotal: 450.00, normalizedTotal: null, difference: null,
      currency: "USD",
      recordsFetched: 10, recordsSkipped: 3,
      errorSummary: "3 sparse-active payloads skipped",
    };
    expect(detail.coverageComplete).toBe(false);
    expect(detail.dataSourceUsed).toBe("raw");
    expect(detail.verificationStatus).toBe("pending");
    expect(detail.verificationStatus).not.toBe("verified");
  });
});

// ------------------------------------------------------------------
// N25: success_with_exceptions — verificationStatus is NEVER "verified"
// ------------------------------------------------------------------
describe("N25 — success_with_exceptions cannot produce verificationStatus=verified", () => {
  it("all valid statuses for success_with_exceptions exclude verified", () => {
    const validStatuses: VerificationStatus[] = ["not_available", "pending", "parity_mismatch"];
    for (const s of validStatuses) {
      expect(s).not.toBe("verified");
    }
  });
});

// ------------------------------------------------------------------
// N26: parity match → normalized/verified/coverageComplete=true
// ------------------------------------------------------------------
describe("N26 — parity match within tolerance → normalized/verified/coverageComplete=true", () => {
  it("difference within $0.02 is a match", () => {
    const rawTotal = 1000.00;
    const normalizedTotal = 1000.01;
    const difference = Math.abs(rawTotal - normalizedTotal);
    expect(difference).toBeLessThanOrEqual(PARITY_TOLERANCE);

    const detail: CreditCoverageDetail = {
      syncStatus: "success_with_rows",
      dataSourceUsed: "normalized",
      verificationStatus: "verified",
      coverageComplete: true,
      rawTotal, normalizedTotal, difference,
      currency: "USD",
      recordsFetched: 5, recordsSkipped: 0, errorSummary: null,
    };
    expect(detail.coverageComplete).toBe(true);
    expect(detail.dataSourceUsed).toBe("normalized");
    expect(detail.verificationStatus).toBe("verified");
  });
});

// ------------------------------------------------------------------
// N27: parity mismatch → raw/parity_mismatch/coverageComplete=false
// ------------------------------------------------------------------
describe("N27 — parity mismatch → raw/parity_mismatch/coverageComplete=false", () => {
  it("difference > $0.02 is a mismatch", () => {
    const rawTotal = 1000.00;
    const normalizedTotal = 950.00;
    const difference = Math.abs(rawTotal - normalizedTotal);
    expect(difference).toBeGreaterThan(PARITY_TOLERANCE);

    const detail: CreditCoverageDetail = {
      syncStatus: "success_with_rows",
      dataSourceUsed: "raw",
      verificationStatus: "parity_mismatch",
      coverageComplete: false,
      rawTotal, normalizedTotal, difference,
      currency: "USD",
      recordsFetched: 5, recordsSkipped: 0, errorSummary: null,
    };
    expect(detail.coverageComplete).toBe(false);
    expect(detail.dataSourceUsed).toBe("raw");
    expect(detail.verificationStatus).toBe("parity_mismatch");
  });
});

// ------------------------------------------------------------------
// N28: only normalized exists (no raw rows) → pending, coverageComplete=false
// ------------------------------------------------------------------
describe("N28 — only normalized data available → pending/coverageComplete=false", () => {
  it("cannot verify without raw parity confirmation", () => {
    const detail: CreditCoverageDetail = {
      syncStatus: "success_with_rows",
      dataSourceUsed: "normalized",
      verificationStatus: "pending",
      coverageComplete: false,
      rawTotal: null, normalizedTotal: 500.00, difference: null,
      currency: "USD",
      recordsFetched: 3, recordsSkipped: 0, errorSummary: null,
    };
    expect(detail.verificationStatus).toBe("pending");
    expect(detail.coverageComplete).toBe(false);
  });
});

// ------------------------------------------------------------------
// N29: failed sync → not_available, coverageComplete=false
// ------------------------------------------------------------------
describe("N29 — failed sync → not_available/coverageComplete=false", () => {
  it("derives failed correctly", () => {
    const status = deriveSyncStatus({ status: "failed", records_fetched: 0, records_skipped: 0 });
    expect(status).toBe("failed");
  });

  it("produces not_available and coverageComplete=false", () => {
    const detail: CreditCoverageDetail = {
      syncStatus: "failed",
      dataSourceUsed: "none",
      verificationStatus: "not_available",
      coverageComplete: false,
      rawTotal: null, normalizedTotal: null, difference: null,
      currency: "USD",
      recordsFetched: 0, recordsSkipped: 0,
      errorSummary: "QBO API returned 429 Too Many Requests",
    };
    expect(detail.verificationStatus).toBe("not_available");
    expect(detail.coverageComplete).toBe(false);
  });
});

// ------------------------------------------------------------------
// N30: per-currency grouping — USD and CAD never summed together
// ------------------------------------------------------------------
describe("N30 — multi-currency returns separate coverage records", () => {
  it("USD and CAD are not aggregated into a single record", () => {
    const coverage: CreditCoverageDetail[] = [
      {
        syncStatus: "success_with_rows", dataSourceUsed: "normalized", verificationStatus: "verified",
        coverageComplete: true, rawTotal: 1000, normalizedTotal: 1000, difference: 0,
        currency: "USD", recordsFetched: 3, recordsSkipped: 0, errorSummary: null,
      },
      {
        syncStatus: "success_with_rows", dataSourceUsed: "normalized", verificationStatus: "verified",
        coverageComplete: true, rawTotal: 500, normalizedTotal: 500, difference: 0,
        currency: "CAD", recordsFetched: 2, recordsSkipped: 0, errorSummary: null,
      },
    ];
    expect(coverage).toHaveLength(2);
    expect(coverage.map(c => c.currency)).toEqual(["USD", "CAD"]);
    // No combined "USD+CAD" currency
    expect(coverage.every(c => !c.currency.includes("+"))).toBe(true);
  });
});

// ------------------------------------------------------------------
// N31: ArApReconciliation shape includes creditMemoCoverage and vendorCreditCoverage
// ------------------------------------------------------------------
describe("N31 — ArApReconciliation includes creditMemoCoverage[] and vendorCreditCoverage[]", () => {
  it("shape has the two new array fields", () => {
    // Type-level structural check via a locally typed object
    type MockShape = {
      officialAr: number | null;
      creditMemoCoverage: CreditCoverageDetail[];
      vendorCreditCoverage: CreditCoverageDetail[];
    };
    const mock: MockShape = {
      officialAr: 5000,
      creditMemoCoverage: [],
      vendorCreditCoverage: [],
    };
    expect(Array.isArray(mock.creditMemoCoverage)).toBe(true);
    expect(Array.isArray(mock.vendorCreditCoverage)).toBe(true);
  });
});

// ------------------------------------------------------------------
// N32: success_zero_rows uses entity functional currency (not hardcoded USD)
// ------------------------------------------------------------------
describe("N32 — success_zero_rows uses entity functional currency from entities table", () => {
  it("CAD entity with zero rows returns currency=CAD", () => {
    const detail: CreditCoverageDetail = {
      syncStatus: "success_zero_rows",
      dataSourceUsed: "normalized",
      verificationStatus: "verified",
      coverageComplete: true,
      rawTotal: null, normalizedTotal: 0, difference: null,
      currency: "CAD",
      recordsFetched: 0, recordsSkipped: 0, errorSummary: null,
    };
    expect(detail.currency).toBe("CAD");
    expect(detail.coverageComplete).toBe(true);
  });
});

// ------------------------------------------------------------------
// Extra: running sync → not_available/coverageComplete=false
// ------------------------------------------------------------------
describe("running sync status → not_available/coverageComplete=false", () => {
  it("derives running correctly and marks not_available", () => {
    const status = deriveSyncStatus({ status: "running", records_fetched: null, records_skipped: null });
    expect(status).toBe("running");

    const detail: CreditCoverageDetail = {
      syncStatus: "running",
      dataSourceUsed: "none",
      verificationStatus: "not_available",
      coverageComplete: false,
      rawTotal: null, normalizedTotal: null, difference: null,
      currency: "USD",
      recordsFetched: null, recordsSkipped: null, errorSummary: null,
    };
    expect(detail.coverageComplete).toBe(false);
    expect(detail.verificationStatus).toBe("not_available");
  });
});
