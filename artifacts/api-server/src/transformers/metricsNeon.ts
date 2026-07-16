import { FinancialPeriodsService, SyncRunsService } from "../db";
import { getCachedEntityId } from "../services/entityCache";
import { ENTITY_DEFINITIONS } from "../lib/entities";
import type { EntitySlug, EntityMetrics } from "../lib/types";

/**
 * Build EntityMetrics entirely from Neon typed tables.
 * Source: financial_periods (YTD row) + sync_runs (pipeline timestamp).
 * Throws when the entity is not seeded or has no YTD period — callers
 * fall through to the Drive/mock chain.
 */
export async function transformMetricsNeon(slug: EntitySlug): Promise<EntityMetrics> {
  const entityId = await getCachedEntityId(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const year = new Date().getFullYear();
  const [ytdRow, lastRun] = await Promise.all([
    FinancialPeriodsService.getYtdPeriod(entityId, year),
    SyncRunsService.getLastSuccessfulRun(entityId),
  ]);

  if (!ytdRow) throw new Error(`No YTD financial period in Neon for ${slug} year=${year}`);

  const def = ENTITY_DEFINITIONS.find((e) => e.slug === slug);
  const asOf = ytdRow.periodEnd;
  // Never fabricate a "just now" sync timestamp. If no successful automated
  // sync exists, the financial period's generated_at is the honest fallback.
  const pipelineRun = lastRun?.completedAt?.toISOString() ?? ytdRow.generatedAt.toISOString();

  const revenueYtd    = ytdRow.revenue;
  const grossProfitYtd = ytdRow.grossProfit;
  const netIncomeYtd  = ytdRow.netIncome;
  const openAr        = ytdRow.openAr;
  const openAp        = ytdRow.openAp;

  return {
    entity:           def?.displayName ?? slug,
    slug,
    basis:            def?.accountingBasis ?? "Accrual",
    as_of:            asOf,
    pipeline_run:     pipelineRun,
    revenue_ytd:      revenueYtd,
    cogs_ytd:         ytdRow.cogs,
    gross_profit_ytd: grossProfitYtd,
    gross_margin_pct: ytdRow.grossMarginPct,
    opex_ytd:         ytdRow.opex,
    net_income_ytd:   netIncomeYtd,
    net_margin_pct:   ytdRow.netMarginPct,
    total_assets:     ytdRow.totalAssets,
    total_liabilities: ytdRow.totalLiabilities,
    total_equity:     ytdRow.totalEquity,
    open_ar:          openAr,
    open_ap:          openAp,
    dso_days:         ytdRow.dsoDays,
    dso_days_standard: null,
    weighted_average_days_overdue: null,
    dpo_days:         ytdRow.dpoDays,
    cash_on_hand:     ytdRow.cashOnHand,
    ar_overdue_pct:   ytdRow.arOverduePct,
    ap_overdue_pct:   ytdRow.apOverduePct,
  };
}
