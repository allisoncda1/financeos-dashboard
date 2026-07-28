import { pgTable, uuid, text, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { syncRuns } from "./sync";

export const syncRunObjects = pgTable("sync_run_objects", {
  id:              uuid("id").primaryKey().defaultRandom(),
  syncRunId:       uuid("sync_run_id").notNull().references(() => syncRuns.id, { onDelete: "cascade" }),
  entityId:        uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  objectType:      text("object_type").notNull(),
  status:          text("status").notNull(),
  recordsFetched:  integer("records_fetched").notNull().default(0),
  recordsInserted: integer("records_inserted").notNull().default(0),
  recordsUpdated:  integer("records_updated").notNull().default(0),
  recordsSkipped:  integer("records_skipped").notNull().default(0),
  errorMessage:    text("error_message"),
  startedAt:       timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:     timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  unique("sync_run_objects_run_type_uidx").on(t.syncRunId, t.entityId, t.objectType),
  index("sync_run_objects_entity_type_idx").on(t.entityId, t.objectType, t.completedAt),
]);

export type SyncRunObject = typeof syncRunObjects.$inferSelect;
