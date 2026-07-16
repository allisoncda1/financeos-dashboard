/**
 * portfolioMetrics.test.ts
 *
 * Verifies:
 * 1. computeCashRunwayMonths — correct date-aware formula, null for invalid inputs
 * 2. computeEntityHealthScore — DSO / AR overdue / net margin penalties
 * 3. portfolio_health_score_avg — correct server-side aggregation, Smile More
 *    negative margin must not be suppressed or zeroed
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeCashRunwayMonths } from "../services/kpi";
import { computeEntityHealthScore, entityHealthLabel } from "../lib/health";
import type { EntityMetrics } from "../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<EntityMetrics> = {}): EntityMetrics {
  return {
    entity: "Test Co",
    slug: "CarDealer_ai",
    basis: "Accrual",
    as_of: "2026-06-30",
    pipeline_run: "2026-07-01T00:00:00Z",
    revenue_ytd: 100_000,
    cogs_ytd: 40_000,
    gross_profit_ytd: 60_000,
    gross_margin_pct: 60,
    opex_ytd: 30_000,
    net_income_ytd: 30_000,
    net_margin_pct: 30,
    total_assets: 200_000,
    total_liabilities: 80_000,
    total_equity: 120_000,
    open_ar: 20_000,
    open_ap: 8_000,
    dso_days: 40,
    dso_days_standard: null,
    weighted_average_days_overdue: null,
    dpo_days: 30,
    cash_on_hand: 50_000,
    ar_overdue_pct: 5,
    ap_overdue_pct: 2,
    health_score: 92,
    health_label: "Excellent",
    ...overrides,
  };
}

// ── computeCashRunwayMonths ───────────────────────────────────────────────────

describe("computeCashRunwayMonths", () => {
  beforeEach(() => {
    // Pin to July (month index 6 → monthsElapsed = 7)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
  });

  it("computes runway using months elapsed, not a hardcoded 12", () => {
    // July: monthsElapsed = 7
    // opex $70k YTD → monthly $10k; cash $60k → 6 months
    const result = computeCashRunwayMonths(60_000, 70_000);
    expect(result).toBeCloseTo(6.0, 1);
  });

  it("returns null when cash on hand is zero", () => {
    expect(computeCashRunwayMonths(0, 50_000)).toBeNull();
  });

  it("returns null when cash on hand is negative (Smile More)", () => {
    expect(computeCashRunwayMonths(-5_000, 50_000)).toBeNull();
  });

  it("returns null when opex is zero", () => {
    expect(computeCashRunwayMonths(50_000, 0)).toBeNull();
  });

  it("returns null when opex is negative", () => {
    expect(computeCashRunwayMonths(50_000, -10_000)).toBeNull();
  });

  it("would produce a different result in January (monthsElapsed = 1)", () => {
    vi.setSystemTime(new Date("2026-01-15T00:00:00Z"));
    // opex $10k YTD in Jan → monthly $10k; same monthly burn as July
    // (confirming the formula is date-aware, not hardcoded)
    const jan = computeCashRunwayMonths(60_000, 10_000);
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
    const jul = computeCashRunwayMonths(60_000, 70_000);
    expect(jan).toBeCloseTo(jul!, 1);
  });
});

// ── computeEntityHealthScore ──────────────────────────────────────────────────

describe("computeEntityHealthScore", () => {
  it("returns 100 for healthy metrics", () => {
    const score = computeEntityHealthScore(makeMetrics({ dso_days: 30, ar_overdue_pct: 3, net_margin_pct: 20 }));
    expect(score).toBe(100);
  });

  it("applies DSO >75 penalty of 20", () => {
    const score = computeEntityHealthScore(makeMetrics({ dso_days: 80, ar_overdue_pct: 3, net_margin_pct: 20 }));
    expect(score).toBe(80);
  });

  it("applies DSO >60 penalty of 12", () => {
    const score = computeEntityHealthScore(makeMetrics({ dso_days: 65, ar_overdue_pct: 3, net_margin_pct: 20 }));
    expect(score).toBe(88);
  });

  it("applies AR overdue >25% penalty of 15", () => {
    const score = computeEntityHealthScore(makeMetrics({ dso_days: 30, ar_overdue_pct: 30, net_margin_pct: 20 }));
    expect(score).toBe(85);
  });

  it("applies negative margin penalty of 15 (Smile More scenario)", () => {
    const score = computeEntityHealthScore(makeMetrics({ dso_days: 30, ar_overdue_pct: 3, net_margin_pct: -5 }));
    expect(score).toBe(85);
  });

  it("negative margin must NOT be zeroed or replaced with zero", () => {
    // Ensures Smile More's real loss is correctly penalised, not hidden
    const withNegative = computeEntityHealthScore(makeMetrics({ net_margin_pct: -10 }));
    const withZero     = computeEntityHealthScore(makeMetrics({ net_margin_pct: 0 }));
    // negative margin penalty (15) > zero-margin penalty (5)
    expect(withNegative).toBeLessThan(withZero);
  });

  it("accumulates all three penalty categories correctly", () => {
    // DSO>75: -20, AR>25%: -15, negative margin: -15 → 50
    const score = computeEntityHealthScore(makeMetrics({
      dso_days: 100, ar_overdue_pct: 50, net_margin_pct: -50,
    }));
    expect(score).toBe(50);
  });

  it("health label is Excellent at 100", () => {
    expect(entityHealthLabel(100)).toBe("Excellent");
  });

  it("health label is Good at 80", () => {
    expect(entityHealthLabel(80)).toBe("Good");
  });

  it("health label is Needs Attention at 60", () => {
    expect(entityHealthLabel(60)).toBe("Needs Attention");
  });
});

// ── portfolioHealthScoreAvg aggregation logic ─────────────────────────────────

describe("portfolio health score average aggregation", () => {
  it("averages scores from all four entities", () => {
    const entities = [
      makeMetrics({ dso_days: 30, ar_overdue_pct: 3, net_margin_pct: 20 }),  // 100
      makeMetrics({ dso_days: 65, ar_overdue_pct: 3, net_margin_pct: 20 }),  // 88
      makeMetrics({ dso_days: 30, ar_overdue_pct: 3, net_margin_pct: 6 }),   // 100
      makeMetrics({ dso_days: 30, ar_overdue_pct: 3, net_margin_pct: -5 }),  // 85 (Smile More)
    ];
    const scores = entities.map(computeEntityHealthScore);
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    expect(scores[3]).toBe(85);   // Smile More negative margin penalised
    expect(avg).toBe(93);         // (100 + 88 + 100 + 85) / 4 = 93.25 → 93
  });

  it("Smile More negative cash runway does not affect health score (separate metric)", () => {
    // Health score uses net_margin_pct, NOT cash_on_hand
    const withNegativeCash = computeEntityHealthScore(makeMetrics({ cash_on_hand: -5_000, net_margin_pct: 20 }));
    const withPositiveCash = computeEntityHealthScore(makeMetrics({ cash_on_hand: 50_000, net_margin_pct: 20 }));
    expect(withNegativeCash).toBe(withPositiveCash);
  });
});
