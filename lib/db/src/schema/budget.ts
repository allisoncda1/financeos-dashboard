import { pgTable, uuid, text, date, timestamp, numeric, index, unique } from "drizzle-orm/pg-core";

export const budgets = pgTable("budgets", {
  id:               uuid("id").primaryKey().defaultRandom(),
  entityId:         uuid("entity_id").notNull(),
  periodType:       text("period_type").notNull(),   // 'month' | 'annual'
  periodStart:      date("period_start").notNull(),
  periodEnd:        date("period_end").notNull(),

  revenueTarget:    numeric("revenue_target",    { precision: 18, scale: 2 }),
  cogsTarget:       numeric("cogs_target",       { precision: 18, scale: 2 }),
  opexTarget:       numeric("opex_target",       { precision: 18, scale: 2 }),
  netIncomeTarget:  numeric("net_income_target", { precision: 18, scale: 2 }),

  createdAt:        timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at",  { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_budgets_entity_type_start").on(t.entityId, t.periodType, t.periodStart),
  index("idx_budgets_entity").on(t.entityId, t.periodType, t.periodStart),
]);

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;
