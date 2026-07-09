import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "./connection";
import { invoices, customers } from "@workspace/db";
import { parseNumeric } from "../services/numerics";
import { buildAgingBuckets } from "../services/aging";
import type { AgingBucket } from "../lib/types";

export type { Invoice } from "@workspace/db";

export type ArAgingBucket = AgingBucket;

export type CustomerAr = {
  name: string;
  balance: number;
  dsodays: number;
  status: "current" | "overdue" | "late";
};

function toStatus(daysOverdue: number): "current" | "overdue" | "late" {
  if (daysOverdue > 60) return "late";
  if (daysOverdue > 0)  return "overdue";
  return "current";
}

/**
 * Open invoices for one entity (balance > 0, not deleted), newest first.
 * Returns empty array when none exist.
 */
export async function getOpenInvoices(entityId: string) {
  const rows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.entityId, entityId),
        gt(invoices.balance, "0"),
        eq(invoices.isDeleted, false),
      ),
    )
    .orderBy(desc(invoices.invoiceDate));

  return rows.map((r) => ({ ...r, amount: parseNumeric(r.amount), balance: parseNumeric(r.balance) }));
}

/**
 * AR aging buckets derived from open invoices.
 * Bucket boundaries: Current / 1-30 / 31-60 / 61-90 / 90+
 */
export async function getArAgingBuckets(entityId: string): Promise<ArAgingBucket[]> {
  return buildAgingBuckets(await getOpenInvoices(entityId));
}

/**
 * Top customers by open AR balance, joined to the customers master.
 * Falls back to invoice-level customer_name when the FK join finds no row.
 */
export async function getTopCustomersByAr(
  entityId: string,
  limit = 10,
): Promise<CustomerAr[]> {
  const open = await getOpenInvoices(entityId);

  // Aggregate by customer name
  const byCustomer = new Map<string, { balance: number; maxDaysOverdue: number }>();
  for (const inv of open) {
    const name = inv.customerName ?? "Unknown";
    const existing = byCustomer.get(name) ?? { balance: 0, maxDaysOverdue: 0 };
    existing.balance        += inv.balance;
    existing.maxDaysOverdue  = Math.max(existing.maxDaysOverdue, inv.daysOverdue ?? 0);
    byCustomer.set(name, existing);
  }

  return Array.from(byCustomer.entries())
    .map(([name, { balance, maxDaysOverdue }]) => ({
      name,
      balance,
      dsodays: maxDaysOverdue,
      status:  toStatus(maxDaysOverdue),
    }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, limit);
}

/**
 * DSO approximation: balance-weighted average of days_overdue across open invoices.
 * Negative-balance rows (credit memos) are excluded to avoid skewing the result.
 */
export async function computeDso(entityId: string): Promise<number> {
  const open = await getOpenInvoices(entityId);
  const debit = open.filter((inv) => inv.balance > 0);
  const totalBalance = debit.reduce((s, inv) => s + inv.balance, 0);
  if (totalBalance === 0) return 0;
  return Math.round(
    debit.reduce((s, inv) => s + inv.balance * (inv.daysOverdue ?? 0), 0) / totalBalance,
  );
}

export async function getInvoiceById(entityId: string, invoiceId: string) {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.entityId, entityId), eq(invoices.id, invoiceId)))
    .limit(1);
  return rows[0] ?? null;
}
