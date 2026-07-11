import { pgTable, uuid, text, date, numeric, timestamp } from "drizzle-orm/pg-core";

/**
 * Historical financial periods computed by FinanceOS Core. Read-only from the
 * Dashboard's perspective. `period_type` is one of: monthly | quarterly | ytd
 * | annual. Numeric columns are Postgres NUMERIC and surface as strings via
 * Drizzle — parse before arithmetic.
 */
export const financialPeriodsTable = pgTable("financial_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  periodType: text("period_type").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  revenue: numeric("revenue"),
  cogs: numeric("cogs"),
  grossProfit: numeric("gross_profit"),
  opex: numeric("opex"),
  netIncome: numeric("net_income"),
  grossMarginPct: numeric("gross_margin_pct"),
  netMarginPct: numeric("net_margin_pct"),
  totalAssets: numeric("total_assets"),
  totalLiabilities: numeric("total_liabilities"),
  totalEquity: numeric("total_equity"),
  cashOnHand: numeric("cash_on_hand"),
  accountsReceivable: numeric("accounts_receivable"),
  accountsPayable: numeric("accounts_payable"),
  openAr: numeric("open_ar"),
  openAp: numeric("open_ap"),
  dsoDays: numeric("dso_days"),
  dpoDays: numeric("dpo_days"),
  arOverduePct: numeric("ar_overdue_pct"),
  apOverduePct: numeric("ap_overdue_pct"),
  computedFrom: text("computed_from"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FinancialPeriodRow = typeof financialPeriodsTable.$inferSelect;
