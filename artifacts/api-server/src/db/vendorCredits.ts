import { eq, and, desc } from "drizzle-orm";
import { db } from "./connection";
import { vendorCredits } from "@workspace/db";
import { parseNumeric } from "../services/numerics";

export async function getVendorCredits(entityId: string) {
  const rows = await db
    .select()
    .from(vendorCredits)
    .where(and(
      eq(vendorCredits.entityId, entityId),
      eq(vendorCredits.isDeleted, false),
    ))
    .orderBy(desc(vendorCredits.txnDate));
  return rows.map((r) => ({
    ...r,
    totalAmt: parseNumeric(r.totalAmt),
    remainingBalance: parseNumeric(r.remainingBalance),
  }));
}
