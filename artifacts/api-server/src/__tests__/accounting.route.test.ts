/**
 * Accounting route tests — Phase 4 live-data wiring + permission enforcement.
 *
 * Verifies that GET /api/accounting/:slug/* routes:
 *  - Require authentication (401 without session)
 *  - Enforce resource-specific permissions (403 for wrong role)
 *  - Return 404 for unknown slugs (entity isolation)
 *  - Return 404 when entity UUID not found
 *  - Return 200 with {ok, data, source: "db"} for authorised valid slugs
 *  - Never return mock data field shapes
 *  - Preserve null amounts (not coerced to 0)
 *  - Preserve negative amounts
 *  - Isolate DB calls by entity UUID
 *  - Accept case-insensitive slug matching (lowercase aliases of mixed-case slugs)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

// ─── Mock DB services BEFORE importing accounting router ─────────────────────

vi.mock("../db/customers", () => ({ getCustomers: vi.fn() }));
vi.mock("../db/vendors",   () => ({ getVendors: vi.fn() }));
vi.mock("../db/invoices",  () => ({
  getOpenInvoices:      vi.fn(),
  getAllInvoices:        vi.fn(),
  getArAgingBuckets:    vi.fn(),
  getTopCustomersByAr:  vi.fn(),
  computeDso:           vi.fn(),
  getInvoiceById:       vi.fn(),
}));
vi.mock("../db/accounts",  () => ({
  getBankAccounts:      vi.fn(),
  getAccountsByType:    vi.fn(),
  getAllAccounts:        vi.fn(),
}));
vi.mock("../db/transactions", () => ({
  getRecentTransactions:     vi.fn(),
  getTransactionsByAccount:  vi.fn(),
  getUnreconciledCount:      vi.fn(),
}));
vi.mock("../db/bills", () => ({
  getOpenBills:         vi.fn(),
  getApAgingBuckets:    vi.fn(),
  getTopVendorsByAp:    vi.fn(),
}));
vi.mock("../services/entityCache", () => ({ getCachedEntityId: vi.fn() }));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { getCustomers } from "../db/customers";
import { getVendors }   from "../db/vendors";
import { getAllInvoices } from "../db/invoices";
import { getAllAccounts } from "../db/accounts";
import { getRecentTransactions } from "../db/transactions";
import { getOpenBills } from "../db/bills";
import { getCachedEntityId } from "../services/entityCache";
import accountingRouter from "../routes/accounting";

// ─── Test session users ───────────────────────────────────────────────────────

const ADMIN_USER   = { id: "u-admin", email: "admin@test.com",  role: "admin",     name: "Admin" };
const CFO_USER     = { id: "u-cfo",   email: "cfo@test.com",    role: "cfo",       name: "CFO" };
const BOOKKEEPER   = { id: "u-bk",    email: "bk@test.com",     role: "bookkeeper",name: "BK" };
const INVESTOR     = { id: "u-inv",   email: "inv@test.com",    role: "investor",  name: "Inv" };
const READONLY     = { id: "u-ro",    email: "ro@test.com",     role: "readonly",  name: "RO" };

type MockUser = typeof ADMIN_USER | typeof INVESTOR | typeof READONLY | null;

// ─── App factory ─────────────────────────────────────────────────────────────

function buildApp(sessionUser: MockUser = ADMIN_USER) {
  const app = express();

  // req.log shim (pinoHttp absent in tests)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    (req as unknown as Record<string, unknown>)["log"] = log;
    next();
  });

  // Session injection
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>)["session"] = sessionUser ? { user: sessionUser } : {};
    next();
  });

  app.use("/api", accountingRouter);
  return app;
}

// ─── Known entity UUIDs ───────────────────────────────────────────────────────

const UUID: Record<string, string> = {
  CarDealer_ai: "aaaaaaaa-0000-0000-0000-000000000001",
  T3_Marketing:  "aaaaaaaa-0000-0000-0000-000000000002",
  TopMrktr:      "aaaaaaaa-0000-0000-0000-000000000003",
  Smile_More:    "aaaaaaaa-0000-0000-0000-000000000004",
};

afterEach(() => vi.clearAllMocks());

// ─── Authentication tests ─────────────────────────────────────────────────────

describe("Accounting routes — authentication", () => {
  const noAuthApp = buildApp(null);
  const RESOURCES = ["customers", "vendors", "invoices", "accounts", "transactions", "bills"];

  for (const resource of RESOURCES) {
    it(`/CarDealer_ai/${resource} → 401 without session`, async () => {
      const res = await request(noAuthApp).get(`/api/accounting/CarDealer_ai/${resource}`);
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    });
  }
});

// ─── Permission enforcement tests ────────────────────────────────────────────

describe("Accounting routes — permission enforcement", () => {
  // investor has: dashboard, reports, exports — no customers/vendors/financials/banking
  const investorApp = buildApp(INVESTOR);
  // readonly has: dashboard only
  const readonlyApp = buildApp(READONLY);

  const cases: Array<{ resource: string; slug: string }> = [
    { resource: "customers",    slug: "CarDealer_ai" },
    { resource: "vendors",      slug: "CarDealer_ai" },
    { resource: "invoices",     slug: "CarDealer_ai" },
    { resource: "accounts",     slug: "CarDealer_ai" },
    { resource: "transactions", slug: "CarDealer_ai" },
    { resource: "bills",        slug: "CarDealer_ai" },
  ];

  for (const { resource, slug } of cases) {
    it(`investor: /api/accounting/${slug}/${resource} → 403 (no permission)`, async () => {
      const res = await request(investorApp).get(`/api/accounting/${slug}/${resource}`);
      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
    });

    it(`readonly: /api/accounting/${slug}/${resource} → 403 (no permission)`, async () => {
      const res = await request(readonlyApp).get(`/api/accounting/${slug}/${resource}`);
      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
    });
  }

  it("bookkeeper can access customers", async () => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID["CarDealer_ai"]!);
    vi.mocked(getCustomers).mockResolvedValue([] as never);
    const bkApp = buildApp(BOOKKEEPER);
    const res = await request(bkApp).get("/api/accounting/CarDealer_ai/customers");
    expect(res.status).toBe(200);
  });

  it("bookkeeper can access vendors", async () => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID["CarDealer_ai"]!);
    vi.mocked(getVendors).mockResolvedValue([] as never);
    const bkApp = buildApp(BOOKKEEPER);
    const res = await request(bkApp).get("/api/accounting/CarDealer_ai/vendors");
    expect(res.status).toBe(200);
  });

  it("bookkeeper cannot access invoices (financials permission required)", async () => {
    const bkApp = buildApp(BOOKKEEPER);
    const res = await request(bkApp).get("/api/accounting/CarDealer_ai/invoices");
    expect(res.status).toBe(403);
  });

  it("bookkeeper cannot access accounts (financials permission required)", async () => {
    const bkApp = buildApp(BOOKKEEPER);
    const res = await request(bkApp).get("/api/accounting/CarDealer_ai/accounts");
    expect(res.status).toBe(403);
  });

  it("bookkeeper cannot access transactions (banking permission required)", async () => {
    const bkApp = buildApp(BOOKKEEPER);
    const res = await request(bkApp).get("/api/accounting/CarDealer_ai/transactions");
    expect(res.status).toBe(403);
  });

  it("cfo can access all accounting resources", async () => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID["CarDealer_ai"]!);
    vi.mocked(getCustomers).mockResolvedValue([] as never);
    vi.mocked(getVendors).mockResolvedValue([] as never);
    vi.mocked(getAllInvoices).mockResolvedValue([] as never);
    vi.mocked(getAllAccounts).mockResolvedValue([] as never);
    vi.mocked(getRecentTransactions).mockResolvedValue([] as never);
    vi.mocked(getOpenBills).mockResolvedValue([] as never);
    const cfoApp = buildApp(CFO_USER);
    for (const r of ["customers", "vendors", "invoices", "accounts", "transactions", "bills"]) {
      const res = await request(cfoApp).get(`/api/accounting/CarDealer_ai/${r}`);
      expect(res.status).toBe(200);
    }
  });
});

// ─── Slug validation ──────────────────────────────────────────────────────────

describe("Accounting routes — slug validation (entity isolation)", () => {
  const app = buildApp(ADMIN_USER);
  const RESOURCES = ["customers", "vendors", "invoices", "accounts", "transactions", "bills"];
  // Note: T3_marketing would be VALID (case-insensitive alias for T3_Marketing)
  const BAD_SLUGS  = ["unknown", "admin", "__proto__", "t3marketing"];

  for (const resource of RESOURCES) {
    for (const slug of BAD_SLUGS) {
      it(`GET /api/accounting/${slug}/${resource} → 404`, async () => {
        const res = await request(app).get(`/api/accounting/${slug}/${resource}`);
        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
        expect(getCachedEntityId).not.toHaveBeenCalled();
      });
    }
  }

  it("lowercase slug alias cardealer_ai is accepted (case-insensitive guard)", async () => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID["CarDealer_ai"]!);
    vi.mocked(getCustomers).mockResolvedValue([] as never);
    const res = await request(app).get("/api/accounting/cardealer_ai/customers");
    // Should accept because isValidSlug now does case-insensitive comparison
    expect(res.status).toBe(200);
  });
});

// ─── Entity UUID not found ────────────────────────────────────────────────────

describe("Accounting routes — entity UUID not found in DB", () => {
  const app = buildApp(ADMIN_USER);

  beforeEach(() => {
    vi.mocked(getCachedEntityId).mockResolvedValue(null);
  });

  it("GET /api/accounting/CarDealer_ai/customers → 404 when UUID missing", async () => {
    const res = await request(app).get("/api/accounting/CarDealer_ai/customers");
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(getCustomers).not.toHaveBeenCalled();
  });
});

// ─── Customers ────────────────────────────────────────────────────────────────

describe("GET /api/accounting/:slug/customers", () => {
  const SLUG = "CarDealer_ai";
  const app  = buildApp(CFO_USER);

  beforeEach(() => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID[SLUG]!);
    vi.mocked(getCustomers).mockResolvedValue([
      {
        id: "cust-1", entityId: UUID[SLUG]!, qboId: "QBO-C1",
        displayName: "ABC Corp", email: "abc@example.com", phone: null,
        balance: 5000 as unknown as number, currency: "USD",
        isActive: true, syncedAt: new Date("2026-07-01"),
      },
      {
        id: "cust-2", entityId: UUID[SLUG]!, qboId: "QBO-C2",
        displayName: "XYZ LLC", email: null, phone: null,
        balance: -250 as unknown as number, currency: "USD",
        isActive: false, syncedAt: new Date("2026-07-01"),
      },
    ] as never);
  });

  it("returns 200 with ok:true, source:db, data array", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/customers`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.source).toBe("db");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it("calls getCustomers with the resolved entity UUID", async () => {
    await request(app).get(`/api/accounting/${SLUG}/customers`);
    expect(getCachedEntityId).toHaveBeenCalledWith(SLUG);
    expect(getCustomers).toHaveBeenCalledWith(UUID[SLUG]);
  });

  it("does not include mock fields (invoices, missingInfo, openBalance)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/customers`);
    for (const row of res.body.data as Record<string, unknown>[]) {
      expect(row["invoices"]).toBeUndefined();
      expect(row["missingInfo"]).toBeUndefined();
      expect(row["openBalance"]).toBeUndefined();
    }
  });
});

// ─── Vendors ──────────────────────────────────────────────────────────────────

describe("GET /api/accounting/:slug/vendors", () => {
  const SLUG = "T3_Marketing";
  const app  = buildApp(CFO_USER);

  beforeEach(() => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID[SLUG]!);
    vi.mocked(getVendors).mockResolvedValue([
      {
        id: "vend-1", entityId: UUID[SLUG]!, qboId: "QBO-V1",
        displayName: "Acme Supplies", email: null,
        balance: 1200 as unknown as number, currency: "USD",
        isActive: true, syncedAt: new Date(),
      },
    ] as never);
  });

  it("returns 200 with vendor data for T3_Marketing", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/vendors`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.source).toBe("db");
    expect(res.body.data).toHaveLength(1);
  });

  it("resolves T3_Marketing UUID, not CarDealer_ai", async () => {
    await request(app).get(`/api/accounting/${SLUG}/vendors`);
    expect(getVendors).toHaveBeenCalledWith(UUID["T3_Marketing"]);
    expect(getVendors).not.toHaveBeenCalledWith(UUID["CarDealer_ai"]);
  });

  it("does not include mock fields (ytdSpend, lastPayment, category)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/vendors`);
    for (const row of res.body.data as Record<string, unknown>[]) {
      expect(row["ytdSpend"]).toBeUndefined();
      expect(row["lastPayment"]).toBeUndefined();
      expect(row["category"]).toBeUndefined();
    }
  });
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

describe("GET /api/accounting/:slug/invoices", () => {
  const SLUG = "TopMrktr";
  const app  = buildApp(CFO_USER);

  beforeEach(() => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID[SLUG]!);
    vi.mocked(getAllInvoices).mockResolvedValue([
      {
        id: "inv-1", entityId: UUID[SLUG]!, qboId: "QBO-I1",
        customerId: null, customerName: "Client A",
        invoiceDate: "2026-06-01", dueDate: "2026-07-01",
        amount: 10000, balance: 10000, status: "Open",
        daysOverdue: 19, currency: "USD", memo: null,
        isDeleted: false, syncedAt: new Date(),
      },
      {
        id: "inv-2", entityId: UUID[SLUG]!, qboId: "QBO-I2",
        customerId: null, customerName: "Client B",
        invoiceDate: "2026-05-01", dueDate: "2026-06-01",
        amount: 5000, balance: 0, status: "Paid",
        daysOverdue: -30, currency: "USD", memo: null,
        isDeleted: false, syncedAt: new Date(),
      },
    ] as never);
  });

  it("returns all invoices including zero-balance paid ones", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/invoices`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it("calls getAllInvoices with entity UUID and default limit 200", async () => {
    await request(app).get(`/api/accounting/${SLUG}/invoices`);
    expect(getAllInvoices).toHaveBeenCalledWith(UUID[SLUG], 200);
  });

  it("preserves negative daysOverdue (paid invoices not forced to 0)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/invoices`);
    const paid = (res.body.data as { id: string; daysOverdue: number }[]).find(r => r.id === "inv-2");
    expect(paid?.daysOverdue).toBe(-30);
  });

  it("zero balance is zero (not null, not missing)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/invoices`);
    const paid = (res.body.data as { id: string; balance: number }[]).find(r => r.id === "inv-2");
    expect(paid?.balance).toBe(0);
  });

  it("does not include mock fields (number, customer object, issued)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/invoices`);
    for (const row of res.body.data as Record<string, unknown>[]) {
      expect(row["number"]).toBeUndefined();
      expect(row["issued"]).toBeUndefined();
    }
  });
});

// ─── Chart of Accounts ────────────────────────────────────────────────────────

describe("GET /api/accounting/:slug/accounts", () => {
  const SLUG = "Smile_More";
  const app  = buildApp(CFO_USER);

  beforeEach(() => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID[SLUG]!);
    vi.mocked(getAllAccounts).mockResolvedValue([
      {
        id: "acct-1", entityId: UUID[SLUG]!, qboId: "QBO-A1",
        name: "Checking", fullyQualifiedName: "Checking",
        accountType: "Bank", accountSubtype: "Checking",
        classification: "Asset", currentBalance: 48000,
        currency: "USD", isActive: true, isSubAccount: false,
        parentQboId: null, syncedAt: new Date(),
      },
      {
        id: "acct-2", entityId: UUID[SLUG]!, qboId: "QBO-A2",
        name: "Revenue", fullyQualifiedName: "Revenue",
        accountType: "Income", accountSubtype: null,
        classification: "Revenue", currentBalance: -85000,
        currency: "USD", isActive: true, isSubAccount: false,
        parentQboId: null, syncedAt: new Date(),
      },
    ] as never);
  });

  it("returns chart of accounts with correct structure", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/accounts`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it("preserves negative currentBalance for income accounts", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/accounts`);
    const rev = (res.body.data as { id: string; currentBalance: number }[]).find(r => r.id === "acct-2");
    expect(rev?.currentBalance).toBe(-85000);
  });

  it("exposes currentBalance (not mock field 'balance')", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/accounts`);
    for (const row of res.body.data as Record<string, unknown>[]) {
      expect(Object.prototype.hasOwnProperty.call(row, "currentBalance")).toBe(true);
      expect(row["code"]).toBeUndefined();
    }
  });
});

// ─── Transactions ─────────────────────────────────────────────────────────────

describe("GET /api/accounting/:slug/transactions", () => {
  const SLUG = "CarDealer_ai";
  const app  = buildApp(CFO_USER);

  beforeEach(() => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID[SLUG]!);
    vi.mocked(getRecentTransactions).mockResolvedValue([
      {
        id: "tx-1", entityId: UUID[SLUG]!, qboId: "QBO-T1",
        transactionType: "Payment", transactionDate: "2026-07-08",
        // amount is an unsigned magnitude (positive) from the transactions table
        amount: 125, accountId: null, accountName: "Checking",
        entityRef: null, memo: "Facebook Ads", category: "Advertising",
        currency: "USD", isReconciled: false, isDeleted: false,
        syncedAt: new Date(),
      },
      {
        id: "tx-2", entityId: UUID[SLUG]!, qboId: "QBO-T2",
        transactionType: "Purchase", transactionDate: "2026-07-09",
        // null amount — must stay null, not become 0
        amount: null, accountId: null, accountName: "Checking",
        entityRef: null, memo: null, category: null,
        currency: "USD", isReconciled: false, isDeleted: false,
        syncedAt: new Date(),
      },
    ] as never);
  });

  it("returns transactions with memo field (not description)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data[0]?.memo).toBe("Facebook Ads");
    expect(res.body.data[0]?.description).toBeUndefined();
  });

  it("unsigned amount preserved as positive (not negated)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/transactions`);
    // amounts are unsigned magnitudes; direction in transactionType
    expect(res.body.data[0]?.amount).toBe(125);
  });

  it("null amount preserved as null (not coerced to 0)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/transactions`);
    expect(res.body.data[1]?.amount).toBeNull();
  });

  it("does not include mock fields (confidence, confidenceColor, suggestedCategory)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/transactions`);
    for (const row of res.body.data as Record<string, unknown>[]) {
      expect(row["confidence"]).toBeUndefined();
      expect(row["confidenceColor"]).toBeUndefined();
      expect(row["suggestedCategory"]).toBeUndefined();
    }
  });
});

// ─── Bills ────────────────────────────────────────────────────────────────────

describe("GET /api/accounting/:slug/bills", () => {
  const SLUG = "T3_Marketing";
  const app  = buildApp(CFO_USER);

  beforeEach(() => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID[SLUG]!);
    vi.mocked(getOpenBills).mockResolvedValue([
      {
        id: "bill-1", entityId: UUID[SLUG]!, qboId: "QBO-B1",
        vendorId: null, vendorName: "Cloud Host Inc",
        billDate: "2026-07-01", dueDate: "2026-07-31",
        amount: 3200, balance: 3200, status: "Open",
        daysOverdue: 0, currency: "USD", memo: "July hosting",
        isDeleted: false, syncedAt: new Date(),
      },
    ] as never);
  });

  it("returns open bills for T3_Marketing", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/bills`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]?.vendorName).toBe("Cloud Host Inc");
  });

  it("isolates bills to T3_Marketing UUID", async () => {
    await request(app).get(`/api/accounting/${SLUG}/bills`);
    expect(getOpenBills).toHaveBeenCalledWith(UUID["T3_Marketing"]);
    expect(getOpenBills).not.toHaveBeenCalledWith(UUID["CarDealer_ai"]);
  });
});

// ─── Cross-entity isolation ───────────────────────────────────────────────────

describe("Entity isolation — same route, different slugs", () => {
  const app = buildApp(ADMIN_USER);

  it("each slug maps to a distinct entity UUID (no overlap)", () => {
    const uuids = Object.values(UUID);
    expect(new Set(uuids).size).toBe(uuids.length);
  });

  it("CarDealer_ai customers call does not bleed into T3_Marketing vendors", async () => {
    vi.mocked(getCachedEntityId).mockImplementation(async (slug) => UUID[slug] ?? UUID[slug.toLowerCase().replace(/_([a-z])/g, (_, c: string) => `_${c}`)] ?? null);
    vi.mocked(getCustomers).mockResolvedValue([] as never);
    vi.mocked(getVendors).mockResolvedValue([] as never);

    await request(app).get("/api/accounting/CarDealer_ai/customers");
    await request(app).get("/api/accounting/T3_Marketing/vendors");

    expect(getCustomers).toHaveBeenCalledWith(UUID["CarDealer_ai"]);
    expect(getVendors).toHaveBeenCalledWith(UUID["T3_Marketing"]);
    expect(getVendors).not.toHaveBeenCalledWith(UUID["CarDealer_ai"]);
  });
});

// ─── Null / zero / edge-case data ────────────────────────────────────────────

describe("Null, zero, and edge-case data correctness", () => {
  const app = buildApp(CFO_USER);

  beforeEach(() => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID["CarDealer_ai"]!);
  });

  it("zero invoice balance stays zero, not null", async () => {
    vi.mocked(getAllInvoices).mockResolvedValue([
      {
        id: "inv-paid", entityId: UUID["CarDealer_ai"]!, qboId: "QBO-Z",
        customerName: "Paid Client", invoiceDate: "2026-01-01", dueDate: "2026-02-01",
        amount: 1000, balance: 0, status: "Paid",
        daysOverdue: -30, currency: "USD", memo: null, isDeleted: false, syncedAt: new Date(),
      },
    ] as never);
    const res = await request(app).get("/api/accounting/CarDealer_ai/invoices");
    expect(res.status).toBe(200);
    const paid = res.body.data[0];
    expect(paid.balance).toBe(0);
    expect(paid.balance).not.toBeNull();
  });

  it("negative customer balance (credit) preserved, not forced to zero", async () => {
    vi.mocked(getCustomers).mockResolvedValue([
      {
        id: "cust-credit", entityId: UUID["CarDealer_ai"]!, qboId: "QBO-CR",
        displayName: "Credit Customer", email: null, phone: null,
        balance: -500 as unknown as number, currency: "USD",
        isActive: true, syncedAt: new Date(),
      },
    ] as never);
    const res = await request(app).get("/api/accounting/CarDealer_ai/customers");
    expect(res.status).toBe(200);
    expect(res.body.data[0].balance).toBe(-500);
  });

  it("null transaction amount preserved as null (not coerced to 0)", async () => {
    vi.mocked(getRecentTransactions).mockResolvedValue([
      {
        id: "tx-null", entityId: UUID["CarDealer_ai"]!, qboId: null,
        transactionType: "Purchase", transactionDate: "2026-07-01",
        amount: null, accountId: null, accountName: null,
        entityRef: null, memo: null, category: null,
        currency: "USD", isReconciled: false, isDeleted: false, syncedAt: new Date(),
      },
    ] as never);
    const res = await request(app).get("/api/accounting/CarDealer_ai/transactions");
    expect(res.status).toBe(200);
    expect(res.body.data[0].amount).toBeNull();
  });

  it("empty data array is distinct from unavailable entity (200 vs 404)", async () => {
    vi.mocked(getCustomers).mockResolvedValue([] as never);
    const res = await request(app).get("/api/accounting/CarDealer_ai/customers");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    // Distinct from entity-not-found 404
    vi.mocked(getCachedEntityId).mockResolvedValue(null);
    const res2 = await request(app).get("/api/accounting/CarDealer_ai/customers");
    expect(res2.status).toBe(404);
  });
});
