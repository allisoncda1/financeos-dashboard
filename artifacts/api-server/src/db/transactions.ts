import { eq, and, desc } from "drizzle-orm";
import { db } from "./connection";
import { transactions } from "@workspace/db";

export type { Transaction } from "@workspace/db";

/**
 * Parse a Drizzle numeric string to a number, preserving null.
 * amounts in the `transactions` table are unsigned magnitudes — never coerce
 * a null amount to 0, which would mask missing data.
 */
function parseAmount(v: string | null | undefined): number | null {
  if (v == null) return null;
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Most recent transactions for one entity, newest first.
 */
export async function getRecentTransactions(entityId: string, limit = 50) {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.entityId, entityId),
        eq(transactions.isDeleted, false),
      ),
    )
    .orderBy(desc(transactions.transactionDate))
    .limit(limit);

  return rows.map((r) => ({ ...r, amount: parseAmount(r.amount) }));
}

/**
 * Transactions for a specific bank account, newest first.
 */
export async function getTransactionsByAccount(entityId: string, accountId: string) {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.entityId, entityId),
        eq(transactions.accountId, accountId),
        eq(transactions.isDeleted, false),
      ),
    )
    .orderBy(desc(transactions.transactionDate));

  return rows.map((r) => ({ ...r, amount: parseAmount(r.amount) }));
}

/**
 * Count of unreconciled transactions for an entity.
 * Used to compute reconciliation_status for the banking view.
 */
export async function getUnreconciledCount(entityId: string): Promise<number> {
  const rows = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.entityId, entityId),
        eq(transactions.isReconciled, false),
        eq(transactions.isDeleted, false),
      ),
    );
  return rows.length;
}

/**
 * Transactions filtered by type (e.g. 'Payment', 'Purchase').
 * Used by the Forecast module to build cash flow series.
 */
export async function getTransactionsByType(entityId: string, type: string) {
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.entityId, entityId),
        eq(transactions.transactionType, type),
        eq(transactions.isDeleted, false),
      ),
    )
    .orderBy(desc(transactions.transactionDate));

  return rows.map((r) => ({ ...r, amount: parseAmount(r.amount) }));
}
