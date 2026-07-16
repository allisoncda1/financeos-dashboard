/**
 * Parsed QBO Cash Flow statements, written by financeos_core build_semantic_layer.py.
 * Read-only from the Dashboard's perspective (CORE_DATABASE_URL).
 *
 * `sections` stores the full CashFlowStatement JSON matching the TypeScript type:
 *   { as_of, sections: [{name, lines: [{label, amount, is_subtotal}], net_cash}],
 *     net_cash_change, cash_at_end }
 *
 * IMPORTANT: Dashboard must ONLY query rows where:
 *   validation_status = 'passed' AND publication_status = 'published'
 * Invalid or unverified rows must never reach the UI.
 */
import {
  pgTable,
  uuid,
  text,
  date,
  numeric,
  jsonb,
  timestamp,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const cashFlowStatementsTable = pgTable(
  "cash_flow_statements",
  {
    id:                 uuid("id").primaryKey().defaultRandom(),
    entityId:           uuid("entity_id").notNull(),
    periodStart:        date("period_start").notNull(),
    periodEnd:          date("period_end").notNull(),
    qboId:              text("qbo_id").notNull(),
    sourceReportName:   text("source_report_name"),
    sourceReportDate:   date("source_report_date"),
    sections:           jsonb("sections").notNull(),
    beginningCash:      numeric("beginning_cash"),
    netOperating:       numeric("net_operating"),
    netInvesting:       numeric("net_investing"),
    netFinancing:       numeric("net_financing"),
    netChange:          numeric("net_change"),
    endingCash:         numeric("ending_cash"),
    validationStatus:   text("validation_status").notNull().default("failed"),
    validationDetails:  jsonb("validation_details"),
    publicationStatus:  text("publication_status").notNull().default("blocked"),
    parserVersion:      text("parser_version").notNull().default("2.0"),
    validatedAt:        timestamp("validated_at", { withTimezone: true }),
    publishedAt:        timestamp("published_at", { withTimezone: true }),
    fetchedAt:          timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    syncRunId:          uuid("sync_run_id"),
  },
  (t) => ({
    validationStatusCheck: check(
      "validation_status_check",
      sql`${t.validationStatus} IN ('passed', 'failed')`,
    ),
    publicationStatusCheck: check(
      "publication_status_check",
      sql`${t.publicationStatus} IN ('published', 'blocked', 'skipped')`,
    ),
  }),
);

export type CashFlowStatementRow = typeof cashFlowStatementsTable.$inferSelect;
