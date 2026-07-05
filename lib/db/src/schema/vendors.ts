import { pgTable, uuid, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Vendors synced from QBO into FinanceOS Core. Read-only from the Dashboard.
 * NOTE: `balance` is a net figure (can be negative for vendor credits) and does
 * NOT reconcile to the `open_ap` KPI, so the AP view derives from `bills` rather
 * than this table. Numeric columns surface as strings via Drizzle — parse first.
 */
export const vendorsTable = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  qboId: text("qbo_id"),
  displayName: text("display_name"),
  email: text("email"),
  balance: numeric("balance"),
  currency: text("currency"),
  isActive: boolean("is_active"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
});

export type VendorRow = typeof vendorsTable.$inferSelect;
