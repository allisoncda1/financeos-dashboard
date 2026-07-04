import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const entitiesTable = pgTable("entities", {
  slug: text("slug").primaryKey(),
  displayName: text("display_name").notNull(),
  accountingBasis: text("accounting_basis").notNull(),
  currency: text("currency").notNull(),
  timeZone: text("time_zone").notNull(),
  qboRealmId: text("qbo_realm_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EntityRow = typeof entitiesTable.$inferSelect;
export type InsertEntityRow = typeof entitiesTable.$inferInsert;
