import { AccountsService, TransactionsService } from "../db";
import { getCachedEntityId } from "../services/entityCache";
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
  const entityId = await getCachedEntityId(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const [neonAccounts, neonTransactions, unreconciledCount] = await Promise.all([
    AccountsService.getBankAccounts(entityId),
    TransactionsService.getRecentTransactions(entityId, 200),
    TransactionsService.getUnreconciledCount(entityId),
  ]);

  const bankAccounts: BankAccount[] = neonAccounts.map((a) => {
    const name = a.name ?? "Unnamed account";
    return {
      id: a.id,
      name,
      institution: parseInstitution(name),
      account_type: a.accountType === "Credit Card"
        ? "Credit Card"
        : (a.accountSubtype ?? a.accountType ?? "Bank"),
      last_four: parseLastFour(name),
      balance: a.currentBalance,
      // No color field in Neon — UI falls back to entity brand color
      color: "",
      // Reconciliation state unknown until a reconciliation table exists
      reconciled: false,
      last_reconciled: "",
    };
  });

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

  // Credit-card balances are liabilities. They belong in the Banking account
  // and transaction views, but must never inflate or reduce the cash KPI.
  const total_cash = neonAccounts
    .filter((a) => a.accountType === "Bank")
    .reduce((sum, a) => sum + a.currentBalance, 0);

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
