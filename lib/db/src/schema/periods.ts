import { pgTable, uuid, text, date, timestamp, numeric, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";

export const financialPeriods = pgTable("financial_periods", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  entityId:            uuid("entity_id").notNull().references(() => entities.id),
  periodType:          text("period_type").notNull(),
  periodStart:         date("period_start").notNull(),
  periodEnd:           date("period_end").notNull(),

  // P&L
  revenue:             numeric("revenue", { precision: 18, scale: 2 }).default("0"),
  cogs:                numeric("cogs", { precision: 18, scale: 2 }).default("0"),
  grossProfit:         numeric("gross_profit", { precision: 18, scale: 2 }).default("0"),
  opex:                numeric("opex", { precision: 18, scale: 2 }).default("0"),
  netIncome:           numeric("net_income", { precision: 18, scale: 2 }).default("0"),
  grossMarginPct:      numeric("gross_margin_pct", { precision: 8, scale: 4 }).default("0"),
  netMarginPct:        numeric("net_margin_pct", { precision: 8, scale: 4 }).default("0"),

  // Balance Sheet
  totalAssets:         numeric("total_assets", { precision: 18, scale: 2 }).default("0"),
  totalLiabilities:    numeric("total_liabilities", { precision: 18, scale: 2 }).default("0"),
  totalEquity:         numeric("total_equity", { precision: 18, scale: 2 }).default("0"),
  cashOnHand:          numeric("cash_on_hand", { precision: 18, scale: 2 }).default("0"),
  accountsReceivable:  numeric("accounts_receivable", { precision: 18, scale: 2 }).default("0"),
  accountsPayable:     numeric("accounts_payable", { precision: 18, scale: 2 }).default("0"),

  // AR / AP Metrics
  openAr:              numeric("open_ar", { precision: 18, scale: 2 }).default("0"),
  openAp:              numeric("open_ap", { precision: 18, scale: 2 }).default("0"),
  dsoDays:             numeric("dso_days", { precision: 8, scale: 2 }).default("0"),
  dpoDays:             numeric("dpo_days", { precision: 8, scale: 2 }).default("0"),
  arOverduePct:        numeric("ar_overdue_pct", { precision: 8, scale: 4 }).default("0"),
  apOverduePct:        numeric("ap_overdue_pct", { precision: 8, scale: 4 }).default("0"),

  computedFrom:        text("computed_from").default("qbo_report"),
  generatedAt:         timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_financial_periods_entity_type_start").on(t.entityId, t.periodType, t.periodStart),
  index("idx_financial_periods_entity").on(t.entityId, t.periodType, t.periodStart),
]);

export type FinancialPeriod = typeof financialPeriods.$inferSelect;
export type InsertFinancialPeriod = typeof financialPeriods.$inferInsert;
