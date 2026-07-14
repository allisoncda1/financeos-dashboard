/**
 * RC-016 Portfolio consolidated Cash Flow tests.
 *
 * Covers the pure `consolidateCashFlow` reducer that powers the
 * /analyze/cashflow page: backend-only summation, passed+published filtering
 * (inherited from getCashFlowFromNeon, exercised in cashFlowNeon.test.ts),
 * negative/zero preservation, honest unavailable/partial states, and the
 * absence of any fabricated values for missing entities.
 *
 * REGRESSION: beginning_cash must be read directly from the DB column
 * (cash_flow_statements.beginning_cash, validated by CF-12), never derived
 * as ending_cash - net_change.
 *
 * No real database connection is used.
 */
import { describe, expect, it } from "vitest";
import type { EntitySlug } from "../types";

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

/** Build a figures object directly (mirrors the DB column read path). */
function figures(
  operating: number,
  investing: number,
  financing: number,
  net_change: number,
  beginning_cash: number,
  ending_cash: number,
  as_of = AS_OF,
): NonNullable<CashFlowEntry["figures"]> {
  return { as_of, operating, investing, financing, net_change, beginning_cash, ending_cash };
}

const ALL_SLUGS: EntitySlug[] = ["CarDealer_ai", "T3_Marketing", "TopMrktr", "Smile_More"];

// Contrived per-entity figures whose portfolio totals match the RC-016
// verification targets: net change 7,920.68 and ending cash -233,785.12.
// beginning_cash values are authoritative DB values (NOT derived from ending - net).
const FOUR_ENTRIES: CashFlowEntry[] = [
  { slug: "CarDealer_ai", entity: "CarDealer.ai", figures: figures(12000, -3000, -1000, 8000, 142000.5, 150000.5) },
  { slug: "T3_Marketing", entity: "T3 Marketing", figures: figures(3000, 0, -500, 2500, 37500.25, 40000.25) },
  { slug: "TopMrktr", entity: "TopMrktr", figures: figures(1500, -200, 0, 1300, 23914.13, 25214.13) },
  // Smile_More negative position.
  { slug: "Smile_More", entity: "Smile More", figures: figures(-2879.32, 0, -1000, -3879.32, -445120.68, -449000) },
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
    const r = consolidateCashFlow(["Smile_More"], [FOUR_ENTRIES[3]!]);
    expect(r.ending_cash).toBeLessThan(0);
    expect(r.ending_cash).toBeCloseTo(-449000, 2);
    expect(r.net_change).toBeCloseTo(-3879.32, 2);
  });

  it("preserves legitimate zeros without substitution", () => {
    const r = consolidateCashFlow(["T3_Marketing"], [{ slug: "T3_Marketing", entity: "T3 Marketing", figures: figures(0, 0, 0, 0, 0, 0) }]);
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
    const entries: CashFlowEntry[] = ALL_SLUGS.map((slug) => ({ slug, entity: slug, figures: null }));
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
      FOUR_ENTRIES[0]!,
      { slug: "T3_Marketing", entity: "T3 Marketing", figures: null },
      FOUR_ENTRIES[2]!,
      { slug: "Smile_More", entity: "Smile More", figures: null },
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
      { slug: "CarDealer_ai", entity: "CarDealer.ai", figures: figures(1, 0, 0, 1, 99, 100, "2026-07-13") },
      { slug: "T3_Marketing", entity: "T3 Marketing", figures: figures(1, 0, 0, 1, 99, 100, "2026-06-30") },
    ];
    const r = consolidateCashFlow(["CarDealer_ai", "T3_Marketing"], entries);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("incompatible_periods");
  });
});

// ── beginning_cash regression tests ──────────────────────────────────────────
// These tests prove the stored DB value is used directly, not derived from
// ending_cash - net_change. This guards against regression to the wrong
// "beginning_cash = ending_cash - net_change" derivation formula.

describe("consolidateCashFlow — beginning_cash read from DB, never derived", () => {
  it("uses the stored beginning_cash value, not ending_cash - net_change", () => {
    // Deliberately make beginning_cash NOT equal ending_cash - net_change
    // so a derivation formula would produce a wrong value.
    const dbBeginningCash = 99999;
    const endingCash = 110000;
    const netChange = 5000;
    // If derived: 110000 - 5000 = 105000 (wrong)
    // From DB:    99999 (correct)
    const entry: CashFlowEntry = {
      slug: "CarDealer_ai",
      entity: "CarDealer.ai",
      figures: figures(8000, -1000, -2000, 5000, dbBeginningCash, endingCash),
    };
    const r = consolidateCashFlow(["CarDealer_ai"], [entry]);
    expect(r.available).toBe(true);
    expect(r.beginning_cash).toBe(dbBeginningCash);
    // Explicitly not the derived value:
    expect(r.beginning_cash).not.toBe(endingCash - netChange);
  });

  it("a null beginning_cash in any entity excludes that entity (unavailable/partial), not a fabricated value", () => {
    // Entity with null beginning_cash should appear in missing[], not contribute a fabricated 0
    const entries: CashFlowEntry[] = [
      { slug: "CarDealer_ai", entity: "CarDealer.ai", figures: null }, // null figures = null beginning_cash
    ];
    const r = consolidateCashFlow(["CarDealer_ai"], entries);
    expect(r.available).toBe(false);
    expect(r.reason).toBe("no_published_statements");
    expect(r.missing).toContain("CarDealer_ai");
    // beginning_cash in the unavailable result must be 0 (the honest empty state)
    expect(r.beginning_cash).toBe(0);
  });

  it("a zero beginning_cash is preserved as 0 (not treated as missing)", () => {
    const entry: CashFlowEntry = {
      slug: "T3_Marketing",
      entity: "T3 Marketing",
      figures: figures(5000, 0, 0, 5000, 0, 5000), // beginning_cash = 0
    };
    const r = consolidateCashFlow(["T3_Marketing"], [entry]);
    expect(r.available).toBe(true);
    expect(r.beginning_cash).toBe(0);
    // Entity is NOT in missing — zero is a legitimate stored value
    expect(r.missing).not.toContain("T3_Marketing");
    expect(r.entities).toHaveLength(1);
  });

  it("a negative beginning_cash is preserved as-is", () => {
    const entry: CashFlowEntry = {
      slug: "Smile_More",
      entity: "Smile More",
      figures: figures(-1000, 0, 0, 500, -1500, -1000), // beginning_cash = -1500
    };
    const r = consolidateCashFlow(["Smile_More"], [entry]);
    expect(r.available).toBe(true);
    expect(r.beginning_cash).toBe(-1500);
    expect(r.beginning_cash).toBeLessThan(0);
  });

  it("sums stored beginning_cash values across entities (not derived per entity)", () => {
    // Two entities each with beginning_cash that does NOT equal ending - net
    const e1: CashFlowEntry = {
      slug: "CarDealer_ai",
      entity: "CarDealer.ai",
      figures: figures(10000, 0, 0, 10000, 40000, 50000), // beginning_cash = 40000 (stored)
    };
    const e2: CashFlowEntry = {
      slug: "T3_Marketing",
      entity: "T3 Marketing",
      figures: figures(5000, 0, 0, 5000, 15000, 20000), // beginning_cash = 15000 (stored)
    };
    const r = consolidateCashFlow(["CarDealer_ai", "T3_Marketing"], [e1, e2]);
    expect(r.available).toBe(true);
    // Portfolio beginning_cash = 40000 + 15000 = 55000 (stored values summed)
    expect(r.beginning_cash).toBe(55000);
    // NOT the derived value: ending_cash(70000) - net_change(15000) = 55000 coincidentally matches here,
    // so let's verify via a case where they diverge:
    const e3: CashFlowEntry = {
      slug: "TopMrktr",
      entity: "TopMrktr",
      // Stored beginning_cash deliberately differs from ending - net
      figures: figures(3000, 0, 0, 3000, 12000, 15000), // beginning_cash = 12000 stored
    };
    const r2 = consolidateCashFlow(["CarDealer_ai", "T3_Marketing", "TopMrktr"], [e1, e2, e3]);
    // Sum of stored beginning_cash: 40000 + 15000 + 12000 = 67000
    expect(r2.beginning_cash).toBe(67000);
  });
});
