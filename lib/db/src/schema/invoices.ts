import { pgTable, uuid, text, date, timestamp, boolean, numeric, integer, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { customers } from "./customers";

export const invoices = pgTable("invoices", {
  id:            uuid("id").primaryKey().defaultRandom(),
  entityId:      uuid("entity_id").notNull().references(() => entities.id),
  qboId:         text("qbo_id").notNull(),
  customerId:    uuid("customer_id").references(() => customers.id),
  customerName:  text("customer_name"),
  invoiceDate:   date("invoice_date").notNull(),
  dueDate:       date("due_date"),
  amount:        numeric("amount", { precision: 18, scale: 2 }).notNull().default("0"),
  balance:       numeric("balance", { precision: 18, scale: 2 }).notNull().default("0"),
  status:        text("status"),
  // Computed by Python sync engine; PostgreSQL stored generated columns cannot
  // reference CURRENT_DATE (volatile function), so this is written on each sync.
  daysOverdue:   integer("days_overdue").default(0),
  currency:      text("currency").default("USD"),
  memo:          text("memo"),
  isDeleted:     boolean("is_deleted").default(false),
  syncedAt:      timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_invoices_entity_qbo").on(t.entityId, t.qboId),
  index("idx_invoices_entity_date").on(t.entityId, t.invoiceDate),
  index("idx_invoices_status").on(t.entityId, t.status),
  index("idx_invoices_customer").on(t.customerId),
]);

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
