import { pgTable, uuid, text, timestamp, boolean, numeric, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";

export const vendors = pgTable("vendors", {
  id:           uuid("id").primaryKey().defaultRandom(),
  entityId:     uuid("entity_id").notNull().references(() => entities.id),
  qboId:        text("qbo_id").notNull(),
  displayName:  text("display_name").notNull(),
  email:        text("email"),
  balance:      numeric("balance", { precision: 18, scale: 2 }).default("0"),
  currency:     text("currency").default("USD"),
  isActive:     boolean("is_active").default(true),
  syncedAt:     timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_vendors_entity_qbo").on(t.entityId, t.qboId),
  index("idx_vendors_entity").on(t.entityId),
]);

export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;
