import { pgTable, uuid, date, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

/**
 * Point-in-time per-entity snapshots produced by FinanceOS Core. Read-only
 * from the Dashboard. `is_current` marks the latest snapshot per entity. The
 * jsonb payloads mirror the Dashboard's domain types (metrics, anomalies,
 * financials, …) but are only consumed in later sprints.
 */
export const entitySnapshotsTable = pgTable("entity_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  asOf: date("as_of").notNull(),
  pipelineRun: timestamp("pipeline_run", { withTimezone: true }).notNull(),
  metrics: jsonb("metrics").notNull(),
  anomalies: jsonb("anomalies").notNull(),
  financials: jsonb("financials"),
  customersData: jsonb("customers_data"),
  vendorsData: jsonb("vendors_data"),
  bankingData: jsonb("banking_data"),
  isCurrent: boolean("is_current").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EntitySnapshotRow = typeof entitySnapshotsTable.$inferSelect;

// Aliases matching the naming used by the GitHub-authored api-server services:
// they import { entitySnapshots } / type { EntitySnapshot }.
export const entitySnapshots = entitySnapshotsTable;
export type EntitySnapshot = EntitySnapshotRow;
