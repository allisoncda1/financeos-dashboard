/**
 * Commission module routes.
 * All req.params accessed via ["key"] as string to match existing project conventions.
 */

import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { getCachedEntityId } from "../services/entityCache";
import {
  getCommissionLines,
  getCommissionLineSummary,
  getCommissionRepresentatives,
  getCommissionRules,
  createCommissionRule,
  approveCommissionLine,
  lockCommissionPeriod,
} from "../db/commissions";
import { ingestEntityInvoices, previewRuleApplication } from "../services/commissionEngine";

const router = Router();
const COMMISSION_SLUG_RE = /^[a-z0-9_]{2,50}$/;

function slugGuard(slug: string): boolean {
  return COMMISSION_SLUG_RE.test(slug);
}

const ALLOWED_FORMULA_TYPES = [
  "percentage_of_invoice",
  "percentage_of_amount_paid",
  "percentage_of_gross_profit",
  "fixed_amount",
  "manual",
  "no_commission_house",
];
const ALLOWED_TRIGGERS = ["invoice_issued", "invoice_paid", "payment_received", "manual_approval"];

// ─── GET /commissions/:slug/lines ─────────────────────────────────────────────
router.get("/:slug/lines", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });

  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const q = req.query as Record<string, string>;
  const representativeId = q["representativeId"];
  const lineStatus = q["lineStatus"];
  const periodYear = q["periodYear"];
  const periodMonth = q["periodMonth"];
  const limit = q["limit"] ?? "500";
  const offset = q["offset"] ?? "0";

  try {
    const { lines, total } = await getCommissionLines({
      entityId,
      representativeId: representativeId || undefined,
      lineStatus: lineStatus || undefined,
      periodYear: periodYear ? parseInt(periodYear) : undefined,
      periodMonth: periodMonth ? parseInt(periodMonth) : undefined,
      limit: Math.min(parseInt(limit), 1000),
      offset: parseInt(offset),
    });
    return res.json({ ok: true, data: lines, total, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[commissions] lines error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── GET /commissions/:slug/summary ──────────────────────────────────────────
router.get("/:slug/summary", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });

  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  try {
    const summary = await getCommissionLineSummary(entityId);
    return res.json({ ok: true, data: summary, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[commissions] summary error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── GET /commissions/:slug/representatives ───────────────────────────────────
router.get("/:slug/representatives", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });
  try {
    const reps = await getCommissionRepresentatives();
    return res.json({ ok: true, data: reps, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[commissions] representatives error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── GET /commissions/:slug/rules ─────────────────────────────────────────────
router.get("/:slug/rules", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });

  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  try {
    const rules = await getCommissionRules(entityId);
    return res.json({ ok: true, data: rules, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[commissions] rules error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── POST /commissions/:slug/rules/preview ────────────────────────────────────
router.post("/:slug/rules/preview", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });

  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body = req.body as Record<string, unknown>;
  const representativeId = body["representativeId"];
  const formulaType = body["formulaType"];
  const payableTrigger = body["payableTrigger"] ?? "invoice_paid";

  if (!representativeId || typeof representativeId !== "string") {
    return res.status(400).json({ ok: false, error: "representativeId is required" });
  }
  if (!formulaType || !ALLOWED_FORMULA_TYPES.includes(formulaType as string)) {
    return res.status(400).json({ ok: false, error: "Invalid formulaType" });
  }
  if (!ALLOWED_TRIGGERS.includes(payableTrigger as string)) {
    return res.status(400).json({ ok: false, error: "Invalid payableTrigger" });
  }

  try {
    const preview = await previewRuleApplication({
      entityId,
      representativeId,
      customerNamePattern: (body["customerNamePattern"] as string) ?? null,
      formulaType: formulaType as string,
      calculationBasis: (body["calculationBasis"] as string) ?? null,
      commissionRate: body["commissionRate"] != null ? Number(body["commissionRate"]) : null,
      fixedAmount: body["fixedAmount"] != null ? Number(body["fixedAmount"]) : null,
      payableTrigger: payableTrigger as string,
    });
    return res.json({ ok: true, data: preview, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[commissions] preview error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── POST /commissions/:slug/rules ────────────────────────────────────────────
router.post("/:slug/rules", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });

  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body = req.body as Record<string, unknown>;
  const representativeId = body["representativeId"];
  const formulaType = body["formulaType"];
  const payableTrigger = body["payableTrigger"] ?? "invoice_paid";
  const effectiveFrom = body["effectiveFrom"];

  if (!representativeId || typeof representativeId !== "string") {
    return res.status(400).json({ ok: false, error: "representativeId is required" });
  }
  if (!formulaType || !ALLOWED_FORMULA_TYPES.includes(formulaType as string)) {
    return res.status(400).json({ ok: false, error: "Invalid formulaType" });
  }
  if (!ALLOWED_TRIGGERS.includes(payableTrigger as string)) {
    return res.status(400).json({ ok: false, error: "Invalid payableTrigger" });
  }
  if (!effectiveFrom || typeof effectiveFrom !== "string") {
    return res.status(400).json({ ok: false, error: "effectiveFrom is required (YYYY-MM-DD)" });
  }

  const user = (req as { user?: { name?: string; email?: string } }).user;
  const createdBy = user?.email ?? user?.name ?? "unknown";

  try {
    const rule = await createCommissionRule({
      entityId,
      representativeId,
      coreCustomerId: (body["coreCustomerId"] as string) ?? null,
      customerNamePattern: (body["customerNamePattern"] as string) ?? null,
      formulaType: formulaType as string,
      calculationBasis: (body["calculationBasis"] as string) ?? null,
      commissionRate: body["commissionRate"] != null ? Number(body["commissionRate"]) : null,
      fixedAmount: body["fixedAmount"] != null ? Number(body["fixedAmount"]) : null,
      payableTrigger: payableTrigger as string,
      effectiveFrom,
      effectiveTo: (body["effectiveTo"] as string) ?? null,
      notes: (body["notes"] as string) ?? null,
      createdBy,
    });
    return res.status(201).json({ ok: true, data: rule, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[commissions] create rule error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── POST /commissions/:slug/ingest ──────────────────────────────────────────
router.post("/:slug/ingest", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });

  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const { fromDate, toDate } = req.body as { fromDate?: string; toDate?: string };

  try {
    const result = await ingestEntityInvoices(entityId, { fromDate, toDate });
    return res.json({ ok: true, data: result, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[commissions] ingest error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── POST /commissions/:slug/lines/:id/approve ───────────────────────────────
router.post("/:slug/lines/:id/approve", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  const id   = req.params["id"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ ok: false, error: "Invalid line id" });

  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const user = (req as { user?: { name?: string; email?: string } }).user;
  const approvedBy = user?.email ?? user?.name ?? "unknown";

  try {
    await approveCommissionLine(id, approvedBy);
    return res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[commissions] approve error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── POST /commissions/:slug/periods/lock ────────────────────────────────────
router.post("/:slug/periods/lock", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });

  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const { year, month } = req.body as { year?: number; month?: number };
  if (!year || !month || month < 1 || month > 12) {
    return res.status(400).json({ ok: false, error: "year and month (1-12) required" });
  }

  const user = (req as { user?: { name?: string; email?: string } }).user;
  const lockedBy = user?.email ?? user?.name ?? "unknown";

  try {
    await lockCommissionPeriod(entityId, year, month, lockedBy);
    return res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    console.error("[commissions] lock period error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

export default router;
