import { pgTable, uuid, text, timestamp, boolean, jsonb, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { syncRuns } from "./sync";

export const qboRaw = pgTable("qbo_raw", {
  id:            uuid("id").primaryKey().defaultRandom(),
  entityId:      uuid("entity_id").notNull().references(() => entities.id),
  objectType:    text("object_type").notNull(),
  qboId:         text("qbo_id").notNull(),
  qboSyncToken:  text("qbo_sync_token"),
  payload:       jsonb("payload").notNull(),
  syncedAt:      timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  syncRunId:     uuid("sync_run_id").references(() => syncRuns.id),
  isDeleted:     boolean("is_deleted").notNull().default(false),
}, (t) => [
  unique("uq_qbo_raw_entity_type_id").on(t.entityId, t.objectType, t.qboId),
  index("idx_qbo_raw_entity_type").on(t.entityId, t.objectType),
  index("idx_qbo_raw_synced_at").on(t.syncedAt),
]);

export type QboRaw = typeof qboRaw.$inferSelect;
export type InsertQboRaw = typeof qboRaw.$inferInsert;
