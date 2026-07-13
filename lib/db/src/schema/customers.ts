import { pgTable, uuid, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Customers synced from QBO into FinanceOS Core. Read-only from the Dashboard.
 * `balance` is Core's authoritative outstanding AR per customer and (summed
 * across nonzero-balance rows) reconciles to the `open_ar` KPI. Numeric columns
 * surface as strings via Drizzle — parse before use.
 */
export const customersTable = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  qboId: text("qbo_id"),
  displayName: text("display_name"),
  email: text("email"),
  phone: text("phone"),
  balance: numeric("balance"),
  currency: text("currency"),
  isActive: boolean("is_active"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
});

export type CustomerRow = typeof customersTable.$inferSelect;

// Aliases matching the naming used by the GitHub-authored api-server services:
// they import { customers } / type { Customer }.
export const customers = customersTable;
export type Customer = CustomerRow;
