/**
 * bankingCategories.route.test.ts
 * Mocked HTTP contract tests for the two new categorization routes.
 * DB helpers and Core lookups are mocked — no real DB connection required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

// ── Mutable mock state ────────────────────────────────────────────────────────
const { mockUser, mockHasPerm } = vi.hoisted(() => ({
  mockUser:    { value: { id: "user-uuid-001", email: "test@example.com", role: "admin" } as Record<string,unknown> | null },
  mockHasPerm: { value: true },
}));

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock("pg",    () => ({ Pool: vi.fn(() => ({ query: vi.fn() })) }));
vi.mock("plaid", () => ({ CountryCode: {}, Products: {} }));
vi.mock("jose",  () => ({ importJWK: vi.fn(), jwtVerify: vi.fn(), decodeProtectedHeader: vi.fn() }));
vi.mock("../lib/plaidClient",     () => ({ plaidClient: { linkTokenCreate: vi.fn() } }));
vi.mock("../lib/plaidEncryption", () => ({ encryptAccessToken: vi.fn(), decryptAccessToken: vi.fn() }));
vi.mock("../services/consentService", () => ({
  PLAID_CONSENT_TEXT: "", CURRENT_PRIVACY_POLICY_VERSION: "1",
  consentTextHash: vi.fn(() => "hash"), buildConsentRecord: vi.fn(),
}));
vi.mock("../services/institutionMetaService", () => ({ fetchInstitutionMeta: vi.fn() }));
vi.mock("../lib/plaidEntityValidation", () => ({
  validateEntitySlug: (v: unknown) => {
    if (!v || typeof v !== "string") throw new Error("invalid");
    return v;
  },
}));
vi.mock("../auth/middleware", () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!mockUser.value) return res.status(401).json({ ok: false, error: "Unauthorized" });
    (req as unknown as Record<string,unknown>)["session"] = { user: mockUser.value };
    next();
    return;
  },
}));
vi.mock("../auth/permissions", () => ({
  requirePermission: (_perm: string) =>
    (_req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!mockHasPerm.value) return res.status(403).json({ ok: false, error: "Forbidden" });
      next();
      return;
    },
  hasPermission: () => mockHasPerm.value,
}));
vi.mock("../services/entityCache",   () => ({ getCachedEntityId: vi.fn() }));
vi.mock("../db/bankingCategories",   () => ({
  getCategoryMap: vi.fn(), verifyTransactionEntity: vi.fn(), upsertCategory: vi.fn(),
}));
vi.mock("../db/accounts", () => ({ getAllAccounts: vi.fn() }));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { getCachedEntityId }                                       from "../services/entityCache";
import { getCategoryMap, verifyTransactionEntity, upsertCategory } from "../db/bankingCategories";
import { getAllAccounts }                                           from "../db/accounts";
import plaidRouter                                                 from "../routes/plaid";

const mockGetEntityId = getCachedEntityId          as ReturnType<typeof vi.fn>;
const mockGetMap      = getCategoryMap             as ReturnType<typeof vi.fn>;
const mockVerifyTx    = verifyTransactionEntity    as ReturnType<typeof vi.fn>;
const mockUpsert      = upsertCategory             as ReturnType<typeof vi.fn>;
const mockGetAccounts = getAllAccounts              as ReturnType<typeof vi.fn>;

// ── Test app ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use((req: express.Request, _res, next) => {
  (req as unknown as Record<string,unknown>)["log"] = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
  next();
});
app.use("/api", plaidRouter);

// ── Fixtures ──────────────────────────────────────────────────────────────────
const SLUG      = "cardealer_ai";
const ENTITY_ID = "b86bb66e-df81-4d32-8629-3012635ba16a";
const TX_ID     = "plaid-tx-aaa";
const COA_ID    = "coa-acct-123";
const SAVED     = { plaidTransactionId: TX_ID, entitySlug: SLUG, coaAccountId: COA_ID,
                    coaAccountName: "Advertising", coaAccountType: "Expense",
                    categorizedBy: "user-uuid-001", note: null,
                    updatedAt: "2026-08-01T00:00:00.000Z" };
const BODY      = { entitySlug: SLUG, coaAccountId: COA_ID };
const PATCH_URL = `/api/plaid/transactions/${TX_ID}/category`;
const GET_URL   = `/api/plaid/transaction-categories?entitySlug=${SLUG}`;

function setAuth(user = { id: "user-uuid-001", email: "test@example.com", role: "admin" }) {
  mockUser.value    = user;
  mockHasPerm.value = true;
}
function clearAuth() { mockUser.value    = null; }
function noPerm()    { mockHasPerm.value = false; }

beforeEach(() => {
  vi.clearAllMocks();
  setAuth();
  mockGetEntityId.mockResolvedValue(ENTITY_ID);
  mockVerifyTx.mockResolvedValue("ok");
  mockGetAccounts.mockResolvedValue([{ id: COA_ID, name: "Advertising", accountType: "Expense" }]);
  mockUpsert.mockResolvedValue(SAVED);
  mockGetMap.mockResolvedValue({});
});

// ── GET /api/plaid/transaction-categories ─────────────────────────────────────
describe("GET /plaid/transaction-categories", () => {
  it("401 when unauthenticated", async () => {
    clearAuth();
    const res = await supertest(app).get(GET_URL);
    expect(res.status).toBe(401);
    expect(mockGetMap).not.toHaveBeenCalled();
  });

  it("403 without banking permission", async () => {
    noPerm();
    const res = await supertest(app).get(GET_URL);
    expect(res.status).toBe(403);
    expect(mockGetMap).not.toHaveBeenCalled();
  });

  it("400 when more than 200 txIds supplied", async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `tx-${i}`).join(",");
    const res = await supertest(app).get(`${GET_URL}&txIds=${ids}`);
    expect(res.status).toBe(400);
    expect(mockGetMap).not.toHaveBeenCalled();
  });

  it("returns category map for valid request", async () => {
    mockGetMap.mockResolvedValueOnce({ [TX_ID]: SAVED });
    const res = await supertest(app).get(`${GET_URL}&txIds=${TX_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data[TX_ID]).toMatchObject({ coaAccountId: COA_ID });
    expect(mockGetMap).toHaveBeenCalledWith(SLUG, [TX_ID]);
  });
});

// ── PATCH /api/plaid/transactions/:txId/category ──────────────────────────────
describe("PATCH /plaid/transactions/:txId/category", () => {
  it("401 when unauthenticated", async () => {
    clearAuth();
    const res = await supertest(app).patch(PATCH_URL).send(BODY);
    expect(res.status).toBe(401);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("403 without banking permission — no upsert", async () => {
    noPerm();
    const res = await supertest(app).patch(PATCH_URL).send(BODY);
    expect(res.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("404 when entity cannot be resolved", async () => {
    mockGetEntityId.mockResolvedValueOnce(null);
    const res = await supertest(app).patch(PATCH_URL).send(BODY);
    expect(res.status).toBe(404);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("404 when transaction does not exist — no upsert", async () => {
    mockVerifyTx.mockResolvedValueOnce("not_found");
    const res = await supertest(app).patch(PATCH_URL).send(BODY);
    expect(res.status).toBe(404);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("403 for cross-entity transaction — no upsert", async () => {
    mockVerifyTx.mockResolvedValueOnce("wrong_entity");
    const res = await supertest(app).patch(PATCH_URL).send(BODY);
    expect(res.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("400 for nonexistent COA account — no upsert", async () => {
    mockGetAccounts.mockResolvedValueOnce([{ id: "other-id", name: "Other", accountType: "Income" }]);
    const res = await supertest(app).patch(PATCH_URL).send(BODY);
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("400 for COA account belonging to another entity — no upsert", async () => {
    mockGetAccounts.mockResolvedValueOnce([]);
    const res = await supertest(app).patch(PATCH_URL).send(BODY);
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("200 for valid transaction + same-entity COA — saved", async () => {
    const res = await supertest(app).patch(PATCH_URL).send(BODY);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toMatchObject({ coaAccountId: COA_ID });
    expect(mockUpsert).toHaveBeenCalledOnce();
  });

  it("client-supplied coaAccountName and coaAccountType are ignored", async () => {
    mockGetAccounts.mockResolvedValueOnce([{ id: COA_ID, name: "Advertising", accountType: "Expense" }]);
    await supertest(app).patch(PATCH_URL).send({ ...BODY, coaAccountName: "INJECTED", coaAccountType: "INJECTED" });
    const call = mockUpsert.mock.calls[0][0] as Record<string,unknown>;
    expect(call["coaAccountName"]).toBe("Advertising");
    expect(call["coaAccountType"]).toBe("Expense");
  });

  it("categorizedBy uses session user.id — not email", async () => {
    setAuth({ id: "alice-uuid", email: "alice@example.com", role: "admin" });
    await supertest(app).patch(PATCH_URL).send(BODY);
    const call = mockUpsert.mock.calls[0][0] as Record<string,unknown>;
    expect(call["categorizedBy"]).toBe("alice-uuid");
  });

  it("changing a category calls the same upsert path with a different COA", async () => {
    const COA_ID_2 = "coa-acct-456";
    // First save — COA_ID / Advertising from beforeEach mock
    await supertest(app).patch(PATCH_URL).send(BODY);
    // Second save — genuinely different same-entity account
    mockGetAccounts.mockResolvedValueOnce([
      { id: COA_ID_2, name: "Payroll", accountType: "Expense" },
    ]);
    mockUpsert.mockResolvedValueOnce({ ...SAVED, coaAccountId: COA_ID_2, coaAccountName: "Payroll" });
    await supertest(app).patch(PATCH_URL).send({ ...BODY, coaAccountId: COA_ID_2 });
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    const secondCall = mockUpsert.mock.calls[1][0] as Record<string,unknown>;
    expect(secondCall["coaAccountId"]).toBe(COA_ID_2);
    expect(secondCall["coaAccountName"]).toBe("Payroll");
    expect(secondCall["coaAccountType"]).toBe("Expense");
  });

  it("does not UPDATE bank_transactions", async () => {
    await supertest(app).patch(PATCH_URL).send(BODY);
    expect(mockVerifyTx).toHaveBeenCalledWith(TX_ID, SLUG);
    const call = mockUpsert.mock.calls[0][0] as Record<string,unknown>;
    expect(call).not.toHaveProperty("bank_transactions");
  });

  it("does not create journal or reconciliation records", async () => {
    const res = await supertest(app).patch(PATCH_URL).send(BODY);
    expect(res.body).not.toHaveProperty("journalEntry");
    expect(res.body).not.toHaveProperty("reconciled");
    const call = mockUpsert.mock.calls[0][0] as Record<string,unknown>;
    expect(call).not.toHaveProperty("reconciled");
  });
});
