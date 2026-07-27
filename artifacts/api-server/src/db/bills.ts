import { eq, and, gt, gte, lte, lt, desc, min, max, count, sum } from "drizzle-orm";
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
 * Optional from/to (YYYY-MM-DD, inclusive) filter by billDate.
 */
export async function getOpenBills(
  entityId: string,
  from?: string | null,
  to?: string | null,
) {
  const rows = await db
    .select()
    .from(bills)
    .where(
      and(
        eq(bills.entityId, entityId),
        gt(bills.balance, "0"),
        eq(bills.isDeleted, false),
        from ? gte(bills.billDate, from) : undefined,
        to   ? lte(bills.billDate, to)   : undefined,
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

export type PriorPeriodBillMeta = {
  count: number;
  totalBalance: number;
  earliestDate: string | null;
  latestDate: string | null;
};

/**
 * Open bills (balance > 0, not deleted) dated strictly before `before`.
 * Used to surface prior-period cleanup notices when period filtering is active.
 * Returns null when no such bills exist.
 */
export async function getPriorPeriodOpenBills(
  entityId: string,
  before: string,
): Promise<PriorPeriodBillMeta | null> {
  const rows = await db
    .select({
      cnt:      count(),
      totalBal: sum(bills.balance),
      earliest: min(bills.billDate),
      latest:   max(bills.billDate),
    })
    .from(bills)
    .where(
      and(
        eq(bills.entityId, entityId),
        gt(bills.balance, "0"),
        eq(bills.isDeleted, false),
        lt(bills.billDate, before),
      ),
    );

  const row = rows[0];
  if (!row || Number(row.cnt) === 0) return null;

  return {
    count:        Number(row.cnt),
    totalBalance: parseNumeric(row.totalBal ?? "0"),
    earliestDate: row.earliest ?? null,
    latestDate:   row.latest ?? null,
  };
}

export async function getBillById(entityId: string, billId: string) {
  const rows = await db
    .select()
    .from(bills)
    .where(and(eq(bills.entityId, entityId), eq(bills.id, billId)))
    .limit(1);
  return rows[0] ?? null;
}
