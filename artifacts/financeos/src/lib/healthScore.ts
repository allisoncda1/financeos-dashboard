// FinanceOS — Company Health Score (entity dashboard only)
//
// A deterministic, real-data-only financial health score for a single entity.
// It is a weighted average of category sub-scores, each mapped from a real
// backend field onto a 0–100 band. Categories whose inputs are unavailable are
// EXCLUDED (not defaulted to 0) and the remaining weights are re-normalized, so
// the score never fabricates or penalizes for missing data.
//
// This is intentionally separate from `briefing.ts#computeHealthScore` (the
// compact portfolio/sidebar badge): this one exposes a per-category breakdown
// and uses a broader input set. No other financial calculation is changed.

import type { EntityMetrics, MonthlyPL } from "./types";

export type HealthCategoryKey =
  | "profitability"
  | "grossMargin"
  | "liquidity"
  | "cashPosition"
  | "arApQuality"
  | "growth"
  | "validation";

export type HealthCategoryState = "strong" | "fair" | "weak";

export type HealthCategory = {
  key: HealthCategoryKey;
  label: string;
  score: number; // 0–100
  weight: number; // base weight (pre-normalization)
  state: HealthCategoryState;
  detail: string; // human-readable source value, e.g. "Net margin 12.4%"
};

export type HealthExclusion = {
  key: HealthCategoryKey;
  label: string;
  reason: string;
};

export type HealthRating = "Excellent" | "Good" | "Fair" | "At Risk" | "Critical";

export type CompanyHealth = {
  score: number | null; // null when nothing is computable
  rating: HealthRating | null;
  categories: HealthCategory[]; // included (computable) categories, weight-desc
  excluded: HealthExclusion[]; // categories skipped for lack of real data
};

export type HealthInputs = {
  metrics: EntityMetrics;
  monthlyPL: MonthlyPL[] | null;
  validation: { passed: number | null; totalChecks: number | null };
};

const WEIGHTS: Record<HealthCategoryKey, number> = {
  profitability: 0.22,
  grossMargin: 0.15,
  liquidity: 0.15,
  cashPosition: 0.15,
  arApQuality: 0.13,
  growth: 0.12,
  validation: 0.08,
};

const LABELS: Record<HealthCategoryKey, string> = {
  profitability: "Profitability",
  grossMargin: "Gross Margin",
  liquidity: "Liquidity",
  cashPosition: "Cash Position",
  arApQuality: "AR / AP Quality",
  growth: "Revenue Growth",
  validation: "Validation",
};

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Linearly map `value` from [zeroAt..hundredAt] onto [0..100] (clamped). */
function band(value: number, zeroAt: number, hundredAt: number): number {
  if (hundredAt === zeroAt) return 0;
  return clamp(((value - zeroAt) / (hundredAt - zeroAt)) * 100);
}

function stateFor(score: number): HealthCategoryState {
  if (score >= 70) return "strong";
  if (score >= 45) return "fair";
  return "weak";
}

function ratingFor(score: number): HealthRating {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Fair";
  if (score >= 40) return "At Risk";
  return "Critical";
}

export function computeCompanyHealth(inputs: HealthInputs): CompanyHealth {
  const { metrics: m, monthlyPL, validation } = inputs;
  const cats: HealthCategory[] = [];
  const excluded: HealthExclusion[] = [];

  const add = (key: HealthCategoryKey, score: number, detail: string) => {
    cats.push({ key, label: LABELS[key], score, weight: WEIGHTS[key], state: stateFor(score), detail });
  };
  const skip = (key: HealthCategoryKey, reason: string) => {
    excluded.push({ key, label: LABELS[key], reason });
  };

  // 1 — Profitability (net margin: -10% → 0, +20% → 100)
  add("profitability", band(m.net_margin_pct, -10, 20), `Net margin ${m.net_margin_pct.toFixed(1)}%`);

  // 2 — Gross Margin (10% → 0, 55% → 100)
  add("grossMargin", band(m.gross_margin_pct, 10, 55), `Gross margin ${m.gross_margin_pct.toFixed(1)}%`);

  // 3 — Liquidity: (cash + AR) coverage of AP (0.5× → 0, 2.5× → 100)
  if (m.open_ap > 0) {
    const coverage = (m.cash_on_hand + m.open_ar) / m.open_ap;
    add("liquidity", band(coverage, 0.5, 2.5), `Covers AP ${coverage.toFixed(1)}×`);
  } else {
    skip("liquidity", "No open AP to measure against");
  }

  // 4 — Cash Position: runway months = cash / monthly burn (1 mo → 0, 6 mo → 100)
  const months = monthlyPL?.length ?? 0;
  const burn = months > 0 ? m.opex_ytd / months : 0;
  if (burn > 0) {
    const runway = m.cash_on_hand / burn;
    add("cashPosition", band(runway, 1, 6), `${runway.toFixed(1)} mo runway`);
  } else {
    skip("cashPosition", "No monthly P&L to derive burn rate");
  }

  // 5 — AR / AP Quality: overdue % (60%) + DSO (40%)
  const overdueScore = clamp(100 - (m.ar_overdue_pct + m.ap_overdue_pct));
  const dsoScore = band(m.dso_days, 90, 20); // lower DSO is better
  add(
    "arApQuality",
    0.6 * overdueScore + 0.4 * dsoScore,
    `${m.ar_overdue_pct.toFixed(0)}% AR / ${m.ap_overdue_pct.toFixed(0)}% AP overdue · DSO ${m.dso_days}d`,
  );

  // 6 — Revenue Growth: 2nd-half vs 1st-half avg revenue (-15% → 0, +25% → 100)
  if (monthlyPL && monthlyPL.length >= 2) {
    const mid = Math.floor(monthlyPL.length / 2);
    const first = monthlyPL.slice(0, mid);
    const second = monthlyPL.slice(mid);
    const avg = (rows: MonthlyPL[]) => rows.reduce((s, r) => s + r.revenue, 0) / rows.length;
    const firstAvg = avg(first);
    const secondAvg = avg(second);
    if (firstAvg > 0) {
      const growthPct = ((secondAvg - firstAvg) / firstAvg) * 100;
      add("growth", band(growthPct, -15, 25), `${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}% vs early period`);
    } else {
      skip("growth", "No positive base-period revenue");
    }
  } else {
    skip("growth", "Fewer than 2 months of P&L");
  }

  // 7 — Validation (small weight): pass rate
  if (validation.totalChecks != null && validation.totalChecks > 0 && validation.passed != null) {
    const pass = (validation.passed / validation.totalChecks) * 100;
    add("validation", clamp(pass), `${validation.passed}/${validation.totalChecks} checks passed`);
  } else {
    skip("validation", "Validation not reported");
  }

  // Weighted average over included categories, re-normalizing their weights.
  const totalWeight = cats.reduce((s, c) => s + c.weight, 0);
  const score = totalWeight > 0 ? Math.round(cats.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight) : null;

  cats.sort((a, b) => b.weight - a.weight);

  return {
    score,
    rating: score === null ? null : ratingFor(score),
    categories: cats,
    excluded,
  };
}
