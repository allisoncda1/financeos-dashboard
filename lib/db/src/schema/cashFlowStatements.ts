import { pgTable, uuid, text, date, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Parsed QBO Cash Flow statements, written by financeos_core build_semantic_layer.py.
 * Read-only from the Dashboard's perspective (CORE_DATABASE_URL).
 *
 * `sections` stores the full CashFlowStatement JSON matching the TypeScript type:
 *   { as_of, sections: [{name, lines: [{label, amount, is_subtotal}], net_cash}],
 *     net_cash_change, cash_at_end }
 *
 * Query pattern: latest statement per entity →
 *   SELECT * FROM cash_flow_statements
 *   WHERE entity_id = $1 ORDER BY period_end DESC LIMIT 1
 */
export const cashFlowStatementsTable = pgTable("cash_flow_statements", {
  id:           uuid("id").primaryKey().defaultRandom(),
  entityId:     uuid("entity_id").notNull(),
  periodStart:  date("period_start").notNull(),
  periodEnd:    date("period_end").notNull(),
  qboId:        text("qbo_id").notNull(),
  netOperating: numeric("net_operating"),
  netInvesting: numeric("net_investing"),
  netFinancing: numeric("net_financing"),
  netChange:    numeric("net_change"),
  cashAtEnd:    numeric("cash_at_end"),
  sections:     jsonb("sections").notNull(),
  fetchedAt:    timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  syncRunId:    uuid("sync_run_id"),
});

export type CashFlowStatementRow = typeof cashFlowStatementsTable.$inferSelect;
