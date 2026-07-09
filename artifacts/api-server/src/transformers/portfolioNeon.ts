import { EntitiesService, FinancialPeriodsService } from "../db";
import { ENTITY_DEFINITIONS } from "../lib/entities";
import { ENTITY_SLUGS } from "../lib/types";
import type { PortfolioSummary } from "../lib/types";

/**
 * Build PortfolioSummary entirely from Neon typed tables.
 * Source: financial_periods aggregated across all portfolio entities.
 * Throws when no entities are found or no YTD data exists — callers
 * fall through to the Drive/mock chain.
 */
export async function transformPortfolioNeon(): Promise<PortfolioSummary> {
  const year = new Date().getFullYear();

  // Resolve all entity IDs in parallel
  const pairs = await Promise.all(
    ENTITY_SLUGS.map(async (slug) => {
      const id = await EntitiesService.getEntityIdBySlug(slug);
      return { slug, id };
    }),
  );

  const validPairs = pairs.filter((p): p is { slug: typeof p.slug; id: string } => p.id !== null);
  if (validPairs.length === 0) throw new Error("No entities found in Neon for portfolio aggregation");

  const entityIds = validPairs.map((p) => p.id);

  // Aggregate YTD across all entities + get as_of from the most recent period
  const [agg, latestPeriod] = await Promise.all([
    FinancialPeriodsService.getPortfolioYtd(entityIds, year),
    FinancialPeriodsService.getLatestPeriod(entityIds[0]!),
  ]);

  if (!agg) throw new Error(`No portfolio YTD data in Neon for year=${year}`);

  const asOf = latestPeriod?.periodEnd ?? new Date().toISOString().slice(0, 10);

  const netMarginPct =
    Number.isFinite(agg.netIncome) && Number.isFinite(agg.revenue) && agg.revenue > 0
      ? (agg.netIncome / agg.revenue) * 100
      : NaN;

  const cashRunwayMonths = (() => {
    if (!Number.isFinite(agg.cashOnHand) || agg.cashOnHand <= 0) return null;
    if (!Number.isFinite(agg.opex) || agg.opex <= 0) return null;
    const monthsElapsed = new Date().getMonth() + 1;
    const monthlyOpex = agg.opex / monthsElapsed;
    if (!Number.isFinite(monthlyOpex) || monthlyOpex <= 0) return null;
    return agg.cashOnHand / monthlyOpex;
  })();

  const portfolioDefs = ENTITY_DEFINITIONS.filter((e) => e.includedInPortfolio);

  return {
    as_of: asOf,
    pipeline_run: new Date().toISOString(),
    entities: portfolioDefs.map((e) => e.displayName),
    entity_count: agg.entityCount,
    portfolio_revenue_ytd: agg.revenue,
    portfolio_cogs_ytd: agg.cogs,
    portfolio_gross_profit_ytd: agg.grossProfit,
    portfolio_opex_ytd: agg.opex,
    portfolio_net_income_ytd: agg.netIncome,
    portfolio_net_margin_pct: netMarginPct,
    portfolio_open_ar: agg.openAr,
    portfolio_open_ap: agg.openAp,
    portfolio_cash_on_hand: agg.cashOnHand,
    cash_runway_months: cashRunwayMonths,
  };
}
