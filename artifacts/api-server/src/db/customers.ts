import { eq, and, desc } from "drizzle-orm";
import { db } from "./connection";
import { customers } from "@workspace/db";

export type { Customer } from "@workspace/db";

function n(v: string | null | undefined): number {
  const parsed = parseFloat(v ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Active customers for one entity, ordered by balance descending.
 */
export async function getCustomers(entityId: string) {
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.entityId, entityId), eq(customers.isActive, true)))
    .orderBy(desc(customers.balance));

  return rows.map((r) => ({ ...r, balance: n(r.balance) }));
}

export async function getCustomerById(entityId: string, customerId: string) {
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.entityId, entityId), eq(customers.id, customerId)))
    .limit(1);
  return rows[0] ? { ...rows[0], balance: n(rows[0].balance) } : null;
}
