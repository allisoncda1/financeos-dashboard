import { pgTable, uuid, date, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

/**
 * Portfolio-level roll-up snapshots produced by FinanceOS Core. Read-only
 * from the Dashboard. `is_current` marks the latest published snapshot. The
 * `metrics` jsonb holds Core's own roll-up shape (totals, portfolio_kpis,
 * entity_ranking, …); the Dashboard aggregates financial_periods for its own
 * flat PortfolioSummary shape rather than reading these fields directly.
 */
export const portfolioSnapshotsTable = pgTable("portfolio_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  asOf: date("as_of").notNull(),
  pipelineRun: timestamp("pipeline_run", { withTimezone: true }).notNull(),
  entityIds: uuid("entity_ids").array().notNull(),
  metrics: jsonb("metrics").notNull(),
  isCurrent: boolean("is_current").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PortfolioSnapshotRow = typeof portfolioSnapshotsTable.$inferSelect;
