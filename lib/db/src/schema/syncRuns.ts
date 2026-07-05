import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";

/**
 * QuickBooks sync run audit trail produced by FinanceOS Core. Read-only from
 * the Dashboard, which derives pipeline freshness/health from the most recent
 * run(s) instead of Google Drive's audit/data_freshness.json.
 */
export const syncRunsTable = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  syncType: text("sync_type").notNull(),
  objectTypes: text("object_types").array().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: text("status").notNull(),
  recordsFetched: integer("records_fetched"),
  recordsInserted: integer("records_inserted"),
  recordsUpdated: integer("records_updated"),
  recordsSkipped: integer("records_skipped"),
  errorMessage: text("error_message"),
  qboRateLimitHits: integer("qbo_rate_limit_hits"),
  triggeredBy: text("triggered_by").notNull(),
});

export type SyncRunRow = typeof syncRunsTable.$inferSelect;
