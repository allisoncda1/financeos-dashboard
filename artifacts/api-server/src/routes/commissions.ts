/**
 * Commission module routes.
 *
 * Authorization:
 *   - requireAuth: all endpoints
 *   - requirePermission("financials"): approve
 *   - requirePermission("control"):    create rule, lock period
 *   - requirePermission("operations"): manual ingest
 *
 * API contract (matches financeos/src/lib/api.ts):
 *   GET  /lines          → { ok, data: CommissionRunLine[], total: number }
 *   GET  /summary        → { ok, data: CommissionRepSummary[] }
 *   GET  /representatives → { ok, data: CommissionRepresentative[] }
 *   GET  /rules          → { ok, data: CommissionRule[] }
 *   POST /rules/preview  → { ok, data: CommissionRulePreview }
 *   POST /rules          → { ok, data: CommissionRule }
 *   POST /ingest         → { ok, data: IngestResult }
 *   POST /lines/:id/approve → { ok }
 *   POST /periods/lock   → { ok }
 */

import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { requirePermission } from "../auth/permissions";
import { getCachedEntityId } from "../services/entityCache";
import {
  getCommissionLines,
  getCommissionLineSummary,
  createCommissionRepresentative,
  getCommissionRepresentatives,
  getCommissionRepresentativeById,
  getCommissionRules,
  createCommissionRule,
  approveCommissionLine,
  lockCommissionPeriod,
  isValidUuid,
  getCommissionLineById,
  saveLineReviewDraft,
  reviewApproveCommissionLine,
  getCommissionKpiSummary,
} from "../db/commissions";
import { ingestEntityInvoices, previewRuleApplication } from "../services/commissionEngine";

const router = Router();
const SLUG_RE       = /^[a-zA-Z0-9_]{2,50}$/;  // uppercase allowed; getCachedEntityId lowercases internally
const DATE_RE       = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_RE      = /^-?\d{1,15}(\.\d{1,2})?$/;   // max 2 decimal places for amounts
const RATE_MONEY_RE = /^-?\d{1,15}(\.\d{1,8})?$/;   // rates may have more precision (0.150000)

function slugGuard(slug: string): boolean { return SLUG_RE.test(slug); }

const ALLOWED_FORMULA_TYPES = new Set([
  "percentage_of_invoice","percentage_of_amount_paid","percentage_of_gross_profit",
  "fixed_amount","manual","no_commission_house","percentage_of_adjusted_gp",
]);
const ALLOWED_TRIGGERS = new Set(["invoice_issued","invoice_paid","payment_received","manual_approval"]);
const VALID_LINE_STATUSES = new Set([
  "attributed","house_no_commission","needs_configuration","needs_review",
  "calculated","awaiting_payment","ready_for_review","approved","locked","excluded",
]);
const PCT_FORMULAS = new Set(["percentage_of_invoice","percentage_of_amount_paid","percentage_of_gross_profit","percentage_of_adjusted_gp"]);
const FORMULA_BASIS: Record<string, string> = {
  percentage_of_invoice:      "invoice_amount",
  percentage_of_amount_paid:  "amount_paid",
  percentage_of_gross_profit: "gross_profit",
  percentage_of_adjusted_gp:  "adjusted_gp",
};
/** The exact calculationBasis required for each formula (null = flexible / none). */
const FORMULA_CALCULATION_BASIS: Record<string, string | null> = {
  percentage_of_invoice:      "invoice_amount",
  percentage_of_amount_paid:  "amount_paid",
  percentage_of_gross_profit: "gross_profit",
  fixed_amount:               "fixed_amount",
  percentage_of_adjusted_gp:  "adjusted_gp",
  manual:                     null,
  no_commission_house:        null,
};

/**
 * Strict ISO date validation — rejects calendar-normalised dates.
 * new Date("2026-02-31") normalises to March 3; we reject instead.
 */
function isValidDate(v: unknown): boolean {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isValidMoneyString(v: unknown): v is string {
  return typeof v === "string" && MONEY_RE.test(v.trim());
}
function isValidRateString(v: unknown): v is string {
  return typeof v === "string" && RATE_MONEY_RE.test(v.trim());
}

/**
 * Validate the formula/rate/fixedAmount matrix.
 * Returns an error string, or null if valid.
 */
function validateFormulaMatrix(
  formulaType: string,
  commissionRateRaw: unknown,
  fixedAmountRaw: unknown,
): string | null {
  if (PCT_FORMULAS.has(formulaType)) {
    if (commissionRateRaw == null) return `${formulaType} requires commissionRate`;
    if (fixedAmountRaw != null)    return `${formulaType} must not have fixedAmount`;
    const rateStr = String(commissionRateRaw);
    if (!isValidRateString(rateStr)) return "commissionRate must be a valid decimal number";
    const rateNum = parseFloat(rateStr);
    if (rateNum < 0 || rateNum > 10) return "commissionRate must be between 0 and 10 (0–1000%)";
    return null;
  }
  if (formulaType === "fixed_amount") {
    if (fixedAmountRaw == null) return "fixed_amount requires fixedAmount";
    if (commissionRateRaw != null) return "fixed_amount must not have commissionRate";
    const fixedStr = String(fixedAmountRaw);
    if (!isValidMoneyString(fixedStr)) return "fixedAmount must be a decimal with at most 2 decimal places";
    const fixedNum = parseFloat(fixedStr);
    if (fixedNum < -999999.99 || fixedNum > 999999.99) return "fixedAmount out of allowed range (±999,999.99)";
    return null;
  }
  if (formulaType === "no_commission_house") {
    if (commissionRateRaw != null) return "no_commission_house must not have commissionRate";
    if (fixedAmountRaw != null)    return "no_commission_house must not have fixedAmount";
    return null;
  }
  if (formulaType === "manual") {
    // manual: rate/amount optional but must be valid if provided
    if (commissionRateRaw != null) {
      const rateStr = String(commissionRateRaw);
      if (!isValidRateString(rateStr)) return "commissionRate must be a valid decimal number";
      const rateNum = parseFloat(rateStr);
      if (rateNum < 0 || rateNum > 10) return "commissionRate must be between 0 and 10";
    }
    if (fixedAmountRaw != null) {
      const fixedStr = String(fixedAmountRaw);
      if (!isValidMoneyString(fixedStr)) return "fixedAmount must be a decimal with at most 2 decimal places";
    }
    return null;
  }
  return null;
}

interface RuleBody {
  representativeId: unknown;
  formulaType: unknown;
  payableTrigger: unknown;
  effectiveFrom: unknown;
  effectiveTo: unknown;
  customerNamePattern: unknown;
  commissionRate: unknown;
  fixedAmount: unknown;
  calculationBasis: unknown;
  reason: unknown;
}

/**
 * Shared validation for both Preview and Create.
 * Returns { error: string } on failure, null on success.
 * Does NOT validate reason (only required for Create, not Preview).
 */
function validateRuleBody(body: RuleBody): string | null {
  const { representativeId, formulaType, payableTrigger, effectiveFrom, effectiveTo,
          customerNamePattern, commissionRate, fixedAmount, calculationBasis } = body;

  if (!representativeId || !isValidUuid(representativeId)) {
    return "representativeId must be a valid UUID";
  }
  if (!formulaType || !ALLOWED_FORMULA_TYPES.has(formulaType as string)) {
    return `Invalid formulaType: ${String(formulaType)}`;
  }
  if (!ALLOWED_TRIGGERS.has((payableTrigger ?? "invoice_paid") as string)) {
    return `Invalid payableTrigger: ${String(payableTrigger)}`;
  }
  if (effectiveFrom !== undefined && effectiveFrom !== null) {
    if (!isValidDate(effectiveFrom)) {
      return "effectiveFrom must be a valid calendar date (YYYY-MM-DD)";
    }
  }
  if (effectiveTo !== null && effectiveTo !== undefined) {
    if (!isValidDate(effectiveTo)) {
      return "effectiveTo must be a valid calendar date (YYYY-MM-DD)";
    }
    if (String(effectiveTo) < String(effectiveFrom)) {
      return "effectiveTo must be >= effectiveFrom";
    }
  }
  if (customerNamePattern !== null && customerNamePattern !== undefined) {
    const pat = String(customerNamePattern).trim();
    if (pat === "" || pat === "%" || /^%+$/.test(pat)) {
      return "customerNamePattern cannot be '%' or an empty/all-wildcard pattern";
    }
  }

  const matrixErr = validateFormulaMatrix(formulaType as string, commissionRate, fixedAmount);
  if (matrixErr) return matrixErr;

  // calculationBasis must match the formula when explicitly supplied.
  if (calculationBasis != null && calculationBasis !== undefined) {
    const ft = formulaType as string;
    if (ft === "no_commission_house") {
      return "no_commission_house must not have calculationBasis";
    }
    if (ft !== "manual") {
      const expected = FORMULA_CALCULATION_BASIS[ft];
      if (expected !== null && calculationBasis !== expected) {
        return `calculationBasis '${String(calculationBasis)}' is incompatible with '${ft}' (expected '${expected}')`;
      }
    }
  }

  return null;
}

// ─── GET /:slug/representatives ──────────────────────────────────────────────

const REVIEW_APPROVE_BUSINESS_ERRORS = new Set([
  "line_not_found", "already_finalized", "historical_line", "not_external_rep",
]);
router.get("/:slug/representatives", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });
  try {
    return res.json({ ok: true, data: await getCommissionRepresentatives(), ts: new Date().toISOString() });
  } catch { return res.status(500).json({ ok: false, error: "Internal error" }); }
});

// ─── GET /:slug/rules ────────────────────────────────────────────────────────
router.get("/:slug/rules", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });
  try {
    return res.json({ ok: true, data: await getCommissionRules(entityId), ts: new Date().toISOString() });
  } catch { return res.status(500).json({ ok: false, error: "Internal error" }); }
});

// ─── GET /:slug/lines ────────────────────────────────────────────────────────
// Contract: { ok, data: CommissionRunLine[], total: number }
router.get("/:slug/lines", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const q = req.query as Record<string, string>;
  const representativeId = q["representativeId"];
  const lineStatus       = q["lineStatus"];
  const periodYear       = q["periodYear"];
  const periodMonth      = q["periodMonth"];
  const limit            = q["limit"] ?? "500";
  const offset           = q["offset"] ?? "0";

  if (representativeId && !isValidUuid(representativeId)) {
    return res.status(400).json({ ok: false, error: "Invalid representativeId UUID" });
  }
  if (lineStatus && !VALID_LINE_STATUSES.has(lineStatus)) {
    return res.status(400).json({ ok: false, error: `Invalid lineStatus: ${lineStatus}` });
  }

  try {
    const result = await getCommissionLines({
      entityId,
      representativeId: representativeId || undefined,
      lineStatus:       lineStatus || undefined,
      periodYear:       periodYear ? parseInt(periodYear, 10) : undefined,
      periodMonth:      periodMonth ? parseInt(periodMonth, 10) : undefined,
      limit:            Math.min(parseInt(limit, 10), 1000),
      offset:           parseInt(offset, 10),
    });
    return res.json({ ok: true, data: result.lines, total: result.total, ts: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ ok: false, error: msg });
  }
});

// ─── GET /:slug/summary ──────────────────────────────────────────────────────
router.get("/:slug/summary", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });
  const q = req.query as Record<string, string>;
  const periodYear  = q["periodYear"]  ? parseInt(q["periodYear"],  10) : undefined;
  const periodMonth = q["periodMonth"] ? parseInt(q["periodMonth"], 10) : undefined;
  try {
    return res.json({ ok: true, data: await getCommissionLineSummary(entityId, periodYear, periodMonth), ts: new Date().toISOString() });
  } catch { return res.status(500).json({ ok: false, error: "Internal error" }); }
});

// ─── POST /:slug/rules/preview ───────────────────────────────────────────────
// Uses the shared validateRuleBody — same business rules as Create except reason not required.
router.post("/:slug/rules/preview", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body = req.body as Record<string, unknown>;
  const payableTrigger = body["payableTrigger"] ?? "invoice_paid";

  const validationErr = validateRuleBody({
    representativeId:    body["representativeId"],
    formulaType:         body["formulaType"],
    payableTrigger,
    effectiveFrom:       body["effectiveFrom"],
    effectiveTo:         body["effectiveTo"] ?? null,
    customerNamePattern: body["customerNamePattern"] ?? null,
    commissionRate:      body["commissionRate"] ?? null,
    fixedAmount:         body["fixedAmount"] ?? null,
    calculationBasis:    body["calculationBasis"] ?? null,
    reason:              null, // not required for preview
  });
  if (validationErr) return res.status(400).json({ ok: false, error: validationErr });

  const formulaType = String(body["formulaType"]);

  // Fetch the representative once; distinguish genuine DB errors from "not found".
  // Bug fix (P2): previously, non-no_commission_house path skipped 400 when rep === null.
  let rep;
  try {
    rep = await getCommissionRepresentativeById(String(body["representativeId"]));
  } catch {
    return res.status(500).json({ ok: false, error: "Failed to look up representative" });
  }
  if (!rep) return res.status(400).json({ ok: false, error: "Representative not found" });

  if (formulaType === "no_commission_house") {
    if (rep.representativeType !== "internal_house") {
      return res.status(400).json({ ok: false, error: "no_commission_house formula can only be used with an internal_house representative" });
    }
  } else {
    if (rep.representativeType === "internal_house") {
      return res.status(400).json({ ok: false, error: "Payable formulas cannot be applied to an internal_house representative — use no_commission_house instead" });
    }
  }

  try {
    const preview = await previewRuleApplication({
      entityId,
      representativeId:    String(body["representativeId"]),
      customerNamePattern: (body["customerNamePattern"] as string) ?? null,
      formulaType,
      calculationBasis:    (body["calculationBasis"] as string) ?? FORMULA_BASIS[formulaType] ?? null,
      commissionRate:      body["commissionRate"] != null ? String(body["commissionRate"]) : null,
      fixedAmount:         body["fixedAmount"]    != null ? String(body["fixedAmount"])    : null,
      payableTrigger:      String(payableTrigger),
    });
    return res.json({ ok: true, data: preview, ts: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ ok: false, error: msg });
  }
});

// ─── POST /:slug/rules  (requires control permission) ───────────────────────
router.post("/:slug/rules", requireAuth, requirePermission("control"), async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body = req.body as Record<string, unknown>;
  const payableTrigger      = body["payableTrigger"] ?? "invoice_paid";
  const effectiveTo         = body["effectiveTo"] ?? null;
  const customerNamePattern = body["customerNamePattern"] ?? null;
  const effectiveFrom       = body["effectiveFrom"];

  // effectiveFrom required for Create
  if (!effectiveFrom || !isValidDate(effectiveFrom)) {
    return res.status(400).json({ ok: false, error: "effectiveFrom must be a valid calendar date (YYYY-MM-DD)" });
  }

  const validationErr = validateRuleBody({
    representativeId:    body["representativeId"],
    formulaType:         body["formulaType"],
    payableTrigger,
    effectiveFrom,
    effectiveTo,
    customerNamePattern,
    commissionRate:      body["commissionRate"] ?? null,
    fixedAmount:         body["fixedAmount"] ?? null,
    calculationBasis:    body["calculationBasis"] ?? null,
    reason:              null,
  });
  if (validationErr) return res.status(400).json({ ok: false, error: validationErr });

  // reason required for Create (audit)
  if (!body["reason"] || typeof body["reason"] !== "string" || !body["reason"].trim()) {
    return res.status(400).json({ ok: false, error: "reason is required for rule creation" });
  }

  const formulaType = String(body["formulaType"]);

  // Rep type check: no_commission_house requires internal_house; payable formulas require external_rep.
  // Genuine DB errors → 500; representative not found → 400.
  let rep;
  try {
    rep = await getCommissionRepresentativeById(String(body["representativeId"]));
  } catch {
    return res.status(500).json({ ok: false, error: "Failed to look up representative" });
  }
  if (!rep) return res.status(400).json({ ok: false, error: "Representative not found" });

  if (formulaType === "no_commission_house") {
    if (rep.representativeType !== "internal_house") {
      return res.status(400).json({ ok: false, error: "no_commission_house formula can only be used with an internal_house representative" });
    }
  } else {
    if (rep.representativeType === "internal_house") {
      return res.status(400).json({ ok: false, error: "Payable formulas cannot be applied to an internal_house representative — use no_commission_house instead" });
    }
  }

  const user      = (req as { user?: { name?: string; email?: string } }).user;
  const createdBy = user?.email ?? user?.name ?? "unknown";

  try {
    const rule = await createCommissionRule({
      entityId,
      representativeId:     String(body["representativeId"]),
      coreCustomerId:       (body["coreCustomerId"]      as string) ?? null,
      customerNamePattern:  customerNamePattern !== null ? String(customerNamePattern) : null,
      formulaType,
      calculationBasis:     (body["calculationBasis"] as string) ?? FORMULA_BASIS[formulaType] ?? null,
      commissionRate:       body["commissionRate"] != null ? String(body["commissionRate"]) : null,
      fixedAmount:          body["fixedAmount"]    != null ? String(body["fixedAmount"])    : null,
      payableTrigger:       String(payableTrigger),
      effectiveFrom:        String(effectiveFrom),
      effectiveTo:          effectiveTo !== null ? String(effectiveTo) : null,
      notes:                (body["notes"] as string) ?? null,
      createdBy,
      reason:               body["reason"].trim(),
    });
    return res.status(201).json({ ok: true, data: rule, ts: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("UNIQUE_VIOLATION")) {
      return res.status(409).json({ ok: false, error: "Rule version conflict — a concurrent create completed first. Please refresh and retry." });
    }
    if (msg.startsWith("Invalid") || msg.startsWith("effectiveTo") || msg.startsWith("customerNamePattern")) {
      return res.status(400).json({ ok: false, error: msg });
    }
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── POST /:slug/ingest  (requires operations permission) ───────────────────
router.post("/:slug/ingest", requireAuth, requirePermission("operations"), async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const { fromDate, toDate } = req.body as { fromDate?: string; toDate?: string };
  if (fromDate && !isValidDate(fromDate)) {
    return res.status(400).json({ ok: false, error: "fromDate must be a valid calendar date (YYYY-MM-DD)" });
  }
  if (toDate && !isValidDate(toDate)) {
    return res.status(400).json({ ok: false, error: "toDate must be a valid calendar date (YYYY-MM-DD)" });
  }

  const user        = (req as { user?: { name?: string; email?: string } }).user;
  const triggeredBy = user?.email ?? user?.name ?? "unknown";

  try {
    const result = await ingestEntityInvoices(entityId, { fromDate, toDate, reingesterBy: triggeredBy });
    return res.json({ ok: true, data: result, ts: new Date().toISOString() });
  } catch { return res.status(500).json({ ok: false, error: "Internal error" }); }
});

// ─── POST /:slug/lines/:id/approve  (requires financials permission) ─────────
router.post("/:slug/lines/:id/approve", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug = req.params["slug"] as string;
  const id   = req.params["id"]   as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id)) return res.status(400).json({ ok: false, error: "Invalid line id" });

  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const user       = (req as { user?: { name?: string; email?: string } }).user;
  const approvedBy = user?.email ?? user?.name ?? "unknown";

  try {
    const ok = await approveCommissionLine(id, entityId, approvedBy);
    if (!ok) return res.status(409).json({ ok: false, error: "Line not found, not in calculated status, or belongs to a different entity" });
    return res.json({ ok: true, ts: new Date().toISOString() });
  } catch { return res.status(500).json({ ok: false, error: "Internal error" }); }
});

// ─── POST /:slug/periods/lock  (requires control permission) ─────────────────
router.post("/:slug/periods/lock", requireAuth, requirePermission("control"), async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const { year, month } = req.body as { year?: number; month?: number };
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ ok: false, error: "year and month (1–12) required" });
  }

  const user     = (req as { user?: { name?: string; email?: string } }).user;
  const lockedBy = user?.email ?? user?.name ?? "unknown";

  try {
    const err = await lockCommissionPeriod(entityId, year, month, lockedBy);
    if (err) return res.status(409).json({ ok: false, error: err });
    return res.json({ ok: true, ts: new Date().toISOString() });
  } catch { return res.status(500).json({ ok: false, error: "Internal error" }); }
});


// ─── GET /:slug/lines/:lineId ─────────────────────────────────────────────────
router.get("/:slug/lines/:lineId", requireAuth, async (req, res) => {
  const slug   = req.params["slug"]   as string;
  const lineId = req.params["lineId"] as string;
  if (!slugGuard(slug))     return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(lineId)) return res.status(400).json({ ok: false, error: "Invalid lineId" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });
  try {
    const line = await getCommissionLineById(entityId, lineId);
    if (!line) return res.status(404).json({ ok: false, error: "Line not found" });
    return res.json({ ok: true, data: line, ts: new Date().toISOString() });
  } catch {
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── POST /:slug/lines/:lineId/review-draft ───────────────────────────────────
router.post("/:slug/lines/:lineId/review-draft", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug   = req.params["slug"]   as string;
  const lineId = req.params["lineId"] as string;
  if (!slugGuard(slug))     return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(lineId)) return res.status(400).json({ ok: false, error: "Invalid lineId" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body = req.body as Record<string, unknown>;
  const raw  = body["expensesAmount"];
  if (raw == null || !isValidMoneyString(raw)) {
    return res.status(400).json({ ok: false, error: "expensesAmount must be a non-negative decimal with at most 2 decimal places" });
  }
  if (parseFloat(String(raw)) < 0) {
    return res.status(400).json({ ok: false, error: "expensesAmount must be >= 0" });
  }
  try {
    await saveLineReviewDraft(entityId, lineId, { expensesAmount: String(raw) });
    return res.json({ ok: true, ts: new Date().toISOString() });
  } catch (e) {
    (req as unknown as { log?: { error?(...a: unknown[]): void } }).log?.error?.({ err: e }, "[commission] review-draft internal error");
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── POST /:slug/lines/:lineId/review-approve ─────────────────────────────────
router.post("/:slug/lines/:lineId/review-approve", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug   = req.params["slug"]   as string;
  const lineId = req.params["lineId"] as string;
  if (!slugGuard(slug))     return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(lineId)) return res.status(400).json({ ok: false, error: "Invalid lineId" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body           = req.body as Record<string, unknown>;
  const expensesAmount = body["expensesAmount"];
  const commissionRate = body["commissionRate"];
  const saveForFuture  = body["saveForFuture"] === true;

  if (expensesAmount == null || !isValidMoneyString(expensesAmount)) {
    return res.status(400).json({ ok: false, error: "expensesAmount must be a non-negative decimal with at most 2 decimal places" });
  }
  if (parseFloat(String(expensesAmount)) < 0) {
    return res.status(400).json({ ok: false, error: "expensesAmount must be >= 0" });
  }
  if (commissionRate == null || !isValidRateString(commissionRate)) {
    return res.status(400).json({ ok: false, error: "commissionRate must be a decimal between 0 and 10" });
  }
  const rateNum = parseFloat(String(commissionRate));
  if (rateNum < 0 || rateNum > 10) {
    return res.status(400).json({ ok: false, error: "commissionRate must be between 0 and 10 (0–1000%)" });
  }

  const user       = (req as { user?: { name?: string; email?: string } }).user;
  const approvedBy = user?.email ?? user?.name ?? "unknown";

  try {
    const result = await reviewApproveCommissionLine(entityId, lineId, {
      expensesAmount: String(expensesAmount),
      commissionRate: String(commissionRate),
      approvedBy,
    });

    let ruleWarning: string | null = null;

    if (saveForFuture) {
      const repId          = body["representativeId"];
      const rawPattern     = body["customerNamePattern"];
      const rawTrigger     = body["payableTrigger"];

      // All three fields are required — never invent a trigger or scope.
      const customerNamePattern =
        typeof rawPattern === "string" && rawPattern.trim()
          ? rawPattern.trim()
          : null;

      if (!isValidUuid(repId)) {
        ruleWarning = "Invoice approved. Future rate not saved — representativeId is required and must be a valid UUID.";
      } else if (!customerNamePattern) {
        ruleWarning = "Invoice approved. Future rate not saved — a non-empty customer name or pattern is required for a scoped rule.";
      } else if (!ALLOWED_TRIGGERS.has(String(rawTrigger ?? ""))) {
        ruleWarning = "Invoice approved. Future rate not saved — payableTrigger must be explicitly provided and valid (never defaulted).";
      } else {
        try {
          await createCommissionRule({
            entityId,
            representativeId:    String(repId),
            customerNamePattern,
            formulaType:         "percentage_of_adjusted_gp",
            calculationBasis:    "adjusted_gp",
            commissionRate:      String(commissionRate),
            payableTrigger:      String(rawTrigger),
            effectiveFrom:       new Date().toISOString().slice(0, 10),
            notes:               null,
            createdBy:           approvedBy,
            reason:              `Rate set via Commission Review — approved ${new Date().toISOString().slice(0, 10)}`,
          });
        } catch {
          ruleWarning = "Invoice approved. Future rate could not be saved — please retry from Rules or Review.";
        }
      }
    }

    // warning and ruleWarning are inside data so api.get<T>() → json.data exposes them
    return res.json({
      ok: true,
      data: {
        line:             result.line,
        commissionAmount: result.commissionAmount,
        warning:          result.warning,
        ruleWarning,
      },
      ts: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = [...REVIEW_APPROVE_BUSINESS_ERRORS].find((c) => msg.includes(c));
    if (code) {
      const status = code === "line_not_found" ? 404 : 422;
      return res.status(status).json({ ok: false, error: code });
    }
    (req as unknown as { log?: { error?(...a: unknown[]): void } }).log?.error?.({ err: e }, "[commission] review-approve internal error");
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── GET /:slug/kpi-summary ───────────────────────────────────────────────────
router.get("/:slug/kpi-summary", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const month = typeof req.query["month"] === "string" ? req.query["month"] : undefined;
  if (month !== undefined && !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ ok: false, error: "month must be YYYY-MM" });
  }
  try {
    const data = await getCommissionKpiSummary(entityId, month);
    return res.json({ ok: true, data, ts: new Date().toISOString() });
  } catch (e) {
    (req as unknown as { log?: { error?(...a: unknown[]): void } }).log?.error?.({ err: e }, "[commission] kpi-summary internal error");
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});


// POST /:slug/representatives — add external sales rep
router.post("/:slug/representatives", slugGuard, requirePermission("control"), async (req, res) => {
  const { slug } = req.params as { slug: string };
  const { displayName } = req.body as { displayName?: string };

  if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
    return res.status(400).json({ error: "displayName is required" });
  }

  const trimmedName = displayName.trim();
  const repSlug = trimmedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || `rep_${Date.now()}`;

  try {
    const entityId = await getCachedEntityId(slug);
    if (!entityId) return res.status(404).json({ error: "Entity not found" });

    const rep = await createCommissionRepresentative({ displayName: trimmedName, slug: repSlug });
    return res.status(201).json({ data: rep });
  } catch (err: unknown) {
    if (err instanceof Error && (err as { code?: string }).code === "DUPLICATE_SLUG") {
      return res.status(409).json({ error: "A representative with that name already exists", code: "DUPLICATE_SLUG" });
    }
    const log = (req as unknown as { log?: { error?(...a: unknown[]): void } }).log;
    log?.error?.("POST /representatives error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


export default router;
