import { pgTable, uuid, text, timestamp, boolean, numeric, index, unique } from "drizzle-orm/pg-core";
import { entities } from "./entities";

export const accounts = pgTable("accounts", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  entityId:            uuid("entity_id").notNull().references(() => entities.id),
  qboId:               text("qbo_id").notNull(),
  name:                text("name").notNull(),
  fullyQualifiedName:  text("fully_qualified_name"),
  accountType:         text("account_type").notNull(),
  accountSubtype:      text("account_subtype"),
  classification:      text("classification"),
  currentBalance:      numeric("current_balance", { precision: 18, scale: 2 }).default("0"),
  currency:            text("currency").default("USD"),
  isActive:            boolean("is_active").default(true),
  isSubAccount:        boolean("is_sub_account").default(false),
  parentQboId:         text("parent_qbo_id"),
  syncedAt:            timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_accounts_entity_qbo").on(t.entityId, t.qboId),
  index("idx_accounts_entity").on(t.entityId),
  index("idx_accounts_type").on(t.entityId, t.accountType),
]);

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;
