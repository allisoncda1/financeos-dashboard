import { pgTable, uuid, text, date, timestamp, boolean, numeric, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { accounts } from "./accounts";

export const transactions = pgTable("transactions", {
  id:               uuid("id").primaryKey().defaultRandom(),
  entityId:         uuid("entity_id").notNull().references(() => entities.id),
  qboId:            text("qbo_id").notNull(),
  transactionType:  text("transaction_type").notNull(),
  transactionDate:  date("transaction_date").notNull(),
  amount:           numeric("amount", { precision: 18, scale: 2 }).notNull(),
  accountId:        uuid("account_id").references(() => accounts.id),
  accountName:      text("account_name"),
  entityRef:        text("entity_ref"),
  memo:             text("memo"),
  category:         text("category"),
  currency:         text("currency").default("USD"),
  isReconciled:     boolean("is_reconciled").default(false),
  isDeleted:        boolean("is_deleted").default(false),
  syncedAt:         timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_transactions_entity_type_qbo").on(t.entityId, t.transactionType, t.qboId),
  index("idx_transactions_entity_date").on(t.entityId, t.transactionDate),
  index("idx_transactions_type").on(t.entityId, t.transactionType),
  index("idx_transactions_account").on(t.accountId),
]);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
