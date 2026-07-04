import { pgTable, uuid, text, timestamp, integer, index, primaryKey } from "drizzle-orm/pg-core";
import { entities } from "./entities";

export const syncRuns = pgTable("sync_runs", {
  id:                uuid("id").primaryKey().defaultRandom(),
  entityId:          uuid("entity_id").notNull().references(() => entities.id),
  syncType:          text("sync_type").notNull(),
  objectTypes:       text("object_types").array().notNull(),
  startedAt:         timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:       timestamp("completed_at", { withTimezone: true }),
  status:            text("status").notNull().default("running"),
  recordsFetched:    integer("records_fetched").default(0),
  recordsInserted:   integer("records_inserted").default(0),
  recordsUpdated:    integer("records_updated").default(0),
  recordsSkipped:    integer("records_skipped").default(0),
  errorMessage:      text("error_message"),
  qboRateLimitHits:  integer("qbo_rate_limit_hits").default(0),
  triggeredBy:       text("triggered_by").notNull().default("scheduler"),
}, (t) => [
  index("idx_sync_runs_entity_status").on(t.entityId, t.status),
  index("idx_sync_runs_started_at").on(t.startedAt),
]);

export const syncState = pgTable("sync_state", {
  entityId:          uuid("entity_id").notNull().references(() => entities.id),
  objectType:        text("object_type").notNull(),
  lastSyncAt:        timestamp("last_sync_at", { withTimezone: true }),
  lastModifiedTime:  timestamp("last_modified_time", { withTimezone: true }),
  totalRecords:      integer("total_records").default(0),
}, (t) => [
  primaryKey({ columns: [t.entityId, t.objectType] }),
  index("idx_sync_state_entity").on(t.entityId),
]);

export type SyncRun = typeof syncRuns.$inferSelect;
export type InsertSyncRun = typeof syncRuns.$inferInsert;
export type SyncState = typeof syncState.$inferSelect;
export type InsertSyncState = typeof syncState.$inferInsert;
