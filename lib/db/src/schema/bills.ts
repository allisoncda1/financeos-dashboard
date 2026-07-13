import { pgTable, uuid, text, date, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Accounts-payable bills synced from QBO into FinanceOS Core. Read-only from the
 * Dashboard. Open (still-owing) bills have a non-zero `balance` and
 * `is_deleted = false`. `days_overdue` is precomputed by Core (negative = not
 * yet due). Numeric columns surface as strings via Drizzle — parse before use.
 */
export const billsTable = pgTable("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  qboId: text("qbo_id"),
  vendorId: uuid("vendor_id"),
  vendorName: text("vendor_name"),
  billDate: date("bill_date"),
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

export type BillRow = typeof billsTable.$inferSelect;

// Aliases matching the naming used by the GitHub-authored api-server services:
// they import { bills } / type { Bill }.
export const bills = billsTable;
export type Bill = BillRow;
