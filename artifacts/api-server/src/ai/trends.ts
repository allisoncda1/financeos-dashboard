/**
 * AI CFO Briefing Engine — Trend primitives.
 *
 * Deterministic, pure functions. No LLM, no network calls.
 *
 * IMPORTANT DATA NOTE: FinanceOS currently exposes only a *current snapshot*
 * of portfolio/entity metrics (portfolio/summary.json, entities/*\/metrics.json)
 * — there is no prior-period time series available from these sources. Where
 * the spec asks for a "trend" that would normally require period-over-period
 * comparison, we derive an honest, data-grounded proxy from the current
 * snapshot (e.g. profitability posture, liquidity coverage) instead of
 * fabricating a fake historical delta. Every number used is real.
 */

import type { EntityMetrics, EntitySlug, PortfolioSummary } from "../lib/types";
import { num } from "./format";

export type TrendDirection = "up" | "down" | "flat";

export type EntityMetricPoint = {
  slug: EntitySlug;
  entity: string;
  value: number;
};

function entries(metrics: Record<EntitySlug, EntityMetrics>): EntityMetrics[] {
  return Object.values(metrics);
}

/**
 * getRevenueChange — no prior-period revenue series exists, so we derive
 * direction from portfolio profitability (net margin) and express `pct` as
 * the real, revenue-weighted average net margin across entities — a genuine
 * number that reflects whether the portfolio's revenue is converting to
 * profit, which is the closest honest proxy for "revenue momentum" available
 * from the current data model.
 */
export function getRevenueChange(
  metrics: Record<EntitySlug, EntityMetrics>,
  portfolio: PortfolioSummary,
): { pct: number; direction: TrendDirection } {
  const list = entries(metrics);
  const totalRevenue = list.reduce((sum, m) => sum + num(m.revenue_ytd), 0) || num(portfolio.portfolio_revenue_ytd);
  const weightedMargin =
    totalRevenue > 0
      ? list.reduce((sum, m) => sum + num(m.net_margin_pct) * num(m.revenue_ytd), 0) / totalRevenue
      : num(portfolio.portfolio_net_margin_pct);

  const pct = Math.round(weightedMargin * 10) / 10;
  let direction: TrendDirection = "flat";
  if (pct > 5) direction = "up";
  else if (pct < 0) direction = "down";

  return { pct, direction };
}

/**
 * getCashTrend — aggregates cash_on_hand across entities. Direction reflects
 * liquidity coverage (cash relative to open payables) since no historical
 * cash series exists.
 */
export function getCashTrend(metrics: Record<EntitySlug, EntityMetrics>): {
  totalCash: number;
  direction: TrendDirection;
} {
  const list = entries(metrics);
  const totalCash = list.reduce((sum, m) => sum + num(m.cash_on_hand), 0);
  const totalAp = list.reduce((sum, m) => sum + num(m.open_ap), 0);

  let direction: TrendDirection = "flat";
  if (totalAp === 0) {
    direction = totalCash > 0 ? "up" : "flat";
  } else if (totalCash > totalAp * 2) {
    direction = "up";
  } else if (totalCash < totalAp) {
    direction = "down";
  }

  return { totalCash, direction };
}

/** getMarginTrend — revenue-weighted average net margin across entities. */
export function getMarginTrend(metrics: Record<EntitySlug, EntityMetrics>): number {
  const list = entries(metrics);
  const totalRevenue = list.reduce((sum, m) => sum + num(m.revenue_ytd), 0);
  if (totalRevenue === 0) return 0;
  const weighted = list.reduce((sum, m) => sum + num(m.net_margin_pct) * num(m.revenue_ytd), 0) / totalRevenue;
  return Math.round(weighted * 10) / 10;
}

/** getHighestGrowthEntity — entity with the highest revenue_ytd. */
export function getHighestGrowthEntity(metrics: Record<EntitySlug, EntityMetrics>): EntityMetricPoint | null {
  const list = entries(metrics);
  if (list.length === 0) return null;
  const top = list.reduce((best, m) => (num(m.revenue_ytd) > num(best.revenue_ytd) ? m : best), list[0]);
  return { slug: top.slug, entity: top.entity, value: num(top.revenue_ytd) };
}

/** getLowestMarginEntity — entity with the lowest net_margin_pct, when that field is known for at least one entity. */
export function getLowestMarginEntity(metrics: Record<EntitySlug, EntityMetrics>): EntityMetricPoint | null {
  const list = entries(metrics).filter((m) => typeof m.net_margin_pct === "number" && Number.isFinite(m.net_margin_pct));
  if (list.length === 0) return null;
  const lowest = list.reduce((worst, m) => (m.net_margin_pct < worst.net_margin_pct ? m : worst), list[0]);
  return { slug: lowest.slug, entity: lowest.entity, value: lowest.net_margin_pct };
}

/**
 * getLargestOverdueAR — entity with the highest *dollar amount* of overdue
 * receivables (open_ar × ar_overdue_pct), combining both signals as specified.
 */
export function getLargestOverdueAR(
  metrics: Record<EntitySlug, EntityMetrics>,
): (EntityMetricPoint & { openAr: number; overduePct: number }) | null {
  const list = entries(metrics);
  if (list.length === 0) return null;
  let best = list[0];
  let bestAmount = (num(best.open_ar) * num(best.ar_overdue_pct)) / 100;
  for (const m of list.slice(1)) {
    const amount = (num(m.open_ar) * num(m.ar_overdue_pct)) / 100;
    if (amount > bestAmount) {
      best = m;
      bestAmount = amount;
    }
  }
  return {
    slug: best.slug,
    entity: best.entity,
    value: Math.round(bestAmount),
    openAr: num(best.open_ar),
    overduePct: num(best.ar_overdue_pct),
  };
}

/** getLargestVendorExposure — entity with the highest open_ap. */
export function getLargestVendorExposure(metrics: Record<EntitySlug, EntityMetrics>): EntityMetricPoint | null {
  const list = entries(metrics);
  if (list.length === 0) return null;
  const top = list.reduce((best, m) => (num(m.open_ap) > num(best.open_ap) ? m : best), list[0]);
  return { slug: top.slug, entity: top.entity, value: num(top.open_ap) };
}
