import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "./connection";
import { bills } from "@workspace/db";

export type { Bill } from "@workspace/db";

export type ApAgingBucket = {
  label: string;
  days: string;
  amount: number;
  count: number;
};

export type VendorAp = {
  name: string;
  balance: number;
  dueDate: string;
  status: "current" | "overdue" | "scheduled";
};

function n(v: string | null | undefined): number {
  const parsed = parseFloat(v ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBucket(daysOverdue: number | null): string {
  const d = daysOverdue ?? 0;
  if (d <= 0)  return "Current";
  if (d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}

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

  return rows.map((r) => ({ ...r, amount: n(r.amount), balance: n(r.balance) }));
}

/**
 * AP aging buckets derived from open bills.
 */
export async function getApAgingBuckets(entityId: string): Promise<ApAgingBucket[]> {
  const open = await getOpenBills(entityId);

  const map = new Map<string, { amount: number; count: number }>();
  for (const bill of open) {
    const label = toBucket(bill.daysOverdue);
    const existing = map.get(label) ?? { amount: 0, count: 0 };
    existing.amount += bill.balance;
    existing.count  += 1;
    map.set(label, existing);
  }

  const ORDER = ["Current", "1-30", "31-60", "61-90", "90+"];
  return ORDER
    .filter((label) => map.has(label))
    .map((label) => ({
      label,
      days:   label,
      amount: map.get(label)!.amount,
      count:  map.get(label)!.count,
    }));
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
