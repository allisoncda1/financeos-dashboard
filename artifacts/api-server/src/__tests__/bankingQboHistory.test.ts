import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query, release }));
  return { query, release, connect };
});

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({ connect: mocks.connect })),
}));

import { importHistoricalQboMatches } from "../db/bankingQboHistory";

const line = {
  lineIndex: 0,
  detailType: "PurchaseLineDetail",
  coaAccountId: "account-1",
  coaAccountName: "Advertising & Marketing",
  coaAccountType: null,
  qboClassId: null,
  qboClassName: null,
  lineAmount: 100,
  memo: null,
  rawLine: { Amount: 100 },
};

const match = {
  plaidTransactionId: "plaid-1",
  qboId: "qbo-1",
  qboObjectType: "Purchase",
  dateDeltaDays: 1,
  confidence: 0.95,
  lines: [line],
};

beforeEach(() => {
  mocks.query.mockReset();
  mocks.release.mockReset();
  mocks.connect.mockClear();

  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes("bank_transaction_categories")) {
      return { rows: [] };
    }
    if (sql.includes("RETURNING id")) {
      return { rows: [{ id: "match-uuid-1" }] };
    }
    return { rows: [] };
  });
});

describe("importHistoricalQboMatches", () => {
  it("does not connect for an empty batch", async () => {
    const result = await importHistoricalQboMatches({
      entitySlug: "CarDealer_ai",
      importedBy: "user-1",
      matches: [],
    });

    expect(result.importedMatchCount).toBe(0);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("imports a match and its exact QBO line", async () => {
    const result = await importHistoricalQboMatches({
      entitySlug: "CarDealer_ai",
      importedBy: "user-1",
      matches: [match],
    });

    expect(result).toEqual({
      requestedMatchCount: 1,
      importedMatchCount: 1,
      importedLineCount: 1,
      manualCategoryExcluded: 0,
    });

    const sql = mocks.query.mock.calls
      .map((call) => String(call[0]))
      .join("\n");

    expect(sql).toContain("SERIALIZABLE");
    expect(sql).toContain("bank_transaction_qbo_matches");
    expect(sql).toContain("bank_transaction_qbo_lines");
    expect(sql).toContain("COMMIT");
  });

  it("protects manual FinanceOS categories", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("bank_transaction_categories")) {
        return {
          rows: [{
            plaid_transaction_id: "plaid-1",
          }],
        };
      }
      return { rows: [] };
    });

    const result = await importHistoricalQboMatches({
      entitySlug: "CarDealer_ai",
      importedBy: "user-1",
      matches: [match],
    });

    expect(result.importedMatchCount).toBe(0);
    expect(result.manualCategoryExcluded).toBe(1);

    const sql = mocks.query.mock.calls
      .map((call) => String(call[0]))
      .join("\n");

    expect(sql).not.toContain(
      "INSERT INTO bank_transaction_qbo_matches",
    );
  });

  it("rolls back the complete batch on failure", async () => {
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes("bank_transaction_categories")) {
        return { rows: [] };
      }
      if (sql.includes("bank_transaction_qbo_matches")) {
        throw new Error("forced failure");
      }
      return { rows: [] };
    });

    await expect(
      importHistoricalQboMatches({
        entitySlug: "CarDealer_ai",
        importedBy: "user-1",
        matches: [match],
      }),
    ).rejects.toThrow("forced failure");

    expect(mocks.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mocks.release).toHaveBeenCalled();
  });

  it("rejects duplicate Plaid transaction IDs", async () => {
    await expect(
      importHistoricalQboMatches({
        entitySlug: "CarDealer_ai",
        importedBy: "user-1",
        matches: [match, match],
      }),
    ).rejects.toThrow("duplicate plaidTransactionId");

    expect(mocks.connect).not.toHaveBeenCalled();
  });
});
