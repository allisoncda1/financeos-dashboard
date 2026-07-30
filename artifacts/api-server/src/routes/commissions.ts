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
 *   GET  /lines   → { ok, data: CommissionRunLine[], total: number }
 *   GET  /summary → { ok, data: CommissionRepSummary[] }
 *   GET  /reps    → { ok, data: CommissionRepresentative[] }
 *   GET  /rules   → { ok, data: CommissionRule[] }
 *   POST /rules/preview → { ok, data: CommissionRulePreview }
 *   POST /rules   → { ok, data: CommissionRule }
 *   POST /ingest  → { ok, data: IngestResult }
 *   POST /lines/:id/approve → { ok }
 *   POST /periods/lock → { ok }
 */

import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { requirePermission } from "../auth/permissions";
import { getCachedEntityId } from "../services/entityCache";
import {
  getCommissionLines,
  getCommissionLineSummary,
  getCommissionRepresentatives,
  getCommissionRules,
  createCommissionRule,
  approveCommissionLine,
  lockCommissionPeriod,
  isValidUuid,
} from "../db/commissions";
import { ingestEntityInvoices, previewRuleApplication } from "../services/commissionEngine";

const router = Router();
const SLUG_RE = /^[a-z0-9_]{2,50}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_RE = /^-?\d{1,15}(\.\d{1,8})?$/;

function slugGuard(slug: string): boolean { return SLUG_RE.test(slug); }

const ALLOWED_FORMULA_TYPES = new Set([
  "percentage_of_invoice","percentage_of_amount_paid","percentage_of_gross_profit",
  "fixed_amount","manual","no_commission_house",
]);
const ALLOWED_TRIGGERS = new Set(["invoice_issued","invoice_paid","payment_received","manual_approval"]);
const VALID_LINE_STATUSES = new Set([
  "attributed","house_no_commission","needs_configuration","needs_review",
  "calculated","awaiting_payment","ready_for_review","approved","locked","excluded",
]);

function isValidMoneyString(v: unknown): v is string {
  return typeof v === "string" && MONEY_RE.test(v.trim());
}
function isValidDate(v: unknown): boolean {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  return !isNaN(new Date(v).getTime());
}

// ─── GET /:slug/representatives ──────────────────────────────────────────────
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
    // Contract: { ok, data, total } — matches financeos/src/lib/api.ts commissionLines()
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
  try {
    return res.json({ ok: true, data: await getCommissionLineSummary(entityId), ts: new Date().toISOString() });
  } catch { return res.status(500).json({ ok: false, error: "Internal error" }); }
});

// ─── POST /:slug/rules/preview ───────────────────────────────────────────────
router.post("/:slug/rules/preview", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body = req.body as Record<string, unknown>;
  const representativeId = body["representativeId"];
  const formulaType      = body["formulaType"];
  const payableTrigger   = body["payableTrigger"] ?? "invoice_paid";

  if (!representativeId || !isValidUuid(representativeId)) {
    return res.status(400).json({ ok: false, error: "representativeId must be a valid UUID" });
  }
  if (!formulaType || !ALLOWED_FORMULA_TYPES.has(formulaType as string)) {
    return res.status(400).json({ ok: false, error: "Invalid formulaType" });
  }
  if (!ALLOWED_TRIGGERS.has(payableTrigger as string)) {
    return res.status(400).json({ ok: false, error: "Invalid payableTrigger" });
  }

  try {
    const preview = await previewRuleApplication({
      entityId,
      representativeId: representativeId as string,
      customerNamePattern: (body["customerNamePattern"] as string) ?? null,
      formulaType: formulaType as string,
      calculationBasis: (body["calculationBasis"] as string) ?? null,
      commissionRate: body["commissionRate"] != null ? String(body["commissionRate"]) : null,
      fixedAmount:    body["fixedAmount"]    != null ? String(body["fixedAmount"])    : null,
      payableTrigger: payableTrigger as string,
    });
    return res.json({ ok: true, data: preview, ts: new Date().toISOString() });
  } catch { return res.status(500).json({ ok: false, error: "Internal error" }); }
});

// ─── POST /:slug/rules  (requires control permission) ───────────────────────
router.post("/:slug/rules", requireAuth, requirePermission("control"), async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body = req.body as Record<string, unknown>;
  const representativeId    = body["representativeId"];
  const formulaType         = body["formulaType"];
  const payableTrigger      = body["payableTrigger"] ?? "invoice_paid";
  const effectiveFrom       = body["effectiveFrom"];
  const effectiveTo         = body["effectiveTo"] ?? null;
  const customerNamePattern = body["customerNamePattern"] ?? null;
  const commissionRateRaw   = body["commissionRate"];
  const fixedAmountRaw      = body["fixedAmount"];

  if (!representativeId || !isValidUuid(representativeId)) {
    return res.status(400).json({ ok: false, error: "representativeId must be a valid UUID" });
  }
  if (!formulaType || !ALLOWED_FORMULA_TYPES.has(formulaType as string)) {
    return res.status(400).json({ ok: false, error: "Invalid formulaType" });
  }
  if (!ALLOWED_TRIGGERS.has(payableTrigger as string)) {
    return res.status(400).json({ ok: false, error: "Invalid payableTrigger" });
  }
  if (!effectiveFrom || !isValidDate(effectiveFrom)) {
    return res.status(400).json({ ok: false, error: "effectiveFrom must be a valid ISO date (YYYY-MM-DD)" });
  }
  if (effectiveTo !== null && !isValidDate(effectiveTo)) {
    return res.status(400).json({ ok: false, error: "effectiveTo must be a valid ISO date (YYYY-MM-DD)" });
  }
  if (effectiveTo !== null && String(effectiveTo) < String(effectiveFrom)) {
    return res.status(400).json({ ok: false, error: "effectiveTo must be >= effectiveFrom" });
  }
  // customerNamePattern must not be a bare wildcard
  if (customerNamePattern !== null && (String(customerNamePattern).trim() === "%" || String(customerNamePattern).trim() === "")) {
    return res.status(400).json({ ok: false, error: "customerNamePattern cannot be '%' or empty" });
  }
  // Validate commissionRate if provided
  if (commissionRateRaw != null) {
    const rateStr = String(commissionRateRaw);
    if (!isValidMoneyString(rateStr)) {
      return res.status(400).json({ ok: false, error: "commissionRate must be a valid decimal number" });
    }
    const rateNum = parseFloat(rateStr);
    if (rateNum < 0 || rateNum > 10) {
      return res.status(400).json({ ok: false, error: "commissionRate must be between 0 and 10 (i.e. 0–1000%)" });
    }
  }
  // Validate fixedAmount if provided
  if (fixedAmountRaw != null) {
    const fixedStr = String(fixedAmountRaw);
    if (!isValidMoneyString(fixedStr)) {
      return res.status(400).json({ ok: false, error: "fixedAmount must be a valid decimal number" });
    }
    const fixedNum = parseFloat(fixedStr);
    if (fixedNum < -999999.99 || fixedNum > 999999.99) {
      return res.status(400).json({ ok: false, error: "fixedAmount out of allowed range" });
    }
  }
  // no_commission_house must not carry rate/amount
  if (formulaType === "no_commission_house" && (commissionRateRaw != null || fixedAmountRaw != null)) {
    return res.status(400).json({ ok: false, error: "no_commission_house formula must not have commissionRate or fixedAmount" });
  }
  // reason required
  if (!body["reason"] || typeof body["reason"] !== "string" || !(body["reason"] as string).trim()) {
    return res.status(400).json({ ok: false, error: "reason is required for rule creation" });
  }

  const user      = (req as { user?: { name?: string; email?: string } }).user;
  const createdBy = user?.email ?? user?.name ?? "unknown";

  try {
    const rule = await createCommissionRule({
      entityId,
      representativeId: representativeId as string,
      coreCustomerId:       (body["coreCustomerId"]      as string) ?? null,
      customerNamePattern:  customerNamePattern !== null ? String(customerNamePattern) : null,
      formulaType:          formulaType as string,
      calculationBasis:     (body["calculationBasis"]    as string) ?? null,
      commissionRate:       commissionRateRaw != null ? String(commissionRateRaw) : null,
      fixedAmount:          fixedAmountRaw    != null ? String(fixedAmountRaw)    : null,
      payableTrigger:       payableTrigger as string,
      effectiveFrom:        effectiveFrom as string,
      effectiveTo:          effectiveTo !== null ? String(effectiveTo) : null,
      notes:                (body["notes"]               as string) ?? null,
      createdBy,
      reason:               (body["reason"]              as string).trim(),
    });
    return res.status(201).json({ ok: true, data: rule, ts: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Propagate validation errors from DB layer as 400
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
    return res.status(400).json({ ok: false, error: "fromDate must be ISO date YYYY-MM-DD" });
  }
  if (toDate && !isValidDate(toDate)) {
    return res.status(400).json({ ok: false, error: "toDate must be ISO date YYYY-MM-DD" });
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

export default router;
