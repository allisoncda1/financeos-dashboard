import { driveLoadCsv } from "../lib/driveLoader";
import type { EntitySlug, FinancialsData, MonthlyPL, BalanceSheet } from "../lib/types";
import { parseNumeric } from "../services/numerics";

function emptyBalanceSheet(asOf: string): BalanceSheet {
  return {
    as_of: asOf,
    assets: {
      cash: 0,
      accounts_receivable: 0,
      prepaid_expenses: 0,
      equipment_net: 0,
      total: 0,
    },
    liabilities: {
      accounts_payable: 0,
      accrued_liabilities: 0,
      deferred_revenue: 0,
      notes_payable: 0,
      total: 0,
    },
    equity: {
      paid_in_capital: 0,
      retained_earnings: 0,
      total: 0,
    },
  };
}

async function loadMonthlyPl(slug: EntitySlug): Promise<MonthlyPL[]> {
  try {
    const rows = await driveLoadCsv(`entities/${slug}/pnl_current.csv`);
    return rows.map((row) => ({
      month: row["month"] ?? "",
      revenue: parseNumeric(row["revenue"]),
      cogs: parseNumeric(row["cogs"]),
      gross_profit: parseNumeric(row["gross_profit"]),
      opex: parseNumeric(row["operating_expenses"]),
      net_income: parseNumeric(row["net_income"]),
    }));
  } catch (err) {
    console.warn(`[transformFinancials] failed to load pnl_current.csv for ${slug}:`, err);
    return [];
  }
}

/**
 * balance_sheet_current.csv is a QBO-style line-item export:
 * entity,report_date,account_name,account_type,account_subtype,section_path,amount
 * account_type is only "ASSETS" or "LIABILITIES AND EQUITY" — equity rows are
 * distinguished by account_subtype containing "equity". Totals are computed
 * by summing the individual line items (there is no explicit "total" row).
 */
type BalanceSheetCategory = "asset" | "liability" | "equity";

function classifyRow(accountType: string, subtype: string): BalanceSheetCategory {
  if (subtype.toLowerCase().includes("equity")) return "equity";
  if (accountType.trim().toUpperCase() === "ASSETS") return "asset";
  return "liability";
}

function mapAssetField(subtype: string): keyof BalanceSheet["assets"] {
  const normalized = subtype.toLowerCase();
  if (normalized.includes("bank")) return "cash";
  if (normalized.includes("receivable")) return "accounts_receivable";
  if (normalized.includes("fixed")) return "equipment_net";
  return "prepaid_expenses";
}

function mapLiabilityField(subtype: string): keyof BalanceSheet["liabilities"] {
  const normalized = subtype.toLowerCase();
  if (normalized.includes("accounts payable")) return "accounts_payable";
  if (normalized.includes("long term")) return "notes_payable";
  if (normalized.includes("deferred")) return "deferred_revenue";
  return "accrued_liabilities";
}

function mapEquityField(accountName: string): keyof BalanceSheet["equity"] {
  const normalized = accountName.toLowerCase();
  if (normalized.includes("retained") || normalized.includes("net income")) return "retained_earnings";
  return "paid_in_capital";
}

async function loadBalanceSheet(slug: EntitySlug, asOf: string): Promise<BalanceSheet> {
  const sheet = emptyBalanceSheet(asOf);
  try {
    const rows = await driveLoadCsv(`entities/${slug}/balance_sheet_current.csv`);
    for (const row of rows) {
      const accountName = row["account_name"] ?? "";
      const accountType = row["account_type"] ?? "";
      const subtype = row["account_subtype"] ?? "";
      const amount = parseNumeric(row["amount"]);
      const category = classifyRow(accountType, subtype);

      if (category === "asset") {
        const field = mapAssetField(subtype);
        sheet.assets[field] += amount;
        sheet.assets.total += amount;
      } else if (category === "liability") {
        const field = mapLiabilityField(subtype);
        sheet.liabilities[field] += amount;
        sheet.liabilities.total += amount;
      } else {
        const field = mapEquityField(accountName);
        sheet.equity[field] += amount;
        sheet.equity.total += amount;
      }
    }
  } catch (err) {
    console.warn(`[transformFinancials] failed to load balance_sheet_current.csv for ${slug}:`, err);
  }
  return sheet;
}

export async function transformFinancials(slug: EntitySlug, asOf: string): Promise<FinancialsData> {
  const [monthly_pl, balance_sheet] = await Promise.all([
    loadMonthlyPl(slug),
    loadBalanceSheet(slug, asOf),
  ]);

  const ytd_summary = monthly_pl.reduce(
    (acc, month) => ({
      revenue: acc.revenue + month.revenue,
      cogs: acc.cogs + month.cogs,
      gross_profit: acc.gross_profit + month.gross_profit,
      opex: acc.opex + month.opex,
      net_income: acc.net_income + month.net_income,
    }),
    { revenue: 0, cogs: 0, gross_profit: 0, opex: 0, net_income: 0 },
  );

  return {
    entity_slug: slug,
    as_of: asOf,
    monthly_pl,
    ytd_summary,
    balance_sheet,
  };
}
