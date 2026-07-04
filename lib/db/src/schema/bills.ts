import { pgTable, uuid, text, date, timestamp, boolean, numeric, integer, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { vendors } from "./vendors";

export const bills = pgTable("bills", {
  id:          uuid("id").primaryKey().defaultRandom(),
  entityId:    uuid("entity_id").notNull().references(() => entities.id),
  qboId:       text("qbo_id").notNull(),
  vendorId:    uuid("vendor_id").references(() => vendors.id),
  vendorName:  text("vendor_name"),
  billDate:    date("bill_date").notNull(),
  dueDate:     date("due_date"),
  amount:      numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
  balance:     numeric("balance", { precision: 18, scale: 2 }).notNull().default("0"),
  status:      text("status"),
  // Same rationale as invoices.days_overdue — written by Python sync engine.
  daysOverdue: integer("days_overdue").default(0),
  currency:    text("currency").default("USD"),
  memo:        text("memo"),
  isDeleted:   boolean("is_deleted").default(false),
  syncedAt:    timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_bills_entity_qbo").on(t.entityId, t.qboId),
  index("idx_bills_entity_date").on(t.entityId, t.billDate),
  index("idx_bills_status").on(t.entityId, t.status),
  index("idx_bills_vendor").on(t.vendorId),
]);

export type Bill = typeof bills.$inferSelect;
export type InsertBill = typeof bills.$inferInsert;
