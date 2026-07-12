import { FinancialPeriodsService } from "../db";
import { getCurrentSnapshot } from "../db/snapshots";
import { getCachedEntityId } from "../services/entityCache";
import type { EntitySlug, FinancialsData, MonthlyPL, BalanceSheet } from "../lib/types";

export async function transformFinancialsNeon(slug: EntitySlug, asOf: string): Promise<FinancialsData> {
  const entityId = await getCachedEntityId(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const year = new Date(asOf).getFullYear();
  const [monthlyRows, ytdRow, snapshot] = await Promise.all([
    FinancialPeriodsService.getMonthlyPeriods(entityId, year),
    FinancialPeriodsService.getYtdPeriod(entityId, year),
    getCurrentSnapshot(entityId),
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
  const semanticFinancials = snapshot?.financials as Record<string, unknown> | null;
  const semanticBs = semanticFinancials?.balance_sheet as Record<string, unknown> | undefined;
  if (!semanticBs) {
    throw new Error(`Current semantic snapshot has no Balance Sheet detail for ${slug}`);
  }
  const semanticAssets = semanticBs.assets as Record<string, unknown> | undefined;
  const semanticLiabilities = semanticBs.liabilities as Record<string, unknown> | undefined;
  const semanticEquity = semanticBs.equity as Record<string, unknown> | undefined;
  if (!semanticAssets || !semanticLiabilities || !semanticEquity) {
    throw new Error(`Current semantic snapshot has malformed Balance Sheet detail for ${slug}`);
  }
  const numeric = (value: unknown, field: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} in semantic snapshot for ${slug}`);
    return parsed;
  };

  const prepaidExpenses = numeric(semanticAssets.prepaid_expenses, "prepaid_expenses");
  const accruedLiabilities = numeric(semanticLiabilities.accrued_liabilities, "accrued_liabilities");
  const deferredRevenue = numeric(semanticLiabilities.deferred_revenue, "deferred_revenue");
  const paidInCapital = numeric(semanticEquity.paid_in_capital, "paid_in_capital");
  const otherAssets = bs.totalAssets - bs.cashOnHand - bs.accountsReceivable - prepaidExpenses;
  const otherLiabilities = bs.totalLiabilities - bs.accountsPayable - accruedLiabilities - deferredRevenue;

  const balance_sheet: BalanceSheet = {
    as_of: bs.periodEnd ?? asOf,
    assets: {
      cash:                bs.cashOnHand,
      accounts_receivable: bs.accountsReceivable,
      prepaid_expenses:    prepaidExpenses,
      equipment_net:       otherAssets,
      total:               bs.totalAssets,
    },
    liabilities: {
      accounts_payable:    bs.accountsPayable,
      accrued_liabilities: accruedLiabilities,
      deferred_revenue:    deferredRevenue,
      notes_payable:       otherLiabilities,
      total:               bs.totalLiabilities,
    },
    equity: {
      paid_in_capital:  paidInCapital,
      retained_earnings: bs.totalEquity - paidInCapital,
      total:            bs.totalEquity,
    },
  };

  return { entity_slug: slug, as_of: asOf, monthly_pl, ytd_summary, balance_sheet, cash_flow: null };
}
