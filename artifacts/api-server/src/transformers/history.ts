import { driveLoadCsv } from "../lib/driveLoader";
import { parseBalanceSheetRows } from "./financials";
import type {
  EntitySlug,
  EntityHistoryData,
  PriorYearHistory,
  PriorYearBalanceSheetSummary,
  MonthlyPL,
} from "../lib/types";

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * pnl_prior_year.csv is a line-item export (unlike pnl_current.csv, which is
 * already aggregated by month):
 *   entity,fiscal_year,month,account_name,account_type,amount
 * account_type values seen in real files: Income, Other Income,
 * Cost of Goods Sold, Expenses, Other Expenses.
 *
 * Aggregation matches the semantics of the current-year monthly P&L:
 *   revenue      = Income + Other Income
 *   cogs         = Cost of Goods Sold
 *   gross_profit = revenue - cogs
 *   opex         = Expenses + Other Expenses
 *   net_income   = gross_profit - opex
 */
function aggregatePriorYearPl(
  rows: Record<string, string>[],
): Map<number, Map<string, MonthlyPL>> {
  const byYear = new Map<number, Map<string, MonthlyPL>>();

  for (const row of rows) {
    const fiscalYear = Number.parseInt(row["fiscal_year"] ?? "", 10);
    const month = (row["month"] ?? "").trim();
    if (!Number.isFinite(fiscalYear) || month === "") continue;

    let byMonth = byYear.get(fiscalYear);
    if (!byMonth) {
      byMonth = new Map();
      byYear.set(fiscalYear, byMonth);
    }
    let pl = byMonth.get(month);
    if (!pl) {
      pl = { month, revenue: 0, cogs: 0, gross_profit: 0, opex: 0, net_income: 0 };
      byMonth.set(month, pl);
    }

    const accountType = (row["account_type"] ?? "").trim().toLowerCase();
    const amount = toNumber(row["amount"]);
    if (accountType === "income" || accountType === "other income") {
      pl.revenue += amount;
    } else if (accountType === "cost of goods sold") {
      pl.cogs += amount;
    } else if (accountType === "expenses" || accountType === "other expenses") {
      pl.opex += amount;
    }
  }

  for (const byMonth of byYear.values()) {
    for (const pl of byMonth.values()) {
      pl.gross_profit = pl.revenue - pl.cogs;
      pl.net_income = pl.gross_profit - pl.opex;
    }
  }

  return byYear;
}

/**
 * balance_sheet_prior_year.csv has the same line-item shape as
 * balance_sheet_current.csv plus fiscal_year/report_date columns:
 *   entity,report_date,fiscal_year,account_name,account_type,account_subtype,section_path,amount
 */
function summarizePriorYearBalanceSheet(
  rows: Record<string, string>[],
  fiscalYear: number,
): PriorYearBalanceSheetSummary | null {
  const yearRows = rows.filter(
    (row) => Number.parseInt(row["fiscal_year"] ?? "", 10) === fiscalYear,
  );
  if (yearRows.length === 0) return null;

  const reportDate = (yearRows[0]?.["report_date"] ?? `${fiscalYear}-12-31`).trim();
  const sheet = parseBalanceSheetRows(yearRows, reportDate);
  return {
    as_of: reportDate,
    cash: sheet.assets.cash,
    total_assets: sheet.assets.total,
    total_liabilities: sheet.liabilities.total,
    total_equity: sheet.equity.total,
  };
}

export async function transformHistory(slug: EntitySlug): Promise<EntityHistoryData> {
  const plRows = await driveLoadCsv(`entities/${slug}/pnl_prior_year.csv`);

  let bsRows: Record<string, string>[] = [];
  try {
    bsRows = await driveLoadCsv(`entities/${slug}/balance_sheet_prior_year.csv`);
  } catch (err) {
    console.warn(`[transformHistory] failed to load balance_sheet_prior_year.csv for ${slug}:`, err);
  }

  const byYear = aggregatePriorYearPl(plRows);
  const priorYears: PriorYearHistory[] = [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([fiscalYear, byMonth]) => {
      const monthlyPl = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
      const summary = monthlyPl.reduce(
        (acc, m) => ({
          revenue: acc.revenue + m.revenue,
          cogs: acc.cogs + m.cogs,
          gross_profit: acc.gross_profit + m.gross_profit,
          opex: acc.opex + m.opex,
          net_income: acc.net_income + m.net_income,
        }),
        { revenue: 0, cogs: 0, gross_profit: 0, opex: 0, net_income: 0 },
      );
      return {
        fiscal_year: fiscalYear,
        monthly_pl: monthlyPl,
        summary,
        balance_sheet: summarizePriorYearBalanceSheet(bsRows, fiscalYear),
      };
    });

  return { entity_slug: slug, prior_years: priorYears };
}
