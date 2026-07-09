import { FinancialPeriodsService } from "../db";
import { getCachedEntityId } from "../services/entityCache";
import type { EntitySlug, FinancialsData, MonthlyPL, BalanceSheet } from "../lib/types";

export async function transformFinancialsNeon(slug: EntitySlug, asOf: string): Promise<FinancialsData> {
  const entityId = await getCachedEntityId(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const year = new Date(asOf).getFullYear();
  const [monthlyRows, ytdRow] = await Promise.all([
    FinancialPeriodsService.getMonthlyPeriods(entityId, year),
    FinancialPeriodsService.getYtdPeriod(entityId, year),
  ]);

  // If Neon has no period data at all, let Drive/mock handle it
  if (monthlyRows.length === 0 && ytdRow === null) {
    throw new Error(`No financial periods in Neon for ${slug} year=${year}`);
  }

  const monthly_pl: MonthlyPL[] = monthlyRows.map((r) => ({
    month: r.periodStart.slice(0, 7),
    revenue: r.revenue,
    cogs: r.cogs,
    gross_profit: r.grossProfit,
    opex: r.opex,
    net_income: r.netIncome,
  }));

  // YTD summary: prefer dedicated ytd row; fall back to aggregated monthly
  const ytd = ytdRow ?? monthlyRows[monthlyRows.length - 1]!;
  const ytd_summary = {
    revenue:      ytd.revenue,
    cogs:         ytd.cogs,
    gross_profit: ytd.grossProfit,
    opex:         ytd.opex,
    net_income:   ytd.netIncome,
  };

  // Balance sheet: point-in-time from the ytd row (or last month as fallback)
  const bs = ytdRow ?? monthlyRows[monthlyRows.length - 1]!;
  const otherAssets = Math.max(0, bs.totalAssets - bs.cashOnHand - bs.accountsReceivable);
  const otherLiabilities = Math.max(0, bs.totalLiabilities - bs.accountsPayable);

  const balance_sheet: BalanceSheet = {
    as_of: bs.periodEnd ?? asOf,
    assets: {
      cash:                bs.cashOnHand,
      accounts_receivable: bs.accountsReceivable,
      prepaid_expenses:    0,
      equipment_net:       otherAssets,
      total:               bs.totalAssets,
    },
    liabilities: {
      accounts_payable:    bs.accountsPayable,
      accrued_liabilities: 0,
      deferred_revenue:    0,
      notes_payable:       otherLiabilities,
      total:               bs.totalLiabilities,
    },
    equity: {
      paid_in_capital:  0,
      retained_earnings: bs.totalEquity,
      total:            bs.totalEquity,
    },
  };

  return { entity_slug: slug, as_of: asOf, monthly_pl, ytd_summary, balance_sheet };
}
