import { pgTable, uuid, date, timestamp, boolean, jsonb, index, sql } from "drizzle-orm/pg-core";
import { entities } from "./entities";

export const entitySnapshots = pgTable("entity_snapshots", {
  id:            uuid("id").primaryKey().defaultRandom(),
  entityId:      uuid("entity_id").notNull().references(() => entities.id),
  asOf:          date("as_of").notNull(),
  pipelineRun:   timestamp("pipeline_run", { withTimezone: true }).notNull().defaultNow(),
  metrics:       jsonb("metrics").notNull(),
  anomalies:     jsonb("anomalies").notNull().default(sql`'[]'::jsonb`),
  financials:    jsonb("financials"),
  customersData: jsonb("customers_data"),
  vendorsData:   jsonb("vendors_data"),
  bankingData:   jsonb("banking_data"),
  // Only one current snapshot per entity. Enforced by partial unique index below.
  isCurrent:     boolean("is_current").notNull().default(true),
  generatedAt:   timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Partial unique index: at most one row per entity where is_current = true
  index("idx_entity_snapshots_current")
    .on(t.entityId)
    .where(sql`${t.isCurrent} = true`),
  index("idx_entity_snapshots_entity_date").on(t.entityId, t.asOf),
]);

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id:          uuid("id").primaryKey().defaultRandom(),
  asOf:        date("as_of").notNull(),
  pipelineRun: timestamp("pipeline_run", { withTimezone: true }).notNull().defaultNow(),
  entityIds:   uuid("entity_ids").array().notNull(),
  metrics:     jsonb("metrics").notNull(),
  // Enforced by application logic: Python sets previous isCurrent=false before inserting new row.
  isCurrent:   boolean("is_current").notNull().default(true),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_portfolio_snapshots_current")
    .on(t.isCurrent)
    .where(sql`${t.isCurrent} = true`),
  index("idx_portfolio_snapshots_date").on(t.asOf),
]);

export type EntitySnapshot = typeof entitySnapshots.$inferSelect;
export type InsertEntitySnapshot = typeof entitySnapshots.$inferInsert;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;
