import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({ query: mockQuery })),
}));

import {
  getCategoryMap,
  verifyTransactionEntity,
  upsertCategory,
} from "../db/bankingCategories";

const SLUG = "cardealer_ai";
const TX1  = "plaid-tx-aaa";
const TX2  = "plaid-tx-bbb";
const COA  = "coa-acct-123";
const USER = "user-uuid-456";

const SAMPLE_ROW = {
  plaid_transaction_id: TX1,  entity_slug:      SLUG,
  coa_account_id:       COA,  coa_account_name: "Advertising",
  coa_account_type:     "Expense", categorized_by: USER,
  note:                 null, updated_at: "2026-08-01T00:00:00.000Z",
};

const UPSERT_PARAMS = {
  plaidTransactionId: TX1,  entitySlug:     SLUG,
  coaAccountId:       COA,  coaAccountName: "Advertising",
  coaAccountType:     "Expense", categorizedBy: USER, note: null,
};

beforeEach(() => mockQuery.mockReset());

describe("getCategoryMap", () => {
  it("returns empty map and issues no query when txIds is empty", async () => {
    expect(await getCategoryMap(SLUG, [])).toEqual({});
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns map keyed by plaid_transaction_id", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });
    const map = await getCategoryMap(SLUG, [TX1, TX2]);
    expect(map[TX1]).toMatchObject({ coaAccountId: COA, coaAccountName: "Advertising" });
    expect(map[TX2]).toBeUndefined();
  });

  it("passes entitySlug as the first query parameter", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getCategoryMap(SLUG, [TX1]);
    expect((mockQuery.mock.calls[0][1] as unknown[])[0]).toBe(SLUG);
  });

  it("passes all txIds as subsequent parameters", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await getCategoryMap(SLUG, [TX1, TX2]);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params.slice(1)).toEqual([TX1, TX2]);
  });
});

describe("verifyTransactionEntity", () => {
  it("returns not_found when no rows", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await verifyTransactionEntity(TX1, SLUG)).toBe("not_found");
  });

  it("returns wrong_entity when slug does not match", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ entity_slug: "other_entity" }] });
    expect(await verifyTransactionEntity(TX1, SLUG)).toBe("wrong_entity");
  });

  it("returns ok when slug matches", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ entity_slug: SLUG }] });
    expect(await verifyTransactionEntity(TX1, SLUG)).toBe("ok");
  });

  it("issues exactly one query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ entity_slug: SLUG }] });
    await verifyTransactionEntity(TX1, SLUG);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe("upsertCategory", () => {
  it("returns mapped TxCategory on success", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });
    const r = await upsertCategory(UPSERT_PARAMS);
    expect(r).toMatchObject({ plaidTransactionId: TX1, coaAccountId: COA, categorizedBy: USER });
  });

  it("throws when DB returns no row", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(upsertCategory(UPSERT_PARAMS)).rejects.toThrow("DB returned no row");
  });

  it("uses INSERT ON CONFLICT in a single query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });
    await upsertCategory(UPSERT_PARAMS);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("DO UPDATE SET");
  });

  it("never references bank_transactions in the upsert SQL", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });
    await upsertCategory(UPSERT_PARAMS);
    expect(String(mockQuery.mock.calls[0][0])).not.toContain("bank_transactions");
  });

  it("passes categorizedBy as a positional parameter", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });
    await upsertCategory({ ...UPSERT_PARAMS, categorizedBy: "alice-uuid" });
    expect(mockQuery.mock.calls[0][1] as unknown[]).toContain("alice-uuid");
  });

  it("stores caller-verified coaAccountName and coaAccountType — no extra Core query", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });
    await upsertCategory({ ...UPSERT_PARAMS, coaAccountName: "Payroll", coaAccountType: "Expense" });
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain("Payroll");
    expect(params).toContain("Expense");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
