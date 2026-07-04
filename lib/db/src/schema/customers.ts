import { pgTable, uuid, text, timestamp, boolean, numeric, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";

export const customers = pgTable("customers", {
  id:           uuid("id").primaryKey().defaultRandom(),
  entityId:     uuid("entity_id").notNull().references(() => entities.id),
  qboId:        text("qbo_id").notNull(),
  displayName:  text("display_name").notNull(),
  email:        text("email"),
  phone:        text("phone"),
  balance:      numeric("balance", { precision: 18, scale: 2 }).default("0"),
  currency:     text("currency").default("USD"),
  isActive:     boolean("is_active").default(true),
  syncedAt:     timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_customers_entity_qbo").on(t.entityId, t.qboId),
  index("idx_customers_entity").on(t.entityId),
]);

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
