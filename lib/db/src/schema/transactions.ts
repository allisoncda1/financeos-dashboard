import { pgTable, uuid, text, date, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Bank/ledger transactions synced from QBO into FinanceOS Core. Read-only from
 * the Dashboard. `account_id` references accounts.id. `amount` is stored as an
 * unsigned magnitude (direction is implied by `transaction_type`).
 * Numeric columns surface as strings via Drizzle — parse before use.
 */
export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  qboId: text("qbo_id"),
  transactionType: text("transaction_type"),
  transactionDate: date("transaction_date"),
  amount: numeric("amount"),
  accountId: uuid("account_id"),
  accountName: text("account_name"),
  entityRef: text("entity_ref"),
  memo: text("memo"),
  category: text("category"),
  currency: text("currency"),
  isReconciled: boolean("is_reconciled"),
  isDeleted: boolean("is_deleted"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
});

export type TransactionRow = typeof transactionsTable.$inferSelect;

// Aliases matching the naming used by the GitHub-authored api-server services
// (RC-006 Banking): they import { transactions } / type { Transaction }.
export const transactions = transactionsTable;
export type Transaction = TransactionRow;
