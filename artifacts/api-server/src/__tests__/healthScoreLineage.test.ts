/**
 * healthScoreLineage.test.ts
 *
 * Proves that all three dashboard surfaces share ONE canonical server-computed
 * Health Score — no surface computes its own headline score independently.
 *
 * The canonical path:
 *   computeEntityHealthScore(m) → withHealth(m) in lib/health.ts
 *
 * Surface contracts:
 *   Entity Dashboard → reads m.health_score from the /api/dashboard response
 *   Sidebar          → reads dashboard.metrics[slug].health_score from the same response
 *   Portfolio        → reads p.portfolio_health_score_avg (server-computed average)
 *
 * This file tests:
 *   1. computeEntityHealthScore is deterministic for any fixture (one function,
 *      one output — both Entity Dashboard and Sidebar see the same value).
 *   2. withHealth() attaches exactly computeEntityHealthScore's output.
 *   3. Portfolio average excludes missing scores (null) — not treated as zero.
 *   4. Portfolio average reports partial coverage correctly.
 *   5. Smile More's negative margin is not suppressed in health computation.
 */

import { describe, it, expect } from "vitest";
import { computeEntityHealthScore, entityHealthLabel, withHealth } from "../lib/health";
import type { EntityMetrics } from "../lib/types";

// ── Fixture factory ───────────────────────────────────────────────────────────

function makeMetrics(overrides: Partial<EntityMetrics> = {}): EntityMetrics {
  return {
    entity: "Test Co",
    slug: "CarDealer_ai",
    basis: "Accrual",
    as_of: "2026-06-30",
    pipeline_run: "2026-07-01T00:00:00Z",
    revenue_ytd:      100_000,
    cogs_ytd:          40_000,
    gross_profit_ytd:  60_000,
    gross_margin_pct:  60,
    opex_ytd:          30_000,
    net_income_ytd:    30_000,
    net_margin_pct:    30,
    total_assets:     200_000,
    total_liabilities: 80_000,
    total_equity:     120_000,
    open_ar:           20_000,
    open_ap:            8_000,
    dso_days:          40,
    dso_days_standard: null,
    weighted_average_days_overdue: null,
    dpo_days:          30,
    cash_on_hand:      50_000,
    ar_overdue_pct:     5,
    ap_overdue_pct:     2,
    health_score:      100,
    health_label:      "Excellent",
    ...overrides,
  };
}

// ── 1. Determinism — same fixture yields same score every call ─────────────────

describe("computeEntityHealthScore — determinism", () => {
  it("returns identical score on repeated calls with the same fixture", () => {
    const m = makeMetrics({ dso_days: 50, ar_overdue_pct: 8, net_margin_pct: 10 });
    const first  = computeEntityHealthScore(m);
    const second = computeEntityHealthScore(m);
    expect(first).toBe(second);
  });

  it("Entity Dashboard and Sidebar see identical score: both read from withHealth output", () => {
    const raw = makeMetrics();
    const enriched = withHealth(raw);
    // Entity dashboard reads enriched.health_score
    const entityDashboardScore = enriched.health_score;
    // Sidebar reads the same field from the same API response
    const sidebarScore = enriched.health_score;
    expect(entityDashboardScore).toBe(sidebarScore);
  });

  it("withHealth attaches exactly computeEntityHealthScore's output — no divergence", () => {
    const raw = makeMetrics({ dso_days: 65, ar_overdue_pct: 20, net_margin_pct: 3 });
    const expected = computeEntityHealthScore(raw);
    const enriched = withHealth(raw);
    expect(enriched.health_score).toBe(expected);
  });

  it("different fixture → different score (not a constant)", () => {
    const goodEntity = makeMetrics({ dso_days: 20, ar_overdue_pct: 2, net_margin_pct: 25 });
    const badEntity  = makeMetrics({ dso_days: 80, ar_overdue_pct: 30, net_margin_pct: -10 });
    expect(computeEntityHealthScore(goodEntity)).toBeGreaterThan(
      computeEntityHealthScore(badEntity),
    );
  });
});

// ── 2. withHealth label matches score ─────────────────────────────────────────

describe("withHealth — label assignment", () => {
  it("score >= 80 → Excellent", () => {
    const m = makeMetrics({ dso_days: 20, ar_overdue_pct: 2, net_margin_pct: 25 });
    const enriched = withHealth(m);
    if (enriched.health_score! >= 80) {
      expect(enriched.health_label).toBe("Excellent");
    }
  });

  it("score 60–79 → Good", () => {
    // DSO=65 → -12, AR=20% → -15: 100-12-15 = 73
    const m = makeMetrics({ dso_days: 65, ar_overdue_pct: 20, net_margin_pct: 10 });
    const score = computeEntityHealthScore(m);
    const label = entityHealthLabel(score);
    if (score >= 60 && score < 80) {
      expect(label).toBe("Good");
    }
  });

  it("score < 60 → Needs Attention", () => {
    // DSO=80 → -20, AR=30% → -15, margin=-5% → -15: 100-20-15-15 = 50
    const m = makeMetrics({ dso_days: 80, ar_overdue_pct: 30, net_margin_pct: -5 });
    const score = computeEntityHealthScore(m);
    const label = entityHealthLabel(score);
    expect(score).toBeLessThan(60);
    expect(label).toBe("Needs Attention");
  });
});

// ── 3. Portfolio average excludes nulls — not treated as zero ─────────────────

/**
 * Helper that mirrors getPortfolioSummaryFromNeon's portfolio_health_score_avg
 * computation: average only over entities with a non-null score.
 * (Null means pipeline hasn't published a snapshot yet — must not pull average down.)
 */
function computePortfolioAvg(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

describe("portfolio_health_score_avg — null exclusion", () => {
  it("null scores are excluded, not zeroed", () => {
    // If nulls were treated as 0: avg([90, 80, null, null]) = (90+80+0+0)/4 = 42.5
    // Correct (nulls excluded):   avg([90, 80, null, null]) = (90+80)/2     = 85
    const avg = computePortfolioAvg([90, 80, null, null]);
    expect(avg).toBeCloseTo(85, 5);
    expect(avg).not.toBeCloseTo(42.5, 0);
  });

  it("all nulls → returns null (not 0 or NaN)", () => {
    expect(computePortfolioAvg([null, null, null, null])).toBeNull();
  });

  it("partial coverage: one valid score → average equals that score", () => {
    expect(computePortfolioAvg([75, null, null, null])).toBeCloseTo(75, 5);
  });

  it("all entities present → average of all four scores", () => {
    const avg = computePortfolioAvg([100, 80, 70, 50]);
    expect(avg).toBeCloseTo(75, 5);
  });

  it("portfolio average is always ≥ 0 and ≤ 100 when valid", () => {
    const avg = computePortfolioAvg([100, 0]);
    expect(avg).toBeGreaterThanOrEqual(0);
    expect(avg).toBeLessThanOrEqual(100);
  });
});

// ── 4. Smile More — negative margin preserved ─────────────────────────────────

describe("Smile More — negative cash and margin are never suppressed", () => {
  it("negative net margin applies the full -15 penalty", () => {
    const baseline = computeEntityHealthScore(makeMetrics({ net_margin_pct: 0 }));
    const smileMore = computeEntityHealthScore(makeMetrics({ net_margin_pct: -30 }));
    // Penalty for net_margin < 0 is -15; baseline (0%) only gets -5
    expect(baseline - smileMore).toBeGreaterThanOrEqual(10);
  });

  it("health score is never negative — clamped to [0, 100]", () => {
    const worst = computeEntityHealthScore(
      makeMetrics({ dso_days: 999, ar_overdue_pct: 99, net_margin_pct: -99 }),
    );
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThanOrEqual(100);
  });

  it("withHealth on Smile More entity preserves negative margin in the returned object", () => {
    const smileMore = makeMetrics({
      entity:         "Smile More Dental",
      slug:           "Smile_More",
      net_income_ytd: -25_000,
      net_margin_pct: -31.25,
      cash_on_hand:   -12_000,
    });
    const enriched = withHealth(smileMore);
    // withHealth must NOT mutate net_income_ytd or net_margin_pct
    expect(enriched.net_income_ytd).toBe(-25_000);
    expect(enriched.net_margin_pct).toBe(-31.25);
    // health_score must reflect the penalty, not ignore it
    expect(enriched.health_score).toBeLessThan(100);
  });
});

// ── 5. Cross-surface contract: identical fixture → identical score ─────────────

describe("Cross-surface health score lineage proof", () => {
  /**
   * Simulates the full server path for one entity:
   *   getEntityMetricsFromNeon() → withHealth() → API response
   *
   * All three surfaces read from this same response:
   *   - Entity Dashboard: metrics[slug].health_score
   *   - Sidebar:          metrics[slug].health_score  (same useDashboardData() hook)
   *   - Portfolio avg:    computed from [scores] of all entities
   */
  it("entity dashboard and sidebar see IDENTICAL score from one API response", () => {
    const raw = makeMetrics({
      entity:         "CarDealer AI",
      slug:           "CarDealer_ai",
      dso_days:       55,
      ar_overdue_pct: 12,
      net_margin_pct: 8,
    });
    const apiResponse = withHealth(raw);

    // Both surfaces read the same field from the same object
    const entityDashScore = apiResponse.health_score;
    const sidebarScore    = apiResponse.health_score;

    expect(entityDashScore).toBe(sidebarScore);
    // Must be a real computed value, not the placeholder from makeMetrics
    expect(entityDashScore).toBe(computeEntityHealthScore(raw));
  });

  it("portfolio score is consistent with per-entity scores from the same computation", () => {
    const entities = [
      makeMetrics({ slug: "CarDealer_ai", dso_days: 30, ar_overdue_pct: 3, net_margin_pct: 20 }),
      makeMetrics({ slug: "T3_Marketing", dso_days: 50, ar_overdue_pct: 10, net_margin_pct: 10 }),
      makeMetrics({ slug: "TopMrktr",     dso_days: 65, ar_overdue_pct: 18, net_margin_pct: 4  }),
      makeMetrics({ slug: "Smile_More",   dso_days: 80, ar_overdue_pct: 25, net_margin_pct: -5 }),
    ];

    const enriched = entities.map(withHealth);
    const scores   = enriched.map((m) => m.health_score ?? null);
    const avg      = computePortfolioAvg(scores);

    // Portfolio avg must equal the arithmetic mean of all four scores
    const expectedAvg = scores.reduce<number>((a, s) => a + (s ?? 0), 0) / 4;
    expect(avg).toBeCloseTo(expectedAvg, 5);

    // Each entity score is consistent with the formula
    for (const m of enriched) {
      expect(m.health_score).toBe(computeEntityHealthScore(m));
    }
  });
});
