import { pgTable, uuid, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Chart of accounts synced from QBO into FinanceOS Core. Read-only from the
 * Dashboard. Only rows with `account_type = 'Bank'` represent real bank
 * accounts; the rest are P&L / balance-sheet ledger accounts. Numeric columns
 * surface as strings via Drizzle — parse before use.
 */
export const accountsTable = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  qboId: text("qbo_id"),
  name: text("name"),
  fullyQualifiedName: text("fully_qualified_name"),
  accountType: text("account_type"),
  accountSubtype: text("account_subtype"),
  classification: text("classification"),
  currentBalance: numeric("current_balance"),
  currency: text("currency"),
  isActive: boolean("is_active"),
  isSubAccount: boolean("is_sub_account"),
  parentQboId: text("parent_qbo_id"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
});

export type AccountRow = typeof accountsTable.$inferSelect;

// Aliases matching the naming used by the GitHub-authored api-server services
// (RC-006 Banking): they import { accounts } / type { Account }.
export const accounts = accountsTable;
export type Account = AccountRow;
