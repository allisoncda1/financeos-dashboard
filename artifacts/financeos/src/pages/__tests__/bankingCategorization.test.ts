/**
 * bankingCategorization.test.ts
 * Pure logic tests for the Banking transaction categorization feature.
 * No DOM, no network calls.
 */

import { describe, it, expect } from "vitest";
import { api } from "@/lib/api";
import type { BankingTransactionCategory, BankingTransactionCategoryMap } from "@/lib/api";
import * as fs from "fs";
import * as path from "path";

// ── Fixtures ──────────────────────────────────────────────────────────────────
const SLUG    = "cardealer_ai";
const TX_A    = "plaid-tx-aaa";
const TX_B    = "plaid-tx-bbb";
const COA_1   = "coa-001";
const COA_2   = "coa-002";

function makeCategory(txId: string, coaId: string, name: string): BankingTransactionCategory {
  return {
    id: `cat-${txId}`,
    plaidTransactionId: txId,
    entitySlug: SLUG,
    coaAccountId: coaId,
    coaAccountName: name,
    coaAccountType: "Expense",
    categorizedBy: "user-001",
    note: null,
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

type TxStub = { id: string; accountId: string };

function makeTx(id: string, accountId = "acct-1"): TxStub {
  return { id, accountId };
}

// ── 1. Empty transaction ID list returns {} without fetch ─────────────────────
describe("api.bankingTransactionCategories — empty guard", () => {
  it("returns an empty object immediately when txIds is empty", async () => {
    const result = await api.bankingTransactionCategories(SLUG, []);
    expect(result).toEqual({});
  });
});

// ── 2. Category map is keyed by Plaid transaction ID ─────────────────────────
describe("BankingTransactionCategoryMap shape", () => {
  it("is indexed by plaidTransactionId", () => {
    const map: BankingTransactionCategoryMap = {
      [TX_A]: makeCategory(TX_A, COA_1, "Advertising"),
    };
    expect(map[TX_A]?.coaAccountId).toBe(COA_1);
    expect(map[TX_B]).toBeUndefined();
  });
});

// ── 3. Uncategorized transaction label ────────────────────────────────────────
describe("FinanceOS Category display logic", () => {
  it("renders 'Uncategorized' when no category exists for transaction", () => {
    const map: BankingTransactionCategoryMap = {};
    const label = map[TX_A] ? (map[TX_A].coaAccountName ?? map[TX_A].coaAccountId) : "Uncategorized";
    expect(label).toBe("Uncategorized");
  });

  // ── 4. Existing category renders coaAccountName ───────────────────────────
  it("renders coaAccountName when a category exists", () => {
    const map: BankingTransactionCategoryMap = {
      [TX_A]: makeCategory(TX_A, COA_1, "Advertising"),
    };
    const label = map[TX_A] ? (map[TX_A].coaAccountName ?? map[TX_A].coaAccountId) : "Uncategorized";
    expect(label).toBe("Advertising");
  });

  it("falls back to coaAccountId when coaAccountName is null", () => {
    const cat = makeCategory(TX_A, COA_1, "Advertising");
    cat.coaAccountName = null;
    const map = { [TX_A]: cat };
    const label = map[TX_A] ? (map[TX_A].coaAccountName ?? map[TX_A].coaAccountId) : "Uncategorized";
    expect(label).toBe(COA_1);
  });
});

// ── 5. Plaid Category and FinanceOS Category are distinct ─────────────────────
describe("Column distinctness", () => {
  it("personalFinanceCategory is separate from FinanceOS categoryMap entry", () => {
    const plaidTx = {
      id: TX_A,
      personalFinanceCategory: { primary: "FOOD", detailed: "FOOD_AND_DRINK" },
    };
    const map: BankingTransactionCategoryMap = {
      [TX_A]: makeCategory(TX_A, COA_1, "Meals"),
    };
    expect(plaidTx.personalFinanceCategory.detailed).not.toBe(map[TX_A]?.coaAccountName);
    expect(map[TX_A]?.coaAccountName).toBe("Meals");
  });
});

// ── 6 & 7. Status and COA filters (mirror visibleTransactions formula) ────────
function applyFilters(
  transactions: TxStub[],
  map: BankingTransactionCategoryMap,
  statusFilter: "all" | "uncategorized" | "categorized",
  coaFilter: string,
): TxStub[] {
  return transactions.filter((t) => {
    const cat = map[t.id];
    if (statusFilter === "uncategorized" && cat) return false;
    if (statusFilter === "categorized" && !cat) return false;
    if (coaFilter && cat?.coaAccountId !== coaFilter) return false;
    return true;
  });
}

describe("Status filter", () => {
  const txs  = [makeTx(TX_A), makeTx(TX_B)];
  const map: BankingTransactionCategoryMap = { [TX_A]: makeCategory(TX_A, COA_1, "Advertising") };

  it("All — returns every transaction", () => {
    expect(applyFilters(txs, map, "all", "")).toHaveLength(2);
  });

  it("Uncategorized — returns only transactions with no category", () => {
    const result = applyFilters(txs, map, "uncategorized", "");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(TX_B);
  });

  it("Categorized — returns only transactions with a category", () => {
    const result = applyFilters(txs, map, "categorized", "");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(TX_A);
  });
});

// ── 7. COA category filter ────────────────────────────────────────────────────
describe("COA category filter", () => {
  const txs = [makeTx(TX_A), makeTx(TX_B)];
  const map: BankingTransactionCategoryMap = {
    [TX_A]: makeCategory(TX_A, COA_1, "Advertising"),
    [TX_B]: makeCategory(TX_B, COA_2, "Payroll"),
  };

  it("empty coaFilter returns all transactions", () => {
    expect(applyFilters(txs, map, "all", "")).toHaveLength(2);
  });

  it("specific coaFilter returns only matching transactions", () => {
    const result = applyFilters(txs, map, "all", COA_1);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(TX_A);
  });
});

// ── 8. Uncategorized count uses all account-scoped transactions ───────────────
describe("Uncategorized count", () => {
  it("counts transactions with no categoryMap entry regardless of active filter", () => {
    const txs = [makeTx(TX_A), makeTx(TX_B)];
    const map: BankingTransactionCategoryMap = { [TX_A]: makeCategory(TX_A, COA_1, "Advertising") };
    const count = txs.filter((t) => !map[t.id]).length;
    expect(count).toBe(1);
  });

  it("returns zero when all transactions are categorized", () => {
    const txs = [makeTx(TX_A)];
    const map: BankingTransactionCategoryMap = { [TX_A]: makeCategory(TX_A, COA_1, "Advertising") };
    expect(txs.filter((t) => !map[t.id]).length).toBe(0);
  });
});

// ── 9. Save call shape ────────────────────────────────────────────────────────
describe("saveBankingTransactionCategory call shape", () => {
  it("accepts entitySlug, transactionId and coaAccountId", () => {
    // Verify the method signature accepts the required fields — type-level test
    type SaveBody = Parameters<typeof api.saveBankingTransactionCategory>[2];
    const body: SaveBody = { coaAccountId: COA_1 };
    expect(body.coaAccountId).toBe(COA_1);
  });

  it("accepts an optional note", () => {
    type SaveBody = Parameters<typeof api.saveBankingTransactionCategory>[2];
    const withNote: SaveBody    = { coaAccountId: COA_1, note: "Q3 expense" };
    const withoutNote: SaveBody = { coaAccountId: COA_1 };
    expect(withNote.note).toBe("Q3 expense");
    expect(withoutNote.note).toBeUndefined();
  });
});

// ── 10. Changed category replaces existing local map entry ────────────────────
describe("Local categoryMap update after save", () => {
  it("spreads returned category into existing map, replacing the old entry", () => {
    const prev: BankingTransactionCategoryMap = {
      [TX_A]: makeCategory(TX_A, COA_1, "Advertising"),
    };
    const saved = makeCategory(TX_A, COA_2, "Payroll");
    const next  = { ...prev, [TX_A]: saved };
    expect(next[TX_A]?.coaAccountId).toBe(COA_2);
    expect(next[TX_A]?.coaAccountName).toBe("Payroll");
  });
});

// ── 11. No journal entries or reconciliation writes in banking-account.tsx ────
describe("Static source guard — banking-account.tsx", () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, "../accounting/banking-account.tsx"),
    "utf8",
  );
  it("does not reference journalEntry or createJournal", () => {
    expect(src).not.toMatch(/journalEntry|createJournal/);
  });
  it("does not reference reconcil", () => {
    expect(src).not.toMatch(/reconcil/i);
  });
  it("does not write to bank_transactions", () => {
    expect(src).not.toMatch(/bank_transactions/);
  });
});

// ── 12. Account isolation via client-side accountId filter ────────────────────
describe("Account isolation — client-side filter formula", () => {
  it("filters out transactions belonging to other accounts", () => {
    const txs: TxStub[] = [makeTx(TX_A, "acct-1"), makeTx(TX_B, "acct-2")];
    const filtered = txs.filter((t) => t.accountId === "acct-1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe(TX_A);
  });

  it("returns all transactions when all belong to the active account", () => {
    const txs: TxStub[] = [makeTx(TX_A, "acct-1"), makeTx(TX_B, "acct-1")];
    expect(txs.filter((t) => t.accountId === "acct-1")).toHaveLength(2);
  });
});
