import { pgTable, uuid, text, date, numeric, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { customers } from "./customers";
import { qboRaw } from "./qbo";
import { syncRuns } from "./sync";

/**
 * Canonical AR sub-ledger: QBO CreditMemo documents.
 *
 * ACCOUNTING RULE: remaining_credit is the ONLY AR-adjustment column.
 * Never subtract total_amt — applied portions are already in invoices.balance.
 * Written exclusively by the Python FinanceOS Core pipeline.
 * Read-only from the TypeScript dashboard via CORE_DATABASE_URL.
 */
export const creditMemos = pgTable("credit_memos", {
  id:              uuid("id").primaryKey().defaultRandom(),
  entityId:        uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  qboId:           text("qbo_id").notNull(),
  qboSyncToken:    text("qbo_sync_token"),
  qboRawId:        uuid("qbo_raw_id").references(() => qboRaw.id, { onDelete: "set null" }),
  syncRunId:       uuid("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
  customerId:      uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerQboId:   text("customer_qbo_id"),
  customerName:    text("customer_name"),
  docNumber:       text("doc_number"),
  txnDate:         date("txn_date"),
  currency:        text("currency").notNull().default("USD"),
  exchangeRate:    numeric("exchange_rate", { precision: 20, scale: 10 }),
  /** Original credit amount. DO NOT use for AR calculations — see remaining_credit. */
  totalAmt:        numeric("total_amt", { precision: 18, scale: 2 }).notNull().default("0"),
  /** Unapplied credit balance. The ONLY column used for normalized net AR. */
  remainingCredit: numeric("remaining_credit", { precision: 18, scale: 2 }).notNull().default("0"),
  applyStatus:     text("apply_status").notNull().default("unapplied"),
  isVoided:        boolean("is_voided").notNull().default(false),
  isDeleted:       boolean("is_deleted").notNull().default(false),
  qboStatus:       text("qbo_status"),
  privateNote:     text("private_note"),
  qboCreatedAt:    timestamp("qbo_created_at", { withTimezone: true }),
  qboUpdatedAt:    timestamp("qbo_updated_at", { withTimezone: true }),
  syncedAt:        timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("credit_memos_entity_qbo_id_uidx").on(t.entityId, t.qboId),
  index("credit_memos_entity_active_idx").on(t.entityId, t.currency),
  index("credit_memos_sync_run_idx").on(t.syncRunId),
]);

export type CreditMemo = typeof creditMemos.$inferSelect;
