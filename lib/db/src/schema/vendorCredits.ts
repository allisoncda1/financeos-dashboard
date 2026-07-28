import { pgTable, uuid, text, date, numeric, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";
import { vendors } from "./vendors";
import { qboRaw } from "./qbo";
import { syncRuns } from "./sync";

/**
 * Canonical AP sub-ledger: QBO VendorCredit documents.
 *
 * ACCOUNTING RULE: remaining_balance is the ONLY AP-adjustment column.
 * Never subtract total_amt — applied portions are already in bills.balance.
 * Written exclusively by the Python FinanceOS Core pipeline.
 * Read-only from the TypeScript dashboard via CORE_DATABASE_URL.
 *
 * NOTE: Pre-PR#43 VendorCredit rows in the transactions table are NOT
 * affected by this schema. They remain until a future cleanup migration.
 */
export const vendorCredits = pgTable("vendor_credits", {
  id:               uuid("id").primaryKey().defaultRandom(),
  entityId:         uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  qboId:            text("qbo_id").notNull(),
  qboSyncToken:     text("qbo_sync_token"),
  qboRawId:         uuid("qbo_raw_id").references(() => qboRaw.id, { onDelete: "set null" }),
  syncRunId:        uuid("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
  vendorId:         uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  vendorQboId:      text("vendor_qbo_id"),
  vendorName:       text("vendor_name"),
  docNumber:        text("doc_number"),
  txnDate:          date("txn_date"),
  currency:         text("currency").notNull().default("USD"),
  exchangeRate:     numeric("exchange_rate", { precision: 20, scale: 10 }),
  /** Original credit amount. DO NOT use for AP calculations — see remaining_balance. */
  totalAmt:         numeric("total_amt", { precision: 18, scale: 2 }).notNull().default("0"),
  /** Unapplied credit balance. The ONLY column used for normalized net AP. */
  remainingBalance: numeric("remaining_balance", { precision: 18, scale: 2 }).notNull().default("0"),
  applyStatus:      text("apply_status").notNull().default("unapplied"),
  isVoided:         boolean("is_voided").notNull().default(false),
  isDeleted:        boolean("is_deleted").notNull().default(false),
  qboStatus:        text("qbo_status"),
  privateNote:      text("private_note"),
  qboCreatedAt:     timestamp("qbo_created_at", { withTimezone: true }),
  qboUpdatedAt:     timestamp("qbo_updated_at", { withTimezone: true }),
  syncedAt:         timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("vendor_credits_entity_qbo_id_uidx").on(t.entityId, t.qboId),
  index("vendor_credits_entity_active_idx").on(t.entityId, t.currency),
  index("vendor_credits_sync_run_idx").on(t.syncRunId),
]);

export type VendorCredit = typeof vendorCredits.$inferSelect;
