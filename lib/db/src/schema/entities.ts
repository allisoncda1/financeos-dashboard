import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Canonical entity registry. Owned and populated by FinanceOS Core (Python);
 * the Dashboard treats this as a read model. `id` (uuid) is the foreign key
 * every Core table (financial_periods, entity_snapshots, …) references;
 * `slug` is the stable human key the Dashboard joins on.
 */
export const entitiesTable = pgTable("entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  shortName: text("short_name"),
  qboRealmId: text("qbo_realm_id").notNull(),
  accountingBasis: text("accounting_basis").notNull(),
  currency: text("currency").notNull(),
  timeZone: text("time_zone").notNull(),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EntityRow = typeof entitiesTable.$inferSelect;
export type InsertEntityRow = typeof entitiesTable.$inferInsert;
