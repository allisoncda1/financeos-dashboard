/**
 * Commission module — route-level tests.
 *
 * Mocks are placed before imports to ensure vitest hoisting works correctly.
 * DB mocks return numbers (not strings) because parseNumeric is applied in DB
 * functions that the mocks replace entirely.
 */

// ─── Mocks (must be before imports) ──────────────────────────────────────────

vi.mock("../db/commissions", () => ({
  getCommissionRepresentatives: vi.fn(),
  getAttributionRulesForEntity: vi.fn(),
  getCommissionRules: vi.fn(),
  getCommissionLines: vi.fn(),
  getCommissionLineSummary: vi.fn(),
  createCommissionRule: vi.fn(),
  upsertCommissionLine: vi.fn(),
  approveCommissionLine: vi.fn(),
  lockCommissionPeriod: vi.fn(),
}));

vi.mock("../services/commissionEngine", () => ({
  ingestEntityInvoices: vi.fn(),
  previewRuleApplication: vi.fn(),
  buildFingerprint: vi.fn(),
  applyFormula: vi.fn(),
}));

vi.mock("../services/entityCache", () => ({
  getCachedEntityId: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import request from "supertest";
import express from "express";
import commissionsRouter from "../routes/commissions";
import { requireAuth } from "../auth/middleware";

import {
  getCommissionRepresentatives,
  getCommissionRules,
  getCommissionLines,
  getCommissionLineSummary,
  createCommissionRule,
  approveCommissionLine,
} from "../db/commissions";
import { ingestEntityInvoices, previewRuleApplication } from "../services/commissionEngine";
import { getCachedEntityId } from "../services/entityCache";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ENTITY_ID = "b86bb66e-df81-4d32-8629-3012635ba16a";
const SLUG      = "cardealer_ai";

const mockRep = {
  id: "rep-uuid-jason",
  slug: "jason",
  displayName: "Jason",
  representativeType: "external_rep",
  payoutEligible: true,
  notes: null,
};

const mockHouseRep = {
  id: "rep-uuid-house",
  slug: "house",
  displayName: "House",
  representativeType: "internal_house",
  payoutEligible: false,
  notes: "Direct/house accounts — no external payout",
};

const mockLine = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  entityId: ENTITY_ID,
  invoiceId: "inv-uuid-1",
  invoiceQboId: "QBO-1234",
  invoiceDocNumber: "1234",
  invoiceDate: "2026-05-01",
  customerId: null,
  customerName: "Foray Insure",
  invoiceAmount: 1495,
  invoiceStatus: "Paid",
  representativeId: "rep-uuid-jason",
  representativeSlug: "jason",
  representativeDisplayName: "Jason",
  attributionMatchType: "customer_name_pattern",
  commissionRuleId: null,
  formulaType: null,
  calculationBasis: null,
  commissionRate: null,
  grossProfit: null,
  expensesAmount: null,
  commissionAmount: null,
  lineStatus: "needs_configuration",
  payoutEligible: true,
  exclusionReason: "missing_commission_formula",
  sourceFingerprint: "abc123",
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
  approvedAt: null,
  approvedBy: null,
  lockedAt: null,
  lockedBy: null,
};

const mockHouseLine = {
  ...mockLine,
  id: "line-uuid-house",
  customerName: "Mike Terry Chevrolet",
  representativeId: "rep-uuid-house",
  representativeSlug: "house",
  representativeDisplayName: "House",
  commissionAmount: 0,          // explicit zero — confirmed business rule
  lineStatus: "house_no_commission",
  payoutEligible: false,
  exclusionReason: "internal_house_account",
};

const mockRule = {
  id: "rule-uuid-1",
  entityId: ENTITY_ID,
  representativeId: "rep-uuid-jason",
  coreCustomerId: null,
  customerNamePattern: "Foray%",
  formulaType: "percentage_of_gross_profit",
  calculationBasis: "gross_profit",
  commissionRate: 0.2,
  fixedAmount: null,
  payableTrigger: "invoice_paid",
  ruleVersion: 1,
  status: "active",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  notes: null,
};

// ─── App setup ────────────────────────────────────────────────────────────────

// Bypass real auth in tests
vi.mock("../auth/middleware", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  // Attach a mock user so routes can read req.user
  app.use((req, _res, next) => {
    (req as unknown as Record<string, unknown>).user = { email: "test@financeos.io", name: "Test User" };
    next();
  });
  app.use("/commissions", commissionsRouter);
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /commissions/:slug/representatives", () => {
  beforeEach(() => {
    (getCachedEntityId as Mock).mockResolvedValue(ENTITY_ID);
    (getCommissionRepresentatives as Mock).mockResolvedValue([mockRep, mockHouseRep]);
  });

  it("returns rep list", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/representatives`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].slug).toBe("jason");
  });

  it("404 on invalid slug", async () => {
    const res = await request(makeApp()).get("/commissions/INVALID SLUG/representatives");
    expect(res.status).toBe(404);
  });

  it("404 when entity not found", async () => {
    (getCachedEntityId as Mock).mockResolvedValue(null);
    const res = await request(makeApp()).get(`/commissions/${SLUG}/representatives`);
    expect(res.status).toBe(404);
  });
});

describe("GET /commissions/:slug/lines", () => {
  beforeEach(() => {
    (getCachedEntityId as Mock).mockResolvedValue(ENTITY_ID);
    (getCommissionLines as Mock).mockResolvedValue({ lines: [mockLine, mockHouseLine], total: 2 });
  });

  it("returns lines with correct fields", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const jasonLine = res.body.data[0];
    expect(jasonLine.lineStatus).toBe("needs_configuration");
    expect(jasonLine.payoutEligible).toBe(true);
    expect(jasonLine.commissionAmount).toBeNull();
    expect(jasonLine.exclusionReason).toBe("missing_commission_formula");
  });

  it("House line has commissionAmount=0 and payoutEligible=false", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    const houseLine = res.body.data[1];
    expect(houseLine.lineStatus).toBe("house_no_commission");
    expect(houseLine.commissionAmount).toBe(0);   // explicit zero — not null
    expect(houseLine.payoutEligible).toBe(false);
    expect(houseLine.exclusionReason).toBe("internal_house_account");
  });

  it("House line is present in results (not filtered out)", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    const reps = res.body.data.map((l: { representativeSlug: string }) => l.representativeSlug);
    expect(reps).toContain("house");
  });

  it("DB error returns 500", async () => {
    (getCommissionLines as Mock).mockRejectedValue(new Error("DB failure"));
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(res.status).toBe(500);
  });
});

describe("GET /commissions/:slug/summary", () => {
  beforeEach(() => {
    (getCachedEntityId as Mock).mockResolvedValue(ENTITY_ID);
    (getCommissionLineSummary as Mock).mockResolvedValue([
      { repSlug: "jason", repName: "Jason", payoutEligible: true, lineCount: 5, totalInvoiceAmount: 10000, totalGrossProfit: null, totalCommission: null, needsConfig: 5, needsReview: 0, calculated: 0, approved: 0, locked: 0 },
      { repSlug: "house", repName: "House", payoutEligible: false, lineCount: 20, totalInvoiceAmount: 50000, totalGrossProfit: null, totalCommission: null, needsConfig: 0, needsReview: 0, calculated: 0, approved: 0, locked: 0 },
    ]);
  });

  it("includes House in summary (House must not be excluded)", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/summary`);
    expect(res.status).toBe(200);
    const reps = res.body.data.map((s: { repSlug: string }) => s.repSlug);
    expect(reps).toContain("house");
    expect(reps).toContain("jason");
  });

  it("House row has payoutEligible=false", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/summary`);
    const houseRow = res.body.data.find((s: { repSlug: string }) => s.repSlug === "house");
    expect(houseRow.payoutEligible).toBe(false);
  });
});

describe("GET /commissions/:slug/rules", () => {
  beforeEach(() => {
    (getCachedEntityId as Mock).mockResolvedValue(ENTITY_ID);
    (getCommissionRules as Mock).mockResolvedValue([mockRule]);
  });

  it("returns active rules", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/rules`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].formulaType).toBe("percentage_of_gross_profit");
    expect(res.body.data[0].commissionRate).toBe(0.2);
  });
});

describe("POST /commissions/:slug/rules", () => {
  beforeEach(() => {
    (getCachedEntityId as Mock).mockResolvedValue(ENTITY_ID);
    (createCommissionRule as Mock).mockResolvedValue(mockRule);
  });

  it("creates a valid rule", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/rules`)
      .send({
        representativeId: "rep-uuid-jason",
        customerNamePattern: "Foray%",
        formulaType: "percentage_of_gross_profit",
        calculationBasis: "gross_profit",
        commissionRate: 0.2,
        payableTrigger: "invoice_paid",
        effectiveFrom: "2026-01-01",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.formulaType).toBe("percentage_of_gross_profit");
  });

  it("rejects unknown formula type", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/rules`)
      .send({
        representativeId: "rep-uuid-jason",
        formulaType: "eval_code", // not in allowed list
        payableTrigger: "invoice_paid",
        effectiveFrom: "2026-01-01",
      });
    expect(res.status).toBe(400);
  });

  it("rejects missing representativeId", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/rules`)
      .send({ formulaType: "percentage_of_invoice", payableTrigger: "invoice_paid", effectiveFrom: "2026-01-01" });
    expect(res.status).toBe(400);
  });

  it("rejects missing effectiveFrom", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/rules`)
      .send({ representativeId: "rep-uuid-jason", formulaType: "percentage_of_invoice", payableTrigger: "invoice_paid" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid payableTrigger", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/rules`)
      .send({
        representativeId: "rep-uuid-jason",
        formulaType: "percentage_of_invoice",
        payableTrigger: "auto_pay", // not in allowed list
        effectiveFrom: "2026-01-01",
      });
    expect(res.status).toBe(400);
  });
});

describe("POST /commissions/:slug/rules/preview", () => {
  beforeEach(() => {
    (getCachedEntityId as Mock).mockResolvedValue(ENTITY_ID);
    (previewRuleApplication as Mock).mockResolvedValue({
      lines: [],
      affectedCount: 0,
      projectedTotal: null,
    });
  });

  it("returns preview data", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/rules/preview`)
      .send({
        representativeId: "rep-uuid-jason",
        formulaType: "percentage_of_gross_profit",
        commissionRate: 0.2,
        payableTrigger: "invoice_paid",
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("affectedCount");
  });

  it("rejects unknown formula type in preview", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/rules/preview`)
      .send({
        representativeId: "rep-uuid-jason",
        formulaType: "unknown_formula",
        payableTrigger: "invoice_paid",
      });
    expect(res.status).toBe(400);
  });
});

describe("POST /commissions/:slug/ingest", () => {
  beforeEach(() => {
    (getCachedEntityId as Mock).mockResolvedValue(ENTITY_ID);
    (ingestEntityInvoices as Mock).mockResolvedValue({ entityId: ENTITY_ID, processed: 10, created: 10, updated: 0, errors: [] });
  });

  it("triggers ingest and returns result", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/ingest`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(10);
  });

  it("idempotent — can be called twice without 500", async () => {
    const app = makeApp();
    await request(app).post(`/commissions/${SLUG}/ingest`).send({});
    const res2 = await request(app).post(`/commissions/${SLUG}/ingest`).send({});
    expect(res2.status).toBe(200);
  });
});

describe("POST /commissions/:slug/lines/:id/approve", () => {
  beforeEach(() => {
    (getCachedEntityId as Mock).mockResolvedValue(ENTITY_ID);
    (approveCommissionLine as Mock).mockResolvedValue(undefined);
  });

  it("approves a valid line", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/lines/${mockLine.id}/approve`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects malformed line id", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/lines/not-a-uuid/approve`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("Commission formula engine — no unauthorized formula types", () => {
  it("applyFormula with unknown type returns needs_review, not a calculation", async () => {
    const { applyFormula: realApply } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = realApply(
      { id: "x", entityId: ENTITY_ID, representativeId: "r", coreCustomerId: null, customerNamePattern: null,
        formulaType: "eval_javascript",
        calculationBasis: null, commissionRate: null, fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: 1000, grossProfit: 800, expensesAmount: 200, invoiceStatus: "Paid" }
    );
    expect(result.commissionAmount).toBeNull();
    expect(result.lineStatus).toBe("needs_review");
  });
});

describe("Commission formula engine — GP missing with GP-based rule", () => {
  it("returns needs_review with missing_gross_profit, does NOT fall back to invoice_amount", async () => {
    const { applyFormula: realApply } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = realApply(
      { id: "x", entityId: ENTITY_ID, representativeId: "r", coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_gross_profit",
        calculationBasis: "gross_profit", commissionRate: 0.2, fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: 1000, grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" }
    );
    expect(result.commissionAmount).toBeNull();
    expect(result.lineStatus).toBe("needs_review");
    expect(result.exclusionReason).toBe("missing_gross_profit");
  });
});

describe("Commission formula engine — GP missing with invoice_amount rule", () => {
  it("calculates correctly from invoice_amount even when GP is null", async () => {
    const { applyFormula: realApply } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = realApply(
      { id: "x", entityId: ENTITY_ID, representativeId: "r", coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_invoice",
        calculationBasis: "invoice_amount", commissionRate: 0.1, fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: 1000, grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" }
    );
    expect(result.commissionAmount).toBe(100);
    expect(result.lineStatus).toBe("calculated");
  });
});

describe("House rep — explicit zero, not null", () => {
  it("house formula returns commissionAmount=0 (not null)", async () => {
    const { applyFormula: realApply } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = realApply(
      { id: "x", entityId: ENTITY_ID, representativeId: "r", coreCustomerId: null, customerNamePattern: null,
        formulaType: "no_commission_house",
        calculationBasis: null, commissionRate: null, fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: 5000, grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" }
    );
    expect(result.commissionAmount).toBe(0);
    expect(result.lineStatus).toBe("house_no_commission");
    expect(result.exclusionReason).toBe("internal_house_account");
  });
});
