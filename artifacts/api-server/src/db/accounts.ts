import { eq, and } from "drizzle-orm";
import { db } from "./connection";
import { accounts } from "@workspace/db";

export type { Account } from "@workspace/db";

function n(v: string | null | undefined): number {
  const parsed = parseFloat(v ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * All active bank accounts for one entity (account_type = 'Bank').
 */
export async function getBankAccounts(entityId: string) {
  const rows = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.entityId, entityId),
        eq(accounts.accountType, "Bank"),
        eq(accounts.isActive, true),
      ),
    )
    .orderBy(accounts.name);

  return rows.map((r) => ({ ...r, currentBalance: n(r.currentBalance) }));
}

/**
 * All active accounts for one entity, optionally filtered by type.
 */
export async function getAccountsByType(entityId: string, type: string) {
  const rows = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.entityId, entityId),
        eq(accounts.accountType, type),
        eq(accounts.isActive, true),
      ),
    )
    .orderBy(accounts.name);

  return rows.map((r) => ({ ...r, currentBalance: n(r.currentBalance) }));
}

export async function getAllAccounts(entityId: string) {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.entityId, entityId), eq(accounts.isActive, true)))
    .orderBy(accounts.accountType, accounts.name);

  return rows.map((r) => ({ ...r, currentBalance: n(r.currentBalance) }));
}
