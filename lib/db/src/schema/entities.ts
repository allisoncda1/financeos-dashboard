import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const entities = pgTable("entities", {
  id:               uuid("id").primaryKey().defaultRandom(),
  slug:             text("slug").notNull().unique(),
  displayName:      text("display_name").notNull(),
  shortName:        text("short_name"),
  qboRealmId:       text("qbo_realm_id").notNull().unique(),
  accountingBasis:  text("accounting_basis").notNull().default("Cash"),
  currency:         text("currency").notNull().default("USD"),
  timeZone:         text("time_zone").notNull().default("America/Panama"),
  status:           text("status").notNull().default("active"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Entity = typeof entities.$inferSelect;
export type InsertEntity = typeof entities.$inferInsert;
