/**
 * customersNeon — unit tests
 *
 * Verifies that transformCustomersNeon uses the authoritative AR values from
 * the Python semantic layer (entity snapshot ar_ap_metrics) rather than
 * independently recalculating totals from invoice records.
 *
 * Key regression: T3 Marketing invoice sum = $68,669.60 (positive-only invoices).
 * Authoritative QBO Summary total = $42,502.18 (includes Goose Creek Mitsubishi
 * -$3,000 credit + partial-balance invoices). The Customers page must show
 * the official QBO figure.
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";

// ── Mock all external dependencies ────────────────────────────────────────────
// We test the pure transformation logic by controlling what the DB returns.

vi.mock("../../db", () => ({
  InvoicesService: {
    getTopCustomersByAr: vi.fn(),
    getOpenInvoices:     vi.fn(),
    getArAgingBuckets:   vi.fn(),
  },
  FinancialPeriodsService: {
    getMonthlyPeriods: vi.fn(),
  },
}));

vi.mock("../../db/snapshots", () => ({
  getCurrentSnapshot: vi.fn(),
}));

vi.mock("../../services/entityCache", () => ({
  getCachedEntityId: vi.fn(),
}));

import { InvoicesService, FinancialPeriodsService } from "../../db";
import { getCurrentSnapshot } from "../../db/snapshots";
import { getCachedEntityId } from "../../services/entityCache";
import { transformCustomersNeon } from "../customersNeon";

const mockedGetEntityId      = getCachedEntityId      as MockedFunction<typeof getCachedEntityId>;
const mockedGetSnapshot      = getCurrentSnapshot     as MockedFunction<typeof getCurrentSnapshot>;
const mockedGetTopCustomers  = InvoicesService.getTopCustomersByAr as MockedFunction<typeof InvoicesService.getTopCustomersByAr>;
const mockedGetMonthly       = FinancialPeriodsService.getMonthlyPeriods as MockedFunction<typeof FinancialPeriodsService.getMonthlyPeriods>;
const mockedGetOpenInvoices  = InvoicesService.getOpenInvoices as MockedFunction<typeof InvoicesService.getOpenInvoices>;
const mockedGetAgingBuckets  = InvoicesService.getArAgingBuckets as MockedFunction<typeof InvoicesService.getArAgingBuckets>;

// ── Production snapshot fixtures ─────────────────────────────────────────────

/**
 * Builds a minimal entity snapshot matching the post-RC-001 Neon state.
 * ar_ap_metrics structure mirrors what build_semantic_layer.py writes.
 */
function makeSnapshot(ar_ap_metrics: object) {
  return {
    id: "test-snapshot-id",
    entityId: "test-entity-id",
    isCurrent: true,
    asOf: "2026-07-11",
    generatedAt: new Date("2026-07-11T19:35:56Z"),
    metrics: { ar_ap_metrics },
    // other fields omitted — not used by transformer
  } as unknown as Awaited<ReturnType<typeof getCurrentSnapshot>>;
}

// T3 Marketing — post-publication snapshot (2026-07-11)
const T3_SNAPSHOT = makeSnapshot({
  open_ar:        42502.18,
  open_ap:        2518.94,
  ar_overdue:     42502.18,
  ar_overdue_pct: 100.0,
  ap_overdue:     2518.94,
  ap_overdue_pct: 100.0,
  dso_days:       72.1,
  dpo_days:       0.0,
  ar_aging_buckets: {
    current:      0.0,
    days_1_30:    37703.50,
    days_31_60:   128.60,
    days_61_90:   1770.00,
    days_91_plus: 2900.08,
  },
  ap_aging_buckets: {
    current:      0.0,
    days_1_30:    0.0,
    days_31_60:   0.0,
    days_61_90:   0.0,
    days_91_plus: 2518.94,
  },
});

const CARDEALER_SNAPSHOT = makeSnapshot({
  open_ar:        22145.0,
  open_ap:        0.0,
  ar_overdue:     22145.0,
  ar_overdue_pct: 100.0,
  ar_aging_buckets: {
    current:      0.0,
    days_1_30:    9175.0,
    days_31_60:   1695.0,
    days_61_90:   0.0,
    days_91_plus: 11275.0,
  },
});

const TOPMRKTR_SNAPSHOT = makeSnapshot({
  open_ar:        33940.0,
  open_ap:        0.0,
  ar_overdue:     31940.0,
  ar_overdue_pct: 94.1072,
  ar_aging_buckets: {
    current:      2000.0,
    days_1_30:    8600.0,
    days_31_60:   0.0,
    days_61_90:   2800.0,
    days_91_plus: 20540.0,
  },
});

const SMILE_MORE_SNAPSHOT = makeSnapshot({
  open_ar:        50200.0,
  open_ap:        0.0,
  ar_overdue:     48100.0,
  ar_overdue_pct: 95.8167,
  ar_aging_buckets: {
    current:      2100.0,
    days_1_30:    0.0,
    days_31_60:   0.0,
    days_61_90:   46200.0,
    days_91_plus: 1900.0,
  },
});

// T3 invoice sum (positive-only) that the old code would have returned.
// This is the defective figure that the fix must prevent.
const T3_INVOICE_SUM = 68669.60;

const EMPTY_CUSTOMERS = [] as Awaited<ReturnType<typeof InvoicesService.getTopCustomersByAr>>;
const EMPTY_PERIODS   = [] as Awaited<ReturnType<typeof FinancialPeriodsService.getMonthlyPeriods>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetEntityId.mockResolvedValue("test-entity-id");
  mockedGetTopCustomers.mockResolvedValue(EMPTY_CUSTOMERS);
  mockedGetMonthly.mockResolvedValue(EMPTY_PERIODS);
});

// ── Test suite ────────────────────────────────────────────────────────────────

describe("transformCustomersNeon — authoritative AR from entity snapshot", () => {

  it("1. T3 open_ar = $42,502.18, not the invoice sum $68,669.60", async () => {
    mockedGetSnapshot.mockResolvedValue(T3_SNAPSHOT);
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    expect(result.open_ar).toBeCloseTo(42502.18, 2);
    expect(result.open_ar).not.toBeCloseTo(T3_INVOICE_SUM, 1);
  });

  it("2. T3 Current bucket = $0.00 (all AR is aged past due)", async () => {
    mockedGetSnapshot.mockResolvedValue(T3_SNAPSHOT);
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    const currentBucket = result.aging.find((b) => b.label === "Current");
    expect(currentBucket?.amount).toBeCloseTo(0.0, 2);
  });

  it("3. T3 1-30 bucket = $37,703.50", async () => {
    mockedGetSnapshot.mockResolvedValue(T3_SNAPSHOT);
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    const bucket130 = result.aging.find((b) => b.label === "1-30");
    expect(bucket130?.amount).toBeCloseTo(37703.50, 2);
  });

  it("4. T3 ar_overdue = $42,502.18 (all AR is overdue)", async () => {
    mockedGetSnapshot.mockResolvedValue(T3_SNAPSHOT);
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    expect(result.ar_overdue).toBeCloseTo(42502.18, 2);
  });

  it("5. T3 ar_overdue_pct = 100%", async () => {
    mockedGetSnapshot.mockResolvedValue(T3_SNAPSHOT);
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    expect(result.ar_overdue_pct).toBeCloseTo(100.0, 1);
  });

  it("6. The 1-30 bucket is present in the aging array at index 1 (it IS overdue)", async () => {
    mockedGetSnapshot.mockResolvedValue(T3_SNAPSHOT);
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    // Index 0 = Current (not overdue), index 1 = 1-30 (overdue)
    expect(result.aging[0]?.label).toBe("Current");
    expect(result.aging[1]?.label).toBe("1-30");
    // The 1-30 bucket must have a non-zero value to be included in overdue
    expect(result.aging[1]?.amount).toBeGreaterThan(0);
    // ar_overdue must include the 1-30 amount
    const overdueFromBuckets = result.aging.slice(1).reduce((s, b) => s + b.amount, 0);
    expect(overdueFromBuckets).toBeCloseTo(result.ar_overdue, 2);
  });

  it("7. Customer invoice rows do not override the authoritative Summary total", async () => {
    // Simulate a scenario where invoice sum would be higher than the official total.
    // The transformer must use the snapshot total, not the invoice sum.
    mockedGetSnapshot.mockResolvedValue(T3_SNAPSHOT);
    mockedGetTopCustomers.mockResolvedValue([
      // These are positive-only invoice rows that sum to $68,669.60 —
      // the exact defective value that would have been returned before the fix.
      { name: "Customer A", balance: 45000, dsodays: 45, status: "overdue" as const },
      { name: "Customer B", balance: 23669.60, dsodays: 10, status: "overdue" as const },
    ]);
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    // Invoice sum = $68,669.60; snapshot AR = $42,502.18
    // open_ar must be the snapshot value
    expect(result.open_ar).toBeCloseTo(42502.18, 2);
    // Customer rows are still present (detail, not total)
    expect(result.top_customers).toHaveLength(2);
  });

  it("8a. CarDealer.ai open_ar = $22,145.00", async () => {
    mockedGetSnapshot.mockResolvedValue(CARDEALER_SNAPSHOT);
    const result = await transformCustomersNeon("CarDealer_ai", "2026-07-11");
    expect(result.open_ar).toBeCloseTo(22145.0, 2);
    expect(result.ar_overdue_pct).toBeCloseTo(100.0, 1);
  });

  it("8b. TopMrktr open_ar = $33,940.00, overdue_pct ≈ 94.1%", async () => {
    mockedGetSnapshot.mockResolvedValue(TOPMRKTR_SNAPSHOT);
    const result = await transformCustomersNeon("TopMrktr", "2026-07-11");
    expect(result.open_ar).toBeCloseTo(33940.0, 2);
    expect(result.ar_overdue_pct).toBeCloseTo(94.1, 1);
  });

  it("8c. Smile More open_ar = $50,200.00, overdue_pct ≈ 95.8%", async () => {
    mockedGetSnapshot.mockResolvedValue(SMILE_MORE_SNAPSHOT);
    const result = await transformCustomersNeon("Smile_More", "2026-07-11");
    expect(result.open_ar).toBeCloseTo(50200.0, 2);
    expect(result.ar_overdue_pct).toBeCloseTo(95.8, 1);
  });

  it("9. No invoice fallback is triggered when a current snapshot exists", async () => {
    mockedGetSnapshot.mockResolvedValue(T3_SNAPSHOT);
    await transformCustomersNeon("T3_Marketing", "2026-07-11");
    // getOpenInvoices must NOT be called — it is only used in the fallback path
    expect(mockedGetOpenInvoices).not.toHaveBeenCalled();
    expect(mockedGetAgingBuckets).not.toHaveBeenCalled();
    // Source must be flagged as snapshot
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    expect(result.aging_source).toBe("snapshot");
  });

  it("10. Portfolio and Customers pages agree on T3 Open AR ($42,502.18)", async () => {
    // The Portfolio page reads open_ar from financial_periods.open_ar (updated
    // by the Python semantic layer to $42,502.18). The Customers page now reads
    // from the entity snapshot ar_ap_metrics.open_ar (also $42,502.18).
    // This test confirms the Customers transformer returns the same figure.
    mockedGetSnapshot.mockResolvedValue(T3_SNAPSHOT);
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    // The authoritative portfolio-level AR value for T3 (from financial_periods.open_ar)
    const PORTFOLIO_OPEN_AR_T3 = 42502.18;
    expect(result.open_ar).toBeCloseTo(PORTFOLIO_OPEN_AR_T3, 2);
  });

  it("fallback: uses invoice sum when no snapshot is available", async () => {
    mockedGetSnapshot.mockResolvedValue(null);
    const mockInvoices = [
      { balance: 10000, daysOverdue: 0 },
      { balance: 5000,  daysOverdue: 15 },
    ] as Awaited<ReturnType<typeof InvoicesService.getOpenInvoices>>;
    mockedGetOpenInvoices.mockResolvedValue(mockInvoices);
    mockedGetAgingBuckets.mockResolvedValue([]);
    const result = await transformCustomersNeon("T3_Marketing", "2026-07-11");
    expect(result.open_ar).toBeCloseTo(15000, 2);
    expect(result.aging_source).toBe("invoices");
    // Invoice fallback IS called in this path
    expect(mockedGetOpenInvoices).toHaveBeenCalled();
  });
});
