import { eq, and, desc } from "drizzle-orm";
import { db } from "./connection";
import { vendors } from "@workspace/db";

export type { Vendor } from "@workspace/db";

function n(v: string | null | undefined): number {
  const parsed = parseFloat(v ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Active vendors for one entity, ordered by balance descending.
 */
export async function getVendors(entityId: string) {
  const rows = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.entityId, entityId), eq(vendors.isActive, true)))
    .orderBy(desc(vendors.balance));

  return rows.map((r) => ({ ...r, balance: n(r.balance) }));
}

export async function getVendorById(entityId: string, vendorId: string) {
  const rows = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.entityId, entityId), eq(vendors.id, vendorId)))
    .limit(1);
  return rows[0] ? { ...rows[0], balance: n(rows[0].balance) } : null;
}
