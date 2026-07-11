import { pgTable, uuid, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

/**
 * Validation Engine results produced by FinanceOS Core. Read-only from the
 * Dashboard. Rows with a non-null `entity_id` are per-entity results; a row
 * with `entity_id = NULL` is a portfolio-level roll-up. `rule_results` is an
 * array of { rule, passed, detail } objects.
 */
export const validationResultsTable = pgTable("validation_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id"),
  syncRunId: uuid("sync_run_id"),
  runDate: timestamp("run_date", { withTimezone: true }).notNull(),
  totalChecks: integer("total_checks").notNull(),
  passed: integer("passed").notNull(),
  failed: integer("failed").notNull(),
  allPassed: boolean("all_passed").notNull(),
  ruleResults: jsonb("rule_results").notNull(),
});

export type ValidationResultRow = typeof validationResultsTable.$inferSelect;
