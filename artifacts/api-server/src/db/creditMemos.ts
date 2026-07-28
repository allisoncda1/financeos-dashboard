import { eq, and, desc } from "drizzle-orm";
import { db } from "./connection";
import { creditMemos } from "@workspace/db";
import { parseNumeric } from "../services/numerics";

export async function getCreditMemos(entityId: string) {
  const rows = await db
    .select()
    .from(creditMemos)
    .where(and(
      eq(creditMemos.entityId, entityId),
      eq(creditMemos.isDeleted, false),
    ))
    .orderBy(desc(creditMemos.txnDate));
  return rows.map((r) => ({
    ...r,
    totalAmt: parseNumeric(r.totalAmt),
    remainingCredit: parseNumeric(r.remainingCredit),
  }));
}
