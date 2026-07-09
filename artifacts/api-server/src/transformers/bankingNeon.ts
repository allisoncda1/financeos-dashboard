import { EntitiesService, AccountsService, TransactionsService } from "../db";
import type { EntitySlug, BankingData, BankAccount, BankTransaction } from "../lib/types";

function parseLastFour(accountName: string): string {
  const match = accountName.match(/\((\d{4})\)/);
  return match?.[1] ?? "";
}

function parseInstitution(accountName: string): string {
  return accountName
    .replace(/\s*\(\d+\)/, "")
    .replace(/\s*-\s*\d+$/, "")
    .trim();
}

function reconciliationStatus(unreconciledCount: number): BankingData["reconciliation_status"] {
  if (unreconciledCount === 0) return "clean";
  if (unreconciledCount > 2) return "needs_review";
  return "pending";
}

export async function transformBankingNeon(slug: EntitySlug, asOf: string): Promise<BankingData> {
  const entityId = await EntitiesService.getEntityIdBySlug(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const [neonAccounts, neonTransactions, unreconciledCount] = await Promise.all([
    AccountsService.getBankAccounts(entityId),
    TransactionsService.getRecentTransactions(entityId, 200),
    TransactionsService.getUnreconciledCount(entityId),
  ]);

  const bankAccounts: BankAccount[] = neonAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    institution: parseInstitution(a.name),
    account_type: a.accountSubtype ?? a.accountType,
    last_four: parseLastFour(a.name),
    balance: a.currentBalance,
    // No color field in Neon — UI falls back to entity brand color
    color: "",
    // Reconciliation state unknown until a reconciliation table exists
    reconciled: false,
    last_reconciled: "",
  }));

  const accountIdSet = new Set(bankAccounts.map((a) => a.id));

  const bankTransactions: BankTransaction[] = neonTransactions
    .filter((t) => t.accountId !== null && accountIdSet.has(t.accountId))
    .map((t) => ({
      id: t.id,
      account_id: t.accountId ?? "",
      date: t.transactionDate,
      description: t.memo ?? t.entityRef ?? t.transactionType,
      amount: t.amount,
      category: t.category ?? t.accountName ?? "",
      reconciled: t.isReconciled ?? false,
    }));

  const total_cash = bankAccounts.reduce((sum, a) => sum + a.balance, 0);

  return {
    entity_slug: slug,
    as_of: asOf,
    total_cash,
    reconciliation_status: reconciliationStatus(unreconciledCount),
    unreconciled_count: unreconciledCount,
    accounts: bankAccounts,
    transactions: bankTransactions,
  };
}
