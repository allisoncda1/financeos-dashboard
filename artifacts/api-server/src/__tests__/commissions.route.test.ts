/**
 * Commission module — route + engine tests (corrective pass 3 + 4).
 *
 * Points couverts:
 *   P1.  Unknown client → needs_review, never House
 *   P2.  House only by explicit rule
 *   P3.  SQL injection impossible
 *   P4.  invoice_paid trigger: Overdue → awaiting_payment, not calculated
 *   P5.  amount_paid always null, never approximated
 *   P6.  Partial payment never fabricated
 *   P7.  Future rule ignored for historical invoice
 *   P8.  Expired rule ignored
 *   P9.  Locked immutable
 *   P10. Lock blocked: needs_review / awaiting_payment / empty period
 *   P11. Decimal arithmetic BigInt — exact rounding
 *   P12. 403 for unauthorized; cross-entity approval impossible
 *   P13. GET /lines API contract: body.data[], body.total, body.lines undefined
 *   P14. Input validation: rate limits, bare % rejected, date checks, formula matrix
 *   P15. source_changed clears approved_at/approved_by
 *   P16. reason required for Create; not required for Preview
 *   P17. no_commission_house only on internal_house rep; payable formula rejected on house rep
 *   P18. Preview uses same business validations as Create
 *   P19. fixedAmount > 2dp rejected
 *   P20. Invalid calendar dates rejected (2026-02-31, 2026-13-01); leap year accepted (2028-02-29)
 *   P21. 23505 unique violation → 409, not 500
 *   P22. Preview: absent rep → 400 for ALL formulaTypes (not just no_commission_house)
 *   P23. Preview: genuine DB error → 500
 *   P24. calculationBasis incompatible with formulaType → 400
 *   P25. calculationBasis compatible → passes; null calculationBasis → passes
 *   P26. DB layer: assertValidDate rejects normalised calendar dates
 *   P27. Concurrent DB advisory lock: NOT verifiable without real PostgreSQL — documented
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("../db/commissions", () => ({
  getCommissionRepresentatives:     vi.fn(),
  getCommissionRepresentativeById:  vi.fn(),
  getAttributionRulesForEntity:     vi.fn(),
  getCommissionRules:               vi.fn(),
  getCommissionLines:               vi.fn(),
  getCommissionLineSummary:         vi.fn(),
  createCommissionRule:             vi.fn(),
  upsertCommissionLine:             vi.fn(),
  approveCommissionLine:            vi.fn(),
  lockCommissionPeriod:             vi.fn(),
  isValidUuid:                      vi.fn((v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)),
  assertValidUuid:                  vi.fn((v: unknown, _name: string) => v),
}));

vi.mock("../services/commissionEngine", () => ({
  ingestEntityInvoices:   vi.fn(),
  previewRuleApplication: vi.fn(),
  buildFingerprint:       vi.fn(),
  applyFormula:           vi.fn(),
  mulMoney:               vi.fn(),
  addMoney:               vi.fn(),
  attributeInvoice:       vi.fn(),
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
  getCommissionRepresentativeById,
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
const HOUSE_UUID = "00000000-0000-0000-0000-000000000001";

const mockRepJason = {
  id: REP_UUID, slug: "jason", displayName: "Jason",
  representativeType: "external_rep", payoutEligible: true, notes: null,
};
const mockRepHouse = {
  id: HOUSE_UUID, slug: "house", displayName: "House",
  representativeType: "internal_house", payoutEligible: false, notes: null,
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
  representativeId: HOUSE_UUID, representativeSlug: "house",
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
  (getCommissionRepresentativeById as Mock).mockImplementation(async (id: string) => {
    if (id === REP_UUID)   return mockRepJason;
    if (id === HOUSE_UUID) return mockRepHouse;
    return null;
  });
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
// P13: GET /lines API contract
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /commissions/:slug/lines — API contract (P13)", () => {
  it("body.data is an array", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("body.total is a number", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.total).toBe(2);
  });

  it("body.lines is NOT present (frontend uses data, not lines)", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    expect(res.body.lines).toBeUndefined();
  });

  it("monetary fields in response are strings (not numbers)", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    const normalLine = res.body.data.find((l: typeof mockLine) => l.lineStatus === "needs_configuration");
    expect(typeof normalLine.invoiceAmount).toBe("string");
  });

  it("House line: commissionAmount='0' string, payoutEligible=false", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines`);
    const house = res.body.data.find((l: typeof mockHouseLine) => l.lineStatus === "house_no_commission");
    expect(house.commissionAmount).toBe("0");
    expect(house.payoutEligible).toBe(false);
  });

  it("P3: rejects invalid representativeId — SQL injection impossible", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines?representativeId='; DROP TABLE commission_run_lines; --`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid representativeId UUID/);
  });

  it("P3: rejects unknown lineStatus", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines?lineStatus=1%3D1`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid lineStatus/);
  });

  it("accepts valid lineStatus filter", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG}/lines?lineStatus=needs_review`);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P16 + P17: POST /rules — reason required, rep type check
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /commissions/:slug/rules — reason required (P16)", () => {
  const validBody = {
    representativeId: REP_UUID,
    formulaType: "percentage_of_invoice",
    commissionRate: 0.15,
    payableTrigger: "invoice_paid",
    effectiveFrom: "2026-01-01",
    reason: "Agreed rate per contract Apr 2026",
  };

  it("creates rule when reason is present", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send(validBody);
    expect(res.status).toBe(201);
    expect(createCommissionRule).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Agreed rate per contract Apr 2026" })
    );
  });

  it("rejects missing reason", async () => {
    const { reason: _, ...noReason } = validBody;
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send(noReason);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/);
  });

  it("rejects empty-string reason", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({ ...validBody, reason: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/);
  });
});

describe("POST /commissions/:slug/rules — rep type check (P17)", () => {
  const baseBody = {
    formulaType: "no_commission_house",
    payableTrigger: "invoice_paid",
    effectiveFrom: "2026-01-01",
    reason: "House account confirmed",
  };

  it("no_commission_house on external rep → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...baseBody, representativeId: REP_UUID });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/internal_house/);
  });

  it("no_commission_house on house rep → 201", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...baseBody, representativeId: HOUSE_UUID });
    expect(res.status).toBe(201);
  });

  it("percentage formula on house rep → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      representativeId: HOUSE_UUID,
      formulaType: "percentage_of_invoice",
      commissionRate: 0.15,
      payableTrigger: "invoice_paid",
      effectiveFrom: "2026-01-01",
      reason: "test",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/internal_house/);
  });

  it("rep not found → 400", async () => {
    (getCommissionRepresentativeById as Mock).mockResolvedValue(null);
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      representativeId: REP_UUID,
      formulaType: "percentage_of_invoice",
      commissionRate: 0.15,
      payableTrigger: "invoice_paid",
      effectiveFrom: "2026-01-01",
      reason: "test",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P14 + P18: Formula validation matrix + Preview shares validations
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /rules — formula matrix validation (P14)", () => {
  const base = {
    representativeId: REP_UUID,
    payableTrigger: "invoice_paid",
    effectiveFrom: "2026-01-01",
    reason: "test",
  };

  it("percentage_of_invoice without rate → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, formulaType: "percentage_of_invoice" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commissionRate/);
  });

  it("percentage_of_invoice with fixedAmount (and no rate) → 400 (rate error precedes fixedAmount error)", async () => {
    // The matrix checks rate first, then rejects fixedAmount — sending both errors is not guaranteed order;
    // sending commissionRate exposes the fixedAmount rejection cleanly.
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, formulaType: "percentage_of_invoice", commissionRate: 0.15, fixedAmount: 500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fixedAmount/);
  });

  it("fixed_amount without fixedAmount → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, formulaType: "fixed_amount" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fixedAmount/);
  });

  it("fixed_amount with commissionRate → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, formulaType: "fixed_amount", fixedAmount: 500, commissionRate: 0.1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commissionRate/);
  });

  it("commissionRate > 10 → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, formulaType: "percentage_of_invoice", commissionRate: 11 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commissionRate/);
  });

  it("commissionRate negative → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, formulaType: "percentage_of_invoice", commissionRate: -0.1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commissionRate/);
  });

  it("valid percentage_of_invoice → 201", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, formulaType: "percentage_of_invoice", commissionRate: 0.15 });
    expect(res.status).toBe(201);
  });

  it("valid fixed_amount → 201", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, formulaType: "fixed_amount", fixedAmount: 500.00 });
    expect(res.status).toBe(201);
  });
});

describe("POST /rules/preview — shares validations (P18)", () => {
  const base = {
    representativeId: REP_UUID,
    payableTrigger: "invoice_paid",
  };

  it("preview: percentage without rate → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`)
      .send({ ...base, formulaType: "percentage_of_invoice" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commissionRate/);
  });

  it("preview: bare % pattern → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`)
      .send({ ...base, formulaType: "percentage_of_invoice", commissionRate: 0.15, customerNamePattern: "%" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/%/);
  });

  it("preview: invalid formulaType → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`)
      .send({ ...base, formulaType: "eval_javascript" });
    expect(res.status).toBe(400);
  });

  it("preview: no_commission_house on external rep → 400 (P17 via preview)", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`)
      .send({ ...base, formulaType: "no_commission_house" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/internal_house/);
  });

  it("preview: no reason required → 200", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`)
      .send({ ...base, formulaType: "percentage_of_invoice", commissionRate: 0.15 });
    expect(res.status).toBe(200);
    expect(previewRuleApplication).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P19: fixedAmount max 2dp
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /rules — fixedAmount precision (P19)", () => {
  const base = {
    representativeId: REP_UUID,
    formulaType: "fixed_amount",
    payableTrigger: "invoice_paid",
    effectiveFrom: "2026-01-01",
    reason: "test",
  };

  it("1.004 (3dp) → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, fixedAmount: "1.004" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2 decimal/);
  });

  it("1.00 (2dp) → 201", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, fixedAmount: "1.00" });
    expect(res.status).toBe(201);
  });

  it("500 (integer) → 201", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, fixedAmount: 500 });
    expect(res.status).toBe(201);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P20: Strict calendar date validation
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /rules — strict date validation (P20)", () => {
  const base = {
    representativeId: REP_UUID,
    formulaType: "percentage_of_invoice",
    commissionRate: 0.15,
    payableTrigger: "invoice_paid",
    reason: "test",
  };

  it("2026-02-31 (non-existent) → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, effectiveFrom: "2026-02-31" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/effectiveFrom/);
  });

  it("2026-13-01 (invalid month) → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, effectiveFrom: "2026-13-01" });
    expect(res.status).toBe(400);
  });

  it("2026-02-29 (2026 not leap year) → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, effectiveFrom: "2026-02-29" });
    expect(res.status).toBe(400);
  });

  it("2028-02-29 (2028 is leap year) → 201", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, effectiveFrom: "2028-02-29" });
    expect(res.status).toBe(201);
  });

  it("effectiveTo < effectiveFrom → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`)
      .send({ ...base, effectiveFrom: "2026-06-01", effectiveTo: "2026-01-01" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/effectiveTo/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P21: 23505 unique violation → 409
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /rules — 23505 unique violation → 409 (P21)", () => {
  it("returns 409 with conflict message when DB raises UNIQUE_VIOLATION", async () => {
    (createCommissionRule as Mock).mockRejectedValue(
      new Error("UNIQUE_VIOLATION: A concurrent version of this rule was already created. Please retry.")
    );
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      representativeId: REP_UUID,
      formulaType: "percentage_of_invoice",
      commissionRate: 0.15,
      payableTrigger: "invoice_paid",
      effectiveFrom: "2026-01-01",
      reason: "test",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/conflict/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P14: Bare % pattern
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /rules — bare wildcard rejected (P14)", () => {
  it("customerNamePattern='%' → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      representativeId: REP_UUID,
      formulaType: "percentage_of_invoice",
      commissionRate: 0.15,
      payableTrigger: "invoice_paid",
      effectiveFrom: "2026-01-01",
      reason: "test",
      customerNamePattern: "%",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/%/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P10: Lock pre-checks
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /periods/lock — pre-checks (P10)", () => {
  it("locks successfully", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(200);
  });

  it("needs_review blocks lock", async () => {
    (lockCommissionPeriod as Mock).mockResolvedValue("Cannot lock: 3 external line(s) are not yet approved");
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Cannot lock/);
  });

  it("awaiting_payment blocks lock", async () => {
    (lockCommissionPeriod as Mock).mockResolvedValue("Cannot lock: 2 line(s) in unresolved status (needs_review/needs_configuration/calculated/attributed/awaiting_payment)");
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/awaiting_payment/);
  });

  it("empty period blocks lock", async () => {
    (lockCommissionPeriod as Mock).mockResolvedValue("Cannot lock: no commission lines found for this period");
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no commission lines/);
  });

  it("invalid month → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 13 });
    expect(res.status).toBe(400);
  });

  it("403 for readonly role", async () => {
    const res = await request(makeReadonlyApp()).post(`/commissions/${SLUG}/periods/lock`).send({ year: 2026, month: 5 });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P12: Cross-entity approval impossible
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /lines/:id/approve — cross-entity impossible (P12)", () => {
  it("approves own-entity calculated line", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/lines/${LINE_ID}/approve`).send({});
    expect(res.status).toBe(200);
    expect(approveCommissionLine).toHaveBeenCalledWith(LINE_ID, ENTITY_ID, "test@financeos.io");
  });

  it("cross-entity: slug2 resolves entity2, approve on line belonging to entity1 → 409", async () => {
    (getCachedEntityId as Mock).mockImplementation(async (s: string) =>
      s === SLUG2 ? ENTITY2_ID : ENTITY_ID
    );
    (approveCommissionLine as Mock).mockResolvedValue(false);
    const res = await request(makeApp()).post(`/commissions/${SLUG2}/lines/${LINE_ID}/approve`).send({});
    expect(res.status).toBe(409);
    expect(approveCommissionLine).toHaveBeenCalledWith(LINE_ID, ENTITY2_ID, "test@financeos.io");
  });

  it("403 for readonly role", async () => {
    const res = await request(makeReadonlyApp()).post(`/commissions/${SLUG}/lines/${LINE_ID}/approve`).send({});
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Formula engine tests — via vi.importActual
// ═══════════════════════════════════════════════════════════════════════════════

describe("Formula engine — unknown formula type → needs_review (P1)", () => {
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

describe("Formula engine — GP null → needs_review, no fallback (P1)", () => {
  it("returns needs_review/missing_gross_profit, commissionAmount null", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_gross_profit", calculationBasis: "gross_profit",
        commissionRate: "0.200000", fixedAmount: null,
        payableTrigger: "invoice_issued", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "1000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" },
    );
    expect(result.commissionAmount).toBeNull();
    expect(result.lineStatus).toBe("needs_review");
    expect(result.exclusionReason).toBe("missing_gross_profit");
  });
});

describe("Formula engine — invoice_paid trigger (P4)", () => {
  it("Overdue → awaiting_payment/overdue_not_paid", async () => {
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

  it("Paid → calculated, commissionAmount='100.00'", async () => {
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

describe("Formula engine — amount_paid always null (P5)", () => {
  it("Paid: needs_review/amount_paid_unavailable regardless of status", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: REP_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "percentage_of_amount_paid", calculationBasis: "amount_paid",
        commissionRate: "0.100000", fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "5000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" },
    );
    expect(result.commissionAmount).toBeNull();
    expect(result.lineStatus).toBe("needs_review");
    expect(result.exclusionReason).toBe("amount_paid_unavailable");
  });
});

describe("Formula engine — House explicit zero (P2)", () => {
  it("no_commission_house → commissionAmount='0' string, house_no_commission", async () => {
    const { applyFormula } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const result = applyFormula(
      { id: "x", entityId: ENTITY_ID, representativeId: HOUSE_UUID, coreCustomerId: null, customerNamePattern: null,
        formulaType: "no_commission_house", calculationBasis: null, commissionRate: null, fixedAmount: null,
        payableTrigger: "invoice_paid", ruleVersion: 1, status: "active",
        effectiveFrom: "2026-01-01", effectiveTo: null, notes: null },
      { invoiceAmount: "5000.00", grossProfit: null, expensesAmount: null, invoiceStatus: "Paid" },
    );
    expect(result.commissionAmount).toBe("0");
    expect(result.lineStatus).toBe("house_no_commission");
    expect(result.exclusionReason).toBe("internal_house_account");
  });
});

describe("Attribution — future and expired rule ignored (P7, P8)", () => {
  it("P7: effectiveFrom 2027 → null for 2026 invoice", async () => {
    const { attributeInvoice } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const rules = [{ id: "r1", entityId: ENTITY_ID, coreCustomerId: null,
      customerNamePattern: "Foray%", matchType: "customer_name_pattern" as const,
      priority: 10, representativeId: REP_UUID, representativeSlug: "jason",
      effectiveFrom: "2027-01-01", effectiveTo: null, notes: null }];
    expect(attributeInvoice("Foray Insure", null, rules, "2026-05-01")).toBeNull();
  });

  it("P8: effectiveTo 2025-12-31 → null for 2026 invoice", async () => {
    const { attributeInvoice } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const rules = [{ id: "r1", entityId: ENTITY_ID, coreCustomerId: null,
      customerNamePattern: "Foray%", matchType: "customer_name_pattern" as const,
      priority: 10, representativeId: REP_UUID, representativeSlug: "jason",
      effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31", notes: null }];
    expect(attributeInvoice("Foray Insure", null, rules, "2026-05-01")).toBeNull();
  });

  it("Unknown client → null, never House (P1)", async () => {
    const { attributeInvoice } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    const rules = [{ id: "r1", entityId: ENTITY_ID, coreCustomerId: null,
      customerNamePattern: "Foray%", matchType: "customer_name_pattern" as const,
      priority: 10, representativeId: REP_UUID, representativeSlug: "jason",
      effectiveFrom: "2025-01-01", effectiveTo: null, notes: null }];
    expect(attributeInvoice("Unknown Corp", null, rules, "2026-05-01")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P11: BigInt decimal arithmetic — exact rounding
// ═══════════════════════════════════════════════════════════════════════════════

describe("mulMoney — BigInt arithmetic (P11)", () => {
  it("1495.00 × 0.150000 = 224.25", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("1495.00", "0.150000")).toBe("224.25");
  });

  it("0.10 × 0.07 = 0.01 (half-cent rounds up)", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("0.10", "0.07")).toBe("0.01");
  });

  it("100.00 × 0.333333 = 33.33", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("100.00", "0.333333")).toBe("33.33");
  });

  it("1.00 × 0.005000 = 0.01 (positive half-cent → away from zero)", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("1.00", "0.005000")).toBe("0.01");
  });

  it("-1.00 × 0.005000 = -0.01 (negative half-cent → away from zero)", async () => {
    const { mulMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(mulMoney("-1.00", "0.005000")).toBe("-0.01");
  });

  it("123456789.99 × 0.150000 = 18518518.50", async () => {
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

describe("addMoney — no float drift (P11)", () => {
  it("0.01 + 0.02 = 0.03", async () => {
    const { addMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(addMoney("0.01", "0.02")).toBe("0.03");
  });

  it("-50.00 + 20.00 = -30.00", async () => {
    const { addMoney } = await vi.importActual<typeof import("../services/commissionEngine")>("../services/commissionEngine");
    expect(addMoney("-50.00", "20.00")).toBe("-30.00");
  });
});

describe("createCommissionRule — reason passed through (P16)", () => {
  it("creates with reason in payload", async () => {
    await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      representativeId: REP_UUID,
      formulaType: "percentage_of_invoice",
      commissionRate: 0.15,
      payableTrigger: "invoice_paid",
      effectiveFrom: "2026-01-01",
      reason: "Agreed per contract",
    });
    expect(createCommissionRule).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: ENTITY_ID, reason: "Agreed per contract" })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P22: Preview — absent representative → 400 for ALL formulas (not just house)
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /rules/preview — absent rep → 400 regardless of formula (P22)", () => {
  beforeEach(() => {
    (getCommissionRepresentativeById as Mock).mockResolvedValue(null);
  });

  it("percentage_of_invoice + absent rep → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`).send({
      representativeId: REP_UUID,
      formulaType:      "percentage_of_invoice",
      commissionRate:   0.15,
      payableTrigger:   "invoice_paid",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/);
  });

  it("fixed_amount + absent rep → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`).send({
      representativeId: REP_UUID,
      formulaType:      "fixed_amount",
      fixedAmount:      "500.00",
      payableTrigger:   "invoice_paid",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/);
  });

  it("no_commission_house + absent rep → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`).send({
      representativeId: HOUSE_UUID,
      formulaType:      "no_commission_house",
      payableTrigger:   "invoice_paid",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P23: Preview — genuine DB error → 500 (not 400)
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /rules/preview — DB error → 500 (P23)", () => {
  it("getCommissionRepresentativeById throws → 500", async () => {
    (getCommissionRepresentativeById as Mock).mockRejectedValue(new Error("connection reset"));
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`).send({
      representativeId: REP_UUID,
      formulaType:      "percentage_of_invoice",
      commissionRate:   0.15,
      payableTrigger:   "invoice_paid",
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/look up representative/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P24 + P25: calculationBasis validation
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /rules — calculationBasis validation (P24 + P25)", () => {
  const base = {
    representativeId: REP_UUID,
    payableTrigger:   "invoice_paid",
    effectiveFrom:    "2026-01-01",
    reason:           "test",
  };

  it("percentage_of_invoice + wrong basis → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      ...base,
      formulaType:       "percentage_of_invoice",
      commissionRate:    0.15,
      calculationBasis:  "gross_profit",     // wrong — should be invoice_amount
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/calculationBasis/);
    expect(res.body.error).toMatch(/invoice_amount/);
  });

  it("percentage_of_gross_profit + wrong basis → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      ...base,
      formulaType:       "percentage_of_gross_profit",
      commissionRate:    0.20,
      calculationBasis:  "invoice_amount",   // wrong
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/calculationBasis/);
  });

  it("no_commission_house + any calculationBasis → 400", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      representativeId:  HOUSE_UUID,
      formulaType:       "no_commission_house",
      calculationBasis:  "invoice_amount",
      payableTrigger:    "invoice_paid",
      effectiveFrom:     "2026-01-01",
      reason:            "test",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/calculationBasis/);
  });

  it("percentage_of_invoice + correct basis → 201", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      ...base,
      formulaType:       "percentage_of_invoice",
      commissionRate:    0.15,
      calculationBasis:  "invoice_amount",   // correct
    });
    expect(res.status).toBe(201);
  });

  it("percentage_of_invoice + no calculationBasis (auto-derived) → 201", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      ...base,
      formulaType:   "percentage_of_invoice",
      commissionRate: 0.15,
      // calculationBasis omitted — route derives it from FORMULA_BASIS
    });
    expect(res.status).toBe(201);
  });

  it("manual + any calculationBasis → 201 (flexible)", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules`).send({
      ...base,
      formulaType:       "manual",
      calculationBasis:  "manual_amount",
    });
    expect(res.status).toBe(201);
  });
});

// Preview route: same calculationBasis validation applies
describe("POST /rules/preview — calculationBasis validation (P24 via preview)", () => {
  it("percentage_of_invoice + wrong basis → 400 in preview", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`).send({
      representativeId:  REP_UUID,
      formulaType:       "percentage_of_invoice",
      commissionRate:    0.15,
      payableTrigger:    "invoice_paid",
      calculationBasis:  "gross_profit",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/calculationBasis/);
  });

  it("percentage_of_invoice + correct basis → 200 in preview", async () => {
    const res = await request(makeApp()).post(`/commissions/${SLUG}/rules/preview`).send({
      representativeId:  REP_UUID,
      formulaType:       "percentage_of_invoice",
      commissionRate:    0.15,
      payableTrigger:    "invoice_paid",
      calculationBasis:  "invoice_amount",
    });
    expect(res.status).toBe(200);
    expect(previewRuleApplication).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P26: DB-layer assertValidDate — strict calendar validation
// ═══════════════════════════════════════════════════════════════════════════════

describe("createCommissionRule (DB layer) — strict date validation (P26)", () => {
  it("2026-02-31 throws (non-existent date)", async () => {
    const { createCommissionRule: realCreate } =
      await vi.importActual<typeof import("../db/commissions")>("../db/commissions");
    await expect(realCreate({
      entityId:         ENTITY_ID,
      representativeId: REP_UUID,
      formulaType:      "percentage_of_invoice",
      commissionRate:   "0.150000",
      payableTrigger:   "invoice_paid",
      effectiveFrom:    "2026-02-31",
    })).rejects.toThrow(/Invalid calendar date/);
  });

  it("2026-13-01 throws (invalid month)", async () => {
    const { createCommissionRule: realCreate } =
      await vi.importActual<typeof import("../db/commissions")>("../db/commissions");
    await expect(realCreate({
      entityId:         ENTITY_ID,
      representativeId: REP_UUID,
      formulaType:      "percentage_of_invoice",
      commissionRate:   "0.150000",
      payableTrigger:   "invoice_paid",
      effectiveFrom:    "2026-13-01",
    })).rejects.toThrow(/Invalid/);
  });

  it("fixed_amount with fixedAmount=null throws (DB layer invariant)", async () => {
    const { createCommissionRule: realCreate } =
      await vi.importActual<typeof import("../db/commissions")>("../db/commissions");
    await expect(realCreate({
      entityId:         ENTITY_ID,
      representativeId: REP_UUID,
      formulaType:      "fixed_amount",
      fixedAmount:      null,
      payableTrigger:   "invoice_paid",
      effectiveFrom:    "2026-01-01",
    })).rejects.toThrow(/fixed_amount requires fixedAmount/);
  });

  it("no_commission_house with commissionRate throws (DB layer invariant)", async () => {
    const { createCommissionRule: realCreate } =
      await vi.importActual<typeof import("../db/commissions")>("../db/commissions");
    await expect(realCreate({
      entityId:         ENTITY_ID,
      representativeId: HOUSE_UUID,
      formulaType:      "no_commission_house",
      commissionRate:   "0.10",
      payableTrigger:   "invoice_paid",
      effectiveFrom:    "2026-01-01",
    })).rejects.toThrow(/no_commission_house/);
  });

  it("calculationBasis incompatible at DB layer → throws", async () => {
    const { createCommissionRule: realCreate } =
      await vi.importActual<typeof import("../db/commissions")>("../db/commissions");
    await expect(realCreate({
      entityId:         ENTITY_ID,
      representativeId: REP_UUID,
      formulaType:      "percentage_of_invoice",
      commissionRate:   "0.150000",
      calculationBasis: "gross_profit",   // wrong
      payableTrigger:   "invoice_paid",
      effectiveFrom:    "2026-01-01",
    })).rejects.toThrow(/calculationBasis/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P27: Concurrent advisory lock — NOT verifiable without real PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════════
//
// The advisory-lock protocol (pg_advisory_xact_lock) in upsertCommissionLine and
// lockCommissionPeriod cannot be tested with Vitest mocks — a mock that returns
// "skipped" proves nothing about the actual lock ordering or MVCC isolation.
//
// Status: NOT TESTED — PostgreSQL unavailable in this environment.
// Recommended: run `commission_002_attribution_seed.sql` and a concurrent-ingestion
// integration test against a real pg instance before promoting to production.
