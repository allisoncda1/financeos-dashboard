/**
 * Accounting route tests — Phase 4 live-data wiring.
 *
 * Verifies that GET /api/accounting/:slug/* routes:
 *  - Return 404 for unknown slugs (entity isolation)
 *  - Return 200 with {ok, data, source: "db"} for valid slugs
 *  - Never return mock data field shapes
 *  - Preserve negative amounts (never silently zeroed)
 *  - Isolate DB calls by entity UUID
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
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

// ─── Minimal Express app that wraps the accounting router ─────────────────────

function buildApp() {
  const app = express();
  // Accounting router uses req.log.error — provide a minimal shim
  app.use((req, _res, next) => {
    (req as unknown as { log: { error: () => void; warn: () => void } }).log = {
      error: () => {},
      warn:  () => {},
    };
    next();
  });
  app.use("/api", accountingRouter);
  return app;
}

const app = buildApp();

// ─── Known entity UUIDs ───────────────────────────────────────────────────────

const UUID: Record<string, string> = {
  CarDealer_ai: "aaaaaaaa-0000-0000-0000-000000000001",
  T3_Marketing:  "aaaaaaaa-0000-0000-0000-000000000002",
  TopMrktr:      "aaaaaaaa-0000-0000-0000-000000000003",
  Smile_More:    "aaaaaaaa-0000-0000-0000-000000000004",
};

afterEach(() => vi.clearAllMocks());

// ─── Slug validation ──────────────────────────────────────────────────────────

describe("Accounting routes — slug validation (entity isolation)", () => {
  const RESOURCES = ["customers", "vendors", "invoices", "accounts", "transactions", "bills"];
  const BAD_SLUGS  = ["unknown", "admin", "__proto__", "T3_marketing"];

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
});

describe("Accounting routes — entity UUID not found in DB", () => {
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

  beforeEach(() => {
    vi.mocked(getCachedEntityId).mockResolvedValue(UUID[SLUG]!);
    vi.mocked(getRecentTransactions).mockResolvedValue([
      {
        id: "tx-1", entityId: UUID[SLUG]!, qboId: "QBO-T1",
        transactionType: "Payment", transactionDate: "2026-07-08",
        amount: -125.00, accountId: null, accountName: "Checking",
        entityRef: null, memo: "Facebook Ads", category: "Advertising",
        currency: "USD", isReconciled: false, isDeleted: false,
        syncedAt: new Date(),
      },
    ] as never);
  });

  it("returns transactions with memo field (schema has memo, not description)", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data[0]?.memo).toBe("Facebook Ads");
    expect(res.body.data[0]?.description).toBeUndefined();
  });

  it("preserves negative amounts", async () => {
    const res = await request(app).get(`/api/accounting/${SLUG}/transactions`);
    expect(res.body.data[0]?.amount).toBe(-125);
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
  it("each slug maps to a distinct entity UUID (no overlap)", () => {
    const uuids = Object.values(UUID);
    expect(new Set(uuids).size).toBe(uuids.length);
  });

  it("CarDealer_ai customers call does not bleed into T3_Marketing vendors", async () => {
    vi.mocked(getCachedEntityId).mockImplementation(async (slug) => UUID[slug] ?? null);
    vi.mocked(getCustomers).mockResolvedValue([] as never);
    vi.mocked(getVendors).mockResolvedValue([] as never);

    await request(app).get("/api/accounting/CarDealer_ai/customers");
    await request(app).get("/api/accounting/T3_Marketing/vendors");

    expect(getCustomers).toHaveBeenCalledWith(UUID["CarDealer_ai"]);
    expect(getVendors).toHaveBeenCalledWith(UUID["T3_Marketing"]);
    expect(getVendors).not.toHaveBeenCalledWith(UUID["CarDealer_ai"]);
  });
});
