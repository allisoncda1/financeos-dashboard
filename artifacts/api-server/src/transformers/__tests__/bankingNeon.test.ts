import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({
  AccountsService: { getBankAccounts: vi.fn() },
  TransactionsService: {
    getRecentTransactions: vi.fn(),
    getUnreconciledCount: vi.fn(),
  },
}));

vi.mock("../../services/entityCache", () => ({ getCachedEntityId: vi.fn() }));

import { AccountsService, TransactionsService } from "../../db";
import { getCachedEntityId } from "../../services/entityCache";
import { transformBankingNeon } from "../bankingNeon";

const bank = {
  id: "bank-1", name: "Mercury Checking (7627) - 1", accountType: "Bank",
  accountSubtype: "Checking", currentBalance: 1000,
};
const card = {
  id: "card-1", name: "Business Gold Card (1001) - 3", accountType: "Credit Card",
  accountSubtype: "CreditCard", currentBalance: 250,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedEntityId).mockResolvedValue("entity-1");
  vi.mocked(AccountsService.getBankAccounts).mockResolvedValue([bank, card] as never);
  vi.mocked(TransactionsService.getUnreconciledCount).mockResolvedValue(1);
  vi.mocked(TransactionsService.getRecentTransactions).mockResolvedValue([
    { id: "txn-bank", accountId: "bank-1", transactionDate: "2026-07-12", memo: "Deposit", entityRef: null, transactionType: "Deposit", amount: 500, category: null, accountName: "Mercury", isReconciled: true },
    { id: "txn-card", accountId: "card-1", transactionDate: "2026-07-11", memo: "Software", entityRef: null, transactionType: "CreditCardCharge", amount: 100, category: "Software", accountName: "Business Gold", isReconciled: false },
  ] as never);
});

describe("transformBankingNeon — RC-006 credit-card visibility", () => {
  it("includes Bank and Credit Card accounts", async () => {
    const result = await transformBankingNeon("CarDealer_ai", "2026-07-12");
    expect(result.accounts.map((a) => a.id)).toEqual(["bank-1", "card-1"]);
  });

  it("labels the card as Credit Card rather than its internal subtype", async () => {
    const result = await transformBankingNeon("CarDealer_ai", "2026-07-12");
    expect(result.accounts.find((a) => a.id === "card-1")?.account_type).toBe("Credit Card");
  });

  it("keeps credit-card liabilities out of total_cash", async () => {
    const result = await transformBankingNeon("CarDealer_ai", "2026-07-12");
    expect(result.total_cash).toBe(1000);
  });

  it("includes transactions linked to credit-card accounts", async () => {
    const result = await transformBankingNeon("CarDealer_ai", "2026-07-12");
    expect(result.transactions.map((t) => t.id)).toContain("txn-card");
  });

  it("preserves existing reconciliation status logic", async () => {
    const result = await transformBankingNeon("CarDealer_ai", "2026-07-12");
    expect(result.reconciliation_status).toBe("pending");
  });
});
