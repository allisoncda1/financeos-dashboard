import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "./connection";
import { bills } from "@workspace/db";
import { parseNumeric } from "../services/numerics";
import { buildAgingBuckets } from "../services/aging";
import type { AgingBucket } from "../lib/types";

export type { Bill } from "@workspace/db";

export type ApAgingBucket = AgingBucket;

export type VendorAp = {
  name: string;
  balance: number;
  dueDate: string;
  status: "current" | "overdue" | "scheduled";
};

function toStatus(daysOverdue: number, dueDate: string | null): VendorAp["status"] {
  if (daysOverdue > 0) return "overdue";
  if (dueDate && new Date(dueDate) > new Date()) return "scheduled";
  return "current";
}

/**
 * Open bills for one entity (balance > 0, not deleted), newest first.
 */
export async function getOpenBills(entityId: string) {
  const rows = await db
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.entityId, entityId),
        gt(bills.balance, "0"),
        eq(bills.isDeleted, false),
      ),
    )
    .orderBy(desc(bills.billDate));

  return rows.map((r) => ({ ...r, amount: parseNumeric(r.amount), balance: parseNumeric(r.balance) }));
}

/**
 * AP aging buckets derived from open bills.
 */
export async function getApAgingBuckets(entityId: string): Promise<ApAgingBucket[]> {
  return buildAgingBuckets(await getOpenBills(entityId));
}

/**
 * Top vendors by open AP balance.
 */
export async function getTopVendorsByAp(
  entityId: string,
  limit = 10,
): Promise<VendorAp[]> {
  const open = await getOpenBills(entityId);

  const byVendor = new Map<string, { balance: number; dueDate: string; maxDaysOverdue: number }>();
  for (const bill of open) {
    const name = bill.vendorName ?? "Unknown";
    const existing = byVendor.get(name) ?? { balance: 0, dueDate: "", maxDaysOverdue: 0 };
    existing.balance        += bill.balance;
    existing.maxDaysOverdue  = Math.max(existing.maxDaysOverdue, bill.daysOverdue ?? 0);
    if (!existing.dueDate && bill.dueDate) existing.dueDate = bill.dueDate;
    byVendor.set(name, existing);
  }

  return Array.from(byVendor.entries())
    .map(([name, { balance, dueDate, maxDaysOverdue }]) => ({
      name,
      balance,
      dueDate,
      status: toStatus(maxDaysOverdue, dueDate || null),
    }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, limit);
}

export async function getBillById(entityId: string, billId: string) {
  const rows = await db
    .select()
    .from(bills)
    .where(and(eq(bills.entityId, entityId), eq(bills.id, billId)))
    .limit(1);
  return rows[0] ?? null;
}
