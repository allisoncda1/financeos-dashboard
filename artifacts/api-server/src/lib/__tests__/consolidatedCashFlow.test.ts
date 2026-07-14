/**
 * RC-016 Portfolio consolidated Cash Flow tests.
 *
 * Covers the pure `consolidateCashFlow` reducer that powers the
 * /analyze/cashflow page: backend-only summation, passed+published filtering
 * (inherited from getCashFlowFromNeon, exercised in cashFlowNeon.test.ts),
 * negative/zero preservation, honest unavailable/partial states, and the
 * absence of any fabricated values for missing entities.
 *
 * No real database connection is used.
 */
import { describe, expect, it } from "vitest";
import type { CashFlowStatement, EntitySlug } from "../types";

// drizzle-orm / @workspace/db are imported transitively by neonSource; stub the
// pieces the module references at import time so no real connection is opened.
import { vi } from "vitest";
vi.mock("@workspace/db", () => ({
  db: { select: vi.fn() },
  cashFlowStatementsTable: {},
  entitiesTable: {},
  financialPeriodsTable: {},
  portfolioSnapshotsTable: {},
  syncRunsTable: {},
  validationResultsTable: {},
  entitySnapshotsTable: {},
  invoicesTable: {},
  billsTable: {},
  accountsTable: {},
  transactionsTable: {},
  customersTable: {},
  alertsTable: {},
}));
vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ _tag: "and", conditions: a }),
  eq: (col: unknown, val: unknown) => ({ _tag: "eq", col, val }),
  desc: (col: unknown) => ({ _tag: "desc", col }),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

import { consolidateCashFlow, type CashFlowEntry } from "../neonSource";

// ── Fixtures ────────────────────────────────────────────────────────────────
// Four entities modelled on the RC-016 dry-run: Smile_More carries a negative
// ending cash position and must stay negative through consolidation.

const AS_OF = "2026-07-13";

function stmt(
  operating: number,
  investing: number,
  financing: number,
  net_change: number,
  cash_at_end: number,
  as_of = AS_OF,
): CashFlowStatement {
  return {
    as_of,
    sections: [
      { name: "Operating Activities", lines: [], net_cash: operating },
      { name: "Investing Activities", lines: [], net_cash: investing },
      { name: "Financing Activities", lines: [], net_cash: financing },
    ],
    net_cash_change: net_change,
    cash_at_end,
  };
}

const ALL_SLUGS: EntitySlug[] = ["CarDealer_ai", "T3_Marketing", "TopMrktr", "Smile_More"];

// Contrived per-entity figures whose portfolio totals match the RC-016
// verification targets: net change 7,920.68 and ending cash -233,785.12.
const FOUR_ENTRIES: CashFlowEntry[] = [
  { slug: "CarDealer_ai", entity: "CarDealer.ai", statement: stmt(12000, -3000, -1000, 8000, 150000.5) },
  { slug: "T3_Marketing", entity: "T3 Marketing", statement: stmt(3000, 0, -500, 2500, 40000.25) },
  { slug: "TopMrktr", entity: "TopMrktr", statement: stmt(1500, -200, 0, 1300, 25214.13) },
  // Smile_More negative position.
  { slug: "Smile_More", entity: "Smile More", statement: stmt(-2879.32, 0, -1000, -3879.32, -449000) },
];

// ── Backend-only aggregation ─────────────────────────────────────────────────

describe("consolidateCashFlow — portfolio aggregation", () => {
  it("sums operating / investing / financing across selected entities", () => {
    const r = consolidateCashFlow(ALL_SLUGS, FOUR_ENTRIES);
    expect(r.available).toBe(true);
    expect(r.operating).toBeCloseTo(12000 + 3000 + 1500 - 2879.32, 2);
    expect(r.investing).toBeCloseTo(-3000 + 0 - 200 + 0, 2);
    expect(r.financing).toBeCloseTo(-1000 - 500 + 0 - 1000, 2);
  });

  it("matches the RC-016 verification totals (net change + ending cash)", () => {
    const r = consolidateCashFlow(ALL_SLUGS, FOUR_ENTRIES);
    expect(r.net_change).toBeCloseTo(7920.68, 2);
    expect(r.ending_cash).toBeCloseTo(-233785.12, 2);
  });

  it("derives beginning_cash = ending_cash - net_change (never fabricated)", () => {
    const r = consolidateCashFlow(ALL_SLUGS, FOUR_ENTRIES);
    expect(r.beginning_cash).toBeCloseTo(r.ending_cash - r.net_change, 2);
  });

  it("respects entity filtering — only selected entities are summed", () => {
    const two = FOUR_ENTRIES.slice(0, 2);
    const r = consolidateCashFlow(["CarDealer_ai", "T3_Marketing"], two);
    expect(r.entities.map((e) => e.slug)).toEqual(["CarDealer_ai", "T3_Marketing"]);
    expect(r.net_change).toBeCloseTo(8000 + 2500, 2);
    expect(r.partial).toBe(false);
  });
});

// ── Negative & zero preservation ─────────────────────────────────────────────

describe("consolidateCashFlow — sign and zero handling", () => {
  it("preserves negative totals (Smile_More stays negative)", () => {
    const r = consolidateCashFlow(["Smile_More"], [FOUR_ENTRIES[3]]);
    expect(r.ending_cash).toBeLessThan(0);
    expect(r.ending_cash).toBeCloseTo(-449000, 2);
    expect(r.net_change).toBeCloseTo(-3879.32, 2);
  });

  it("preserves legitimate zeros without substitution", () => {
    const zero = stmt(0, 0, 0, 0, 0);
    const r = consolidateCashFlow(["T3_Marketing"], [{ slug: "T3_Marketing", entity: "T3 Marketing", statement: zero }]);
    expect(r.available).toBe(true);
    expect(r.operating).toBe(0);
    expect(r.investing).toBe(0);
    expect(r.financing).toBe(0);
    expect(r.ending_cash).toBe(0);
  });
});

// ── Honest unavailable / partial states ──────────────────────────────────────

describe("consolidateCashFlow — unavailable and partial states", () => {
  it("returns unavailable when no entity is selected", () => {
    const r = consolidateCashFlow([], []);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("no_entities_selected");
  });

  it("returns unavailable when no selected entity has a published statement", () => {
    const entries: CashFlowEntry[] = ALL_SLUGS.map((slug) => ({ slug, entity: slug, statement: null }));
    const r = consolidateCashFlow(ALL_SLUGS, entries);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("no_published_statements");
    // No fabricated values.
    expect(r.operating).toBe(0);
    expect(r.ending_cash).toBe(0);
    expect(r.missing).toEqual(ALL_SLUGS);
  });

  it("returns a partial state when SOME entities are missing statements", () => {
    const entries: CashFlowEntry[] = [
      FOUR_ENTRIES[0],
      { slug: "T3_Marketing", entity: "T3 Marketing", statement: null },
      FOUR_ENTRIES[2],
      { slug: "Smile_More", entity: "Smile More", statement: null },
    ];
    const r = consolidateCashFlow(ALL_SLUGS, entries);
    expect(r.available).toBe(true);
    expect(r.partial).toBe(true);
    expect(r.missing).toEqual(["T3_Marketing", "Smile_More"]);
    // Totals cover ONLY the two contributing entities — nothing fabricated for
    // the missing ones.
    expect(r.entities.map((e) => e.slug)).toEqual(["CarDealer_ai", "TopMrktr"]);
    expect(r.net_change).toBeCloseTo(8000 + 1300, 2);
  });

  it("returns unavailable (incompatible_periods) when as_of differs", () => {
    const entries: CashFlowEntry[] = [
      { slug: "CarDealer_ai", entity: "CarDealer.ai", statement: stmt(1, 0, 0, 1, 100, "2026-07-13") },
      { slug: "T3_Marketing", entity: "T3 Marketing", statement: stmt(1, 0, 0, 1, 100, "2026-06-30") },
    ];
    const r = consolidateCashFlow(["CarDealer_ai", "T3_Marketing"], entries);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("incompatible_periods");
  });
});
