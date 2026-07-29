/**
 * Commission module routes.
 *
 * Authorization:
 *   - requireAuth: all endpoints
 *   - requirePermission("financials"): approve
 *   - requirePermission("control"):    create rule, lock period
 *   - requirePermission("operations"): manual ingest
 *
 * req.params accessed via ["key"] as string (project convention).
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

  // Validate query params before passing to DB layer
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
    return res.json({ ok: true, ...result, ts: new Date().toISOString() });
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
  const representativeId = body["representativeId"];
  const formulaType      = body["formulaType"];
  const payableTrigger   = body["payableTrigger"] ?? "invoice_paid";
  const effectiveFrom    = body["effectiveFrom"];

  if (!representativeId || !isValidUuid(representativeId)) {
    return res.status(400).json({ ok: false, error: "representativeId must be a valid UUID" });
  }
  if (!formulaType || !ALLOWED_FORMULA_TYPES.has(formulaType as string)) {
    return res.status(400).json({ ok: false, error: "Invalid formulaType" });
  }
  if (!ALLOWED_TRIGGERS.has(payableTrigger as string)) {
    return res.status(400).json({ ok: false, error: "Invalid payableTrigger" });
  }
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    return res.status(400).json({ ok: false, error: "effectiveFrom is required (YYYY-MM-DD)" });
  }

  const user      = (req as { user?: { name?: string; email?: string } }).user;
  const createdBy = user?.email ?? user?.name ?? "unknown";

  try {
    const rule = await createCommissionRule({
      entityId,
      representativeId: representativeId as string,
      coreCustomerId:        (body["coreCustomerId"]        as string) ?? null,
      customerNamePattern:   (body["customerNamePattern"]   as string) ?? null,
      formulaType:           formulaType as string,
      calculationBasis:      (body["calculationBasis"]      as string) ?? null,
      commissionRate:        body["commissionRate"]  != null ? String(body["commissionRate"])  : null,
      fixedAmount:           body["fixedAmount"]     != null ? String(body["fixedAmount"])     : null,
      payableTrigger:        payableTrigger as string,
      effectiveFrom,
      effectiveTo:           (body["effectiveTo"]           as string) ?? null,
      notes:                 (body["notes"]                 as string) ?? null,
      createdBy,
      reason:                (body["reason"]                as string) ?? null,
    });
    return res.status(201).json({ ok: true, data: rule, ts: new Date().toISOString() });
  } catch { return res.status(500).json({ ok: false, error: "Internal error" }); }
});

// ─── POST /:slug/ingest  (requires operations permission) ───────────────────
router.post("/:slug/ingest", requireAuth, requirePermission("operations"), async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const { fromDate, toDate } = req.body as { fromDate?: string; toDate?: string };
  const user       = (req as { user?: { name?: string; email?: string } }).user;
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
