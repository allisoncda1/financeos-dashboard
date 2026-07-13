import { pgTable, uuid, text, date, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Accounts-receivable invoices synced from QBO into FinanceOS Core. Read-only
 * from the Dashboard. Open (still-owing) invoices have a non-zero `balance` and
 * `is_deleted = false`. `days_overdue` is precomputed by Core (negative = not
 * yet due). Numeric columns surface as strings via Drizzle — parse before use.
 */
export const invoicesTable = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  qboId: text("qbo_id"),
  customerId: uuid("customer_id"),
  customerName: text("customer_name"),
  invoiceDate: date("invoice_date"),
  dueDate: date("due_date"),
  amount: numeric("amount"),
  balance: numeric("balance"),
  status: text("status"),
  daysOverdue: integer("days_overdue"),
  currency: text("currency"),
  memo: text("memo"),
  isDeleted: boolean("is_deleted"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
});

export type InvoiceRow = typeof invoicesTable.$inferSelect;

// Aliases matching the naming used by the GitHub-authored api-server services:
// they import { invoices } / type { Invoice }.
export const invoices = invoicesTable;
export type Invoice = InvoiceRow;
