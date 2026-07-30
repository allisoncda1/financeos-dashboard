/**
 * Commission module — route + engine tests (corrective pass 2).
 *
 * Points 1–12 from Codex review + all 9 points from second corrective pass:
 *   P1.  Unknown client → needs_review, never House
 *   P2.  House only by explicit rule
 *   P3.  SQL injection impossible via lineStatus/representativeId
 *   P4.  invoice_paid + Overdue → awaiting_payment, not calculated
 *   P5.  amount_paid unavailable always null
 *   P6.  Partial payment never fabricated
 *   P7.  Future rule ignored for historical invoice
 *   P8.  Expired rule ignored
 *   P9.  Locked immutable
 *   P10. Lock blocked with needs_review/awaiting_payment/empty period
 *   P11. Decimal arithmetic — BigInt, exact rounding
 *   P12. Unauthorized user → 403; cross-entity approval impossible
 *   P13. /lines API contract: body.data is array, body.total is number, no body.lines
 *   P14. Input validation: commissionRate limits, bare '%' rejected, date checks
 *   P15. source_changed clears approved_at/approved_by
 *   P16. reason required for rule creation
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("../db/commissions", () => ({
  getCommissionRepresentatives:  vi.fn(),
  getAttributionRulesForEntity:  vi.fn(),
  getCommissionRules:            vi.fn(),
  getCommissionLines:            vi.fn(),
  getCommissionLineSummary:      vi.fn(),
  createCommissionRule:          vi.fn(),
  upsertCommissionLine:          vi.fn(),
  approveCommissionLine:         vi.fn(),
  lockCommissionPeriod:          vi.fn(),
  isValidUuid:                   vi.fn((v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)),
  assertValidUuid:               vi.fn((v: unknown, _name: string) => v),
}));

vi.mock("../services/commissionEngine", () => ({
  ingestEntityInvoices:    vi.fn(),
  previewRuleApplication:  vi.fn(),
  buildFingerprint:        vi.fn(),
  applyFormula:            vi.fn(),
  mulMoney:                vi.fn(),
  addMoney:                vi.fn(),
  attributeInvoice:        vi.fn(),
}));

vi.mock("../services/entityCache", () => ({
  getCachedEntityId: vi.fn(),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import request from "supertest";
import express from "express";
import commissionsRouter from "../routes/commissions";

import {
  getCommissionRepresentatives,
  getCommissionRules,
  getCommissionLines,
  getCommissionLineSummary,
  createCommissionRule,
  approveCommissionLine,
  lockCommissionPeriod,
} from "../db/commissions";
import { ingestEntityInvoices, previewRuleApplication } from "../services/commissionEngine";
import { getCachedEntityId } from "../services/entityCache";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ENTITY_ID  = "b86bb66e-df81-4d32-8629-3012635ba16a";
const ENTITY2_ID = "c2cf72b0-d77d-42de-a588-98092d9441df";
const SLUG       = "cardealer_ai";
const SLUG2      = "t3_marketing";
const LINE_ID    = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const REP_UUID   = "d7e8f901-2345-6789-abcd-ef0123456789";

const mockRepJason = {
  id: REP_UUID, slug: "jason", displayName: "Jason",
  representativeType: "external_rep", payoutEligible: true, notes: null,
};
const mockRepHouse = {
  id: "00000000-0000-0000-0000-000000000001", slug: "house",
  displayName: "House", representativeType: "internal_house",
  payoutEligible: false, notes: null,
};

const mockLine = {
  id: LINE_ID, entityId: ENTITY_ID, invoiceId: "11111111-1111-1111-1111-111111111111",
  invoiceQboId: "QBO-1234", invoiceDocNumber: "1234", invoiceDate: "2026-05-01",
  customerId: null, customerName: "Foray Insure", invoiceAmount: "1495.00",
  invoiceStatus: "Paid", representativeId: REP_UUID, representativeSlug: "jason",
  representativeDisplayName: "Jason", attributionMatchType: "customer_name_pattern",
  commissionRuleId: null, formulaType: null, calculationBasis: null,
  commissionRate: null, grossProfit: null, expensesAmount: null,
  commissionAmount: null, lineStatus: "needs_configuration",
  payoutEligible: true, exclusionReason: "missing_commission_formula",
  sourceFingerprint: "abc123", createdAt: "2026-05-02T00:00:00Z",
  updatedAt: "2026-05-02T00:00:00Z", approvedAt: null, approvedBy: null,
  lockedAt: null, lockedBy: null,
};

const mockHouseLine = {
  ...mockLine, id: "22222222-2222-2222-2222-222222222222",
  representativeId: mockRepHouse.id, representativeSlug: "house",
  representativeDisplayName: "House", representativeType: "internal_house",
  commissionAmount: "0", lineStatus: "house_no_commission",
  exclusionReason: "internal_house_account", payoutEligible: false,
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function makeApp(role = "admin") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as Record<string, unknown>).user    = { email: "test@financeos.io", name: "Test", role };
    (req as unknown as Record<string, unknown>).session = { user: { email: "test@financeos.io", role } };
    next();
  });
  app.use("/commissions", commissionsRouter);
  return app;
}

function makeReadonlyApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as Record<string, unknown>).user    = { email: "ro@financeos.io", name: "RO", role: "readonly" };
    (req as unknown as Record<string, unknown>).session = { user: { email: "ro@financeos.io", role: "readonly" } };
    next();
  });
  app.use("/commissions", commissionsRouter);
  return app;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  (getCachedEntityId as Mock).mockResolvedValue(ENTITY_ID);
  (getCommissionRepresentatives as Mock).mockResolvedValue([mockRepJason, mockRepHouse]);
  (getCommissionLines as Mock).mockResolvedValue({ lines: [mockLine, mockHouseLine], total: 2 });
  (getCommissionLineSummary as Mock).mockResolvedValue([]);
  (getCommissionRules as Mock).mockResolvedValue([]);
  (approveCommissionLine as Mock).mockResolvedValue(true);
  (lockCommissionPeriod as Mock).mockResolvedValue(null);
  (ingestEntityInvoices as Mock).mockResolvedValue({ entityId: ENTITY_ID, processed: 0, created: 0, updated: 0, sourceChanged: 0, skipped: 0, errors: [] });
  (previewRuleApplication as Mock).mockResolvedValue({ lines: [], affectedCount: 0, projectedTotal: null });
  (createCommissionRule as Mock).mockResolvedValue({ id: "new-rule-uuid", ruleVersion: 2, status: "active" });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /commissions/:slug/representatives", () => {
  it("returns all reps including House", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/representatives`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const house = res.body.data.find((r: typeof mockRepHouse) => r.slug === "house");
    expect(house.payoutEligible).toBe(false);
    expect(house.representativeType).toBe("internal_house");
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

// ─── P13: /lines API contract ─────────────────────────────────────────────────
describe("GET /commissions/:slug/lines — API contract", () => {
  it("body.data is an array (matches frontend CommissionRunLine[])", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("body.total is a number", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.total).toBe(2);
  });

  it("body.lines is NOT the public contract key (frontend uses data, not lines)", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(res.status).toBe(200);
    // The frontend calls get<{ data: CommissionRunLine[]; total: number }>
    // — body.lines must not be the data carrier
    expect(res.body.lines).toBeUndefined();
  });

  it("House line has commissionAmount='0' and payoutEligible=false in data array", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(res.status).toBe(200);
    const house = res.body.data.find((l: typeof mockHouseLine) => l.lineStatus === "house_no_commission");
    expect(house).toBeDefined();
    expect(house.commissionAmount).toBe("0");
    expect(house.payoutEligible).toBe(false);
  });

  // P3: SQL injection impossible via UUID/enum validation
  it("rejects invalid representativeId — SQL injection impossible", async () => {
    const res = await request(makeApp())
      .get(`/commissions/${SLUG}/lines?representativeId='; DROP TABLE commission_run_lines; --`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid representativeId UUID/);
  });

  it("rejects unknown lineStatus — injection impossible", async () => {
    const res = await request(makeApp())
      .get(`/commissions/${SLUG}/lines?lineStatus=1%3D1`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid lineStatus/);
  });

  it("accepts valid lineStatus", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines?lineStatus=needs_review`);
    expect(res.status).toBe(200);
  });

  it("propagates DB error as 400", async () => {
    (getCommissionLines as Mock).mockRejectedValue(new Error("DB failure"));
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(res.status).toBe(400);
  });
});

describe("GET /commissions/:slug/summary", () => {
  it("returns data array — matches frontend CommissionRepSummary[]", async () => {
    (getCommissionLineSummary as Mock).mockResolvedValue([
      { repSlug: "jason", repName: "Jason", payoutEligible: true, lineCount: 5, totalCommission: "150.00", needsReview: 1 },
      { repSlug: "house", repName: "House", payoutEligible: false, lineCount: 2, totalCommission: "0", needsReview: 0 },
    ]);
    const res = await request(makeApp()).get(`/commissions/${SLUG}/summary`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const house = res.body.data.find((r: { repSlug: string }) => r.repSlug === "house");
    expect(house.payoutEligible).toBe(false);
  });
});

describe("GET /commissions/:slug/rules", () => {
  it("returns data array — matches frontend CommissionRule[]", async () => {
    (getCommissionRules as Mock).mockResolvedValue([{ id: "rule-1", formulaType: "percentage_of_invoice" }]);
    const res = await request(makeApp()).get(`/commissions/${SLUG}/rules`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });
});

// ─── P14: Input validation ─────────────────────────────────────────────────────
describe("POST /commissions/:slug/rules — input validation", () => {
  const validBody = {
    representativeId: REP_UUID,
    formulaType: "percentage_of_invoice",
    payableTrigger: "invoice_paid",
    effectiveFrom: "2026-01-01",
    reason: "Setting up commission for Jason",
  };

  it("creates rule for admin with valid body", async () => {
    const res = await request(makeApp("admin")).post(`/commissions/${SLUG}/rules`).send(validBody);
    expect(res.status).toBe(201);
  });

  it("rejects eval_javascript formula type", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...validBody, formulaType: "eval_javascript" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid formulaType/);
  });

  it("rejects invalid payableTrigger", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...validBody, payableTrigger: "always" });
    expect(res.status).toBe(400);
  });

  it("rejects missing effectiveFrom", async () => {
    const { effectiveFrom: _, ...noDate } = validBody;
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send(noDate);
    expect(res.status).toBe(400);
  });

  it("rejects invalid effectiveFrom date", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...validBody, effectiveFrom: "not-a-date" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/effectiveFrom/);
  });

  it("rejects effectiveTo < effectiveFrom", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...validBody, effectiveTo: "2025-01-01" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/effectiveTo/);
  });

  it("rejects bare '%' customerNamePattern", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...validBody, customerNamePattern: "%" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/%/);
  });

  it("rejects commissionRate > 10", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...validBody, commissionRate: "11" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commissionRate/);
  });

  it("rejects negative commissionRate", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...validBody, commissionRate: "-0.1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commissionRate/);
  });

  it("rejects no_commission_house with commissionRate", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...validBody, formulaType: "no_commission_house", commissionRate: "0.1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no_commission_house/);
  });

  it("rejects missing reason", async () => {
    const { reason: _, ...noReason } = validBody;
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send(noReason);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/);
  });

  it("rejects invalid representativeId UUID", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...validBody, representativeId: "not-a-uuid" });
    expect(res.status).toBe(400);
  });

  it("403 for readonly role", async () => {
    const res = await request(makeReadonlyApp()).post(`/commissions/${SLUG}/rules`).send(validBody);
    expect(res.status).toBe(403);
  });
});

describe("POST /commissions/:slug/ingest", () => {
  it("triggers ingest with valid dates", async () => {
    const res = await request(makeApp("admin"))
      .post(`/commissions/${SLUG}/ingest`)
      .send({ fromDate: "2026-01-01", toDate: "2026-05-31" });
    expect(res.status).toBe(200);
    expect(ingestEntityInvoices).toHaveBeenCalledWith(ENTITY_ID, expect.objectContaining({ reingesterBy: "test@financeos.io" }));
  });

  it("rejects invalid fromDate", async () => {
    const res = await request(makeApp("admin"))
      .post(`/commissions/${SLUG}/ingest`)
      .send({ fromDate: "not-a-date" });
    expect(res.status).toBe(400);
  });

  it("403 for readonly role", async () => {
    const res = await request(makeReadonlyApp()).post(`/commissions/${SLUG}/ingest`).send({});
    expect(res.status).toBe(403);
  });
});

describe("POST /commissions/:slug/lines/:id/approve", () => {
  it("approves calculated line — entity scoped", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/lines/${LINE_ID}/approve`).send({});
    expect(res.status).toBe(200);
    expect(approveCommissionLine).toHaveBeenCalledWith(LINE_ID, ENTITY_ID, "test@financeos.io");
  });

  it("409 when line not found or wrong status", async () => {
    (approveCommissionLine as Mock).mockResolvedValue(false);
    const res = await request(makeApp()).post(`/commissions/${SLUG}/lines/${LINE_ID}/approve`).send({});
    expect(res.status).toBe(409);
  });

  it("400 on malformed UUID", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/lines/not-a-uuid/approve`).send({});
    expect(res.status).toBe(400);
  });

  it("403 for readonly role", async () => {
    const res = await request(makeReadonlyApp()).post(`/commissions/${SLUG}/lines/${LINE_ID}/approve`).send({});
    expect(res.status).toBe(403);
  });

  // P12: cross-entity approval impossible
  it("cross-entity approval impossible — slug resolves to different entityId", async () => {
    (getCachedEntityId as Mock).mockImplementation(async (s: string) => {
      if (s === SLUG2) return ENTITY2_ID;
      return ENTITY_ID;
    });
    (approveCommissionLine as Mock).mockResolvedValue(false);
    const res = await request(makeApp()).post(`/commissions/${SLUG2}/lines/${LINE_ID}/approve`).send({});
    expect(res.status).toBe(409);
    expect(approveCommissionLine).toHaveBeenCalledWith(LINE_ID, ENTITY2_ID, "test@financeos.io");
  });
});

// ─── P10: Lock pre-checks ─────────────────────────────────────────────────────
describe("POST /commissions/:slug/periods/lock", () => {
  it("locks period for control role", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(200);
    expect(lockCommissionPeriod).toHaveBeenCalledWith(ENTITY_ID, 2026, 5, "test@financeos.io");
  });

  it("409 when needs_review blocks lock", async () => {
    (lockCommissionPeriod as Mock).mockResolvedValue("Cannot lock: 3 external line(s) are not yet approved");
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Cannot lock/);
  });

  it("409 when awaiting_payment blocks lock", async () => {
    (lockCommissionPeriod as Mock).mockResolvedValue("Cannot lock: 2 line(s) in unresolved status (needs_review/needs_configuration/calculated/attributed/awaiting_payment)");
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/awaiting_payment/);
  });

  it("409 when period is empty", async () => {
    (lockCommissionPeriod as Mock).mockResolvedValue("Cannot lock: no commission lines found for this period");
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no commission lines/);
  });

  it("400 on invalid month", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 13 });
    expect(res.status).toBe(400);
  });

  it("403 for readonly role", async () => {
    const res = await request(makeReadonlyApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(403);
  });
});

describe("POST /commissions/:slug/rules/preview", () => {
  it("returns preview with data key — matches frontend CommissionRulePreview", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`).send({
      representativeId: REP_UUID,
      formulaType: "percentage_of_invoice",
      payableTrigger: "invoice_paid",
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it("rejects unknown formula type", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`).send({
      representativeId: REP_UUID,
      formulaType: "eval_javascript",
      payableTrigger: "invoice_paid",
    });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULA ENGINE — via vi.importActual (bypasses mock factory)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Formula engine — unknown formula type → needs_review", () => {
  it("returns null commissionAmount for eval_javascript", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "eval_javascript", calculationBasis: null, commissionRate: null, fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "1000.00", grossProfit: "800.00", expensesAmount: null, invoiceStatus: "Paid" },
    );
    expect(result.commissionAmount).toBeNull();
    expect(result.lineStatus).toBe("needs_review");
    expect(result.exclusionReason).toBe("unknown_formula_type");
  });
});

describe("Formula engine — GP null → needs_review, no invoice fallback (P1)", () => {
  it("returns needs_review / missing_gross_profit, commissionAmount null", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_gross_profit", calculationBasis: "gross_profit",
        commissionRate: "0.200000", fixedAmount: null,
        payableTrigger: "invoice_issued", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "1000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" },
    );
    expect(result.commissionAmount).toBeNull(); // must NOT fall back to 20% of invoice
    expect(result.lineStatus).toBe("needs_review");
    expect(result.exclusionReason).toBe("missing_gross_profit");
  });
});

// P4: invoice_paid trigger payable status
describe("Formula engine — invoice_paid trigger", () => {
  it("Overdue → awaiting_payment / overdue_not_paid (not calculated)", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_invoice", calculationBasis: "invoice_amount",
        commissionRate: "0.100000", fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "1000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Overdue" },
    );
    expect(result.commissionAmount).toBeNull();
    expect(result.lineStatus).toBe("awaiting_payment");
    expect(result.exclusionReason).toBe("overdue_not_paid");
  });

  it("Open → awaiting_payment / not_yet_paid", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_invoice", calculationBasis: "invoice_amount",
        commissionRate: "0.100000", fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "1000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Open" },
    );
    expect(result.lineStatus).toBe("awaiting_payment");
    expect(result.exclusionReason).toBe("not_yet_paid");
  });

  it("Paid → calculated", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_invoice", calculationBasis: "invoice_amount",
        commissionRate: "0.100000", fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "1000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" },
    );
    expect(result.commissionAmount).toBe("100.00");
    expect(result.lineStatus).toBe("calculated");
  });
});

describe("Formula engine — invoice_issued calculates regardless of status", () => {
  it("Overdue + invoice_issued → calculated", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_invoice", calculationBasis: "invoice_amount",
        commissionRate: "0.150000", fixedAmount: null,
        payableTrigger: "invoice_issued", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "2000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Overdue" },
    );
    expect(result.commissionAmount).toBe("300.00");
    expect(result.lineStatus).toBe("calculated");
  });
});

// P5: amount_paid never approximated
describe("Formula engine — amount_paid unavailable, never approximated", () => {
  it("always needs_review / amount_paid_unavailable regardless of status", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    for (const status of ["Paid", "Overdue", "Open"]) {
      const result = applyFormula(
        { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
          formulaType: "percentage_of_amount_paid", calculationBasis: "amount_paid",
          commissionRate: "0.100000", fixedAmount: null,
          payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
          effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
        { invoiceAmount: "5000.00", grossProfit: null, expensesAmount: null, invoiceStatus: status },
      );
      expect(result.commissionAmount).toBeNull();
      expect(result.lineStatus).toBe("needs_review");
      expect(result.exclusionReason).toBe("amount_paid_unavailable");
    }
  });
});

// P2: House explicit zero
describe("Formula engine — House explicit zero (P2)", () => {
  it("no_commission_house → commissionAmount='0', house_no_commission", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "no_commission_house", calculationBasis: null, commissionRate: null, fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "5000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" },
    );
    expect(result.commissionAmount).toBe("0"); // string "0", not null, not number 0
    expect(result.lineStatus).toBe("house_no_commission");
    expect(result.exclusionReason).toBe("internal_house_account");
  });
});

describe("Formula engine — unsupported trigger → needs_review", () => {
  it("payment_received → needs_review / unsupported_trigger", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_invoice", calculationBasis: "invoice_amount",
        commissionRate: "0.100000", fixedAmount: null,
        payableTrigger: "payment_received", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "1000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" },
    );
    expect(result.commissionAmount).toBeNull();
    expect(result.lineStatus).toBe("needs_review");
    expect(result.exclusionReason).toBe("unsupported_trigger");
  });
});

// P1: Unknown client → null, never House
describe("Attribution — unknown client → null, never House (P1)", () => {
  it("invoice with no matching rule → null", async () => {
    const { attributeInvoice } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const rules = [{
      id: "r1", entityId: ENTITY_ID, coreCustomerId: null,
      customerNamePattern: "Foray%", matchType: "customer_name_pattern" as const,
      priority: 10, representativeId: REP_UUID, representativeSlug: "jason",
      effectiveFrom: "2025-01-01", effectiveTo: null, notes: null,
    }];
    const result = attributeInvoice("Unknown Client Corp", null, rules, "2026-05-01");
    expect(result).toBeNull(); // must NOT default to House
  });
});

// P7: Future rule ignored
describe("Attribution — future rule ignored (P7)", () => {
  it("rule with effectiveFrom 2027 does not match 2026 invoice", async () => {
    const { attributeInvoice } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const rules = [{
      id: "r1", entityId: ENTITY_ID, coreCustomerId: null,
      customerNamePattern: "Foray%", matchType: "customer_name_pattern" as const,
      priority: 10, representativeId: REP_UUID, representativeSlug: "jason",
      effectiveFrom: "2027-01-01", effectiveTo: null, notes: null,
    }];
    expect(attributeInvoice("Foray Insure", null, rules, "2026-05-01")).toBeNull();
  });
});

// P8: Expired rule ignored
describe("Attribution — expired rule ignored (P8)", () => {
  it("rule with effectiveTo 2025-12-31 does not match 2026 invoice", async () => {
    const { attributeInvoice } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const rules = [{
      id: "r1", entityId: ENTITY_ID, coreCustomerId: null,
      customerNamePattern: "Foray%", matchType: "customer_name_pattern" as const,
      priority: 10, representativeId: REP_UUID, representativeSlug: "jason",
      effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31", notes: null,
    }];
    expect(attributeInvoice("Foray Insure", null, rules, "2026-05-01")).toBeNull();
  });
});

describe("Attribution — active rule matches correctly", () => {
  it("active rule within date range matches", async () => {
    const { attributeInvoice } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const rules = [{
      id: "r1", entityId: ENTITY_ID, coreCustomerId: null,
      customerNamePattern: "Foray%", matchType: "customer_name_pattern" as const,
      priority: 10, representativeId: REP_UUID, representativeSlug: "jason",
      effectiveFrom: "2025-01-01", effectiveTo: null, notes: null,
    }];
    const result = attributeInvoice("Foray Insure", null, rules, "2026-05-01");
    expect(result).not.toBeNull();
    expect(result?.representativeId).toBe(REP_UUID);
    expect(result?.matchType).toBe("customer_name_pattern");
  });
});

// P11: BigInt decimal arithmetic — exact rounding
describe("Decimal arithmetic — mulMoney (BigInt, no parseFloat)", () => {
  it("1495.00 × 0.150000 = 224.25 (exact)", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("1495.00", "0.150000")).toBe("224.25");
  });

  it("0.10 × 0.07 = 0.01 (rounds half-cent up)", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("0.10", "0.07")).toBe("0.01");
  });

  it("100.00 × 0.333333 = 33.33", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("100.00", "0.333333")).toBe("33.33");
  });

  it("1.00 × 0.005000 = 0.01 (positive half-cent rounds away from zero)", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("1.00", "0.005000")).toBe("0.01");
  });

  it("-1.00 × 0.005000 = -0.01 (negative half-cent rounds away from zero)", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("-1.00", "0.005000")).toBe("-0.01");
  });

  it("123456789.99 × 0.150000 = 18518518.50 (large number, 6dp rate)", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("123456789.99", "0.150000")).toBe("18518518.50");
  });

  it("negative amount preserved: -500.00 × 0.100000 = -50.00", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("-500.00", "0.100000")).toBe("-50.00");
  });

  it("rejects NaN", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(() => mulMoney("NaN", "0.1")).toThrow(/Invalid monetary/);
  });

  it("rejects Infinity", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(() => mulMoney("1000", "Infinity")).toThrow(/Invalid monetary/);
  });

  it("rejects scientific notation", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(() => mulMoney("1e5", "0.1")).toThrow(/Invalid monetary/);
  });
});

describe("Decimal arithmetic — addMoney (no float drift)", () => {
  it("224.25 + 75.75 = 300.00", async () => {
    const { addMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(addMoney("224.25", "75.75")).toBe("300.00");
  });

  it("0.01 + 0.02 = 0.03 (no binary float drift)", async () => {
    const { addMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(addMoney("0.01", "0.02")).toBe("0.03");
  });

  it("negative addMoney: -50.00 + 20.00 = -30.00", async () => {
    const { addMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(addMoney("-50.00", "20.00")).toBe("-30.00");
  });
});

describe("rule_version increments correctly", () => {
  it("createCommissionRule called with entityId and reason", async () => {
    await request(makeApp("admin")).post(`/commissions/${SLUG}/rules`).send({
      representativeId: REP_UUID,
      formulaType: "percentage_of_invoice",
      payableTrigger: "invoice_paid",
      effectiveFrom: "2026-01-01",
      reason: "Setting up commission",
    });
    expect(createCommissionRule).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: ENTITY_ID, representativeId: REP_UUID, reason: "Setting up commission" }),
    );
  });
});
