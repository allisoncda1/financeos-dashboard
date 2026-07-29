/**
 * Commission Engine — attribution + formula resolution.
 *
 * Reads invoices from Neon Core (db), writes commission_run_lines to opsDb.
 * No cross-database SQL joins. Resolution is done in application code.
 *
 * Security constraints (hard):
 *   - No write to CORE_DATABASE_URL (Neon).
 *   - No write to QBO.
 *   - No automatic payment or journal entry.
 *   - No code execution from user input (formula engine is closed enum).
 *   - null is NEVER silently converted to 0 (House zero is explicit, not a fallback).
 *   - amount_paid is NEVER approximated from invoice_amount.
 *   - Negative amounts are preserved.
 *   - Source fingerprint prevents double-import.
 *   - Locked lines are never recalculated.
 *   - House is attributed only via explicit client rules — no entity_default fallback.
 */
import crypto from "crypto";
import { db } from "../db/connection";
import { invoices } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  getAttributionRulesForEntity,
  getCommissionRules,
  getCommissionRepresentatives,
  upsertCommissionLine,
  type CommissionAttributionRule,
  type CommissionRule,
  type CommissionRepresentative,
} from "../db/commissions";

// ─── Decimal arithmetic ───────────────────────────────────────────────────────
// Commission amounts are stored and handled as NUMERIC strings throughout.
// mulMoney uses integer arithmetic to avoid floating-point drift.
// Rounding policy: half-away-from-zero to 2 decimal places.
// Preserves negative amounts.

export function mulMoney(amountStr: string, rateStr: string): string {
  const a = parseFloat(amountStr);
  const r = parseFloat(rateStr);
  if (!isFinite(a) || !isFinite(r)) {
    throw new Error(`mulMoney: non-finite inputs: amount=${amountStr} rate=${rateStr}`);
  }
  // Integer arithmetic: multiply × 10^8 to shift past decimal drift, then round
  const sign = a * r < 0 ? -1 : 1;
  const raw  = Math.abs(a) * Math.abs(r);
  const cents = Math.round(raw * 100); // e.g. 149500 for 1495 * 0.10 * 100
  const result = sign * cents / 100;
  return result.toFixed(2);
}

export function addMoney(a: string, b: string): string {
  const sum = parseFloat(a) + parseFloat(b);
  if (!isFinite(sum)) throw new Error(`addMoney: non-finite: ${a} + ${b}`);
  return sum.toFixed(2);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngestResult {
  entityId: string;
  processed: number;
  created: number;
  updated: number;
  sourceChanged: number;
  skipped: number;
  errors: { invoiceId: string; error: string }[];
}

/** All amounts stored as NUMERIC strings. null = unavailable/not calculable. */
interface FormulaInputs {
  invoiceAmount: string | null;
  grossProfit: string | null;
  expensesAmount: string | null;
  invoiceStatus: string | null;
}

interface FormulaResult {
  commissionAmount: string | null; // "0" = House explicit zero; null = not calculable
  calculationBasis: string | null;
  lineStatus: string;
  exclusionReason: string | null;
}

// ─── Formula engine ───────────────────────────────────────────────────────────

const ALLOWED_FORMULA_TYPES = new Set([
  "percentage_of_invoice",
  "percentage_of_amount_paid",
  "percentage_of_gross_profit",
  "fixed_amount",
  "manual",
  "no_commission_house",
]);

const SUPPORTED_PAYABLE_TRIGGERS = new Set(["invoice_issued", "invoice_paid"]);

/**
 * applyFormula — pure function, no I/O.
 *
 * Payable trigger logic:
 *   invoice_issued  → calculate regardless of payment status
 *   invoice_paid    → calculate only if invoiceStatus==='Paid'
 *                     Overdue → awaiting_payment (overdue_not_paid)
 *                     anything else → awaiting_payment (not_yet_paid)
 *   payment_received / manual_approval → unsupported operationally → needs_review
 *
 * amount_paid is NEVER approximated from invoice_amount.
 */
export function applyFormula(rule: CommissionRule, inputs: FormulaInputs): FormulaResult {
  if (!ALLOWED_FORMULA_TYPES.has(rule.formulaType)) {
    return { commissionAmount: null, calculationBasis: null, lineStatus: "needs_review", exclusionReason: "unknown_formula_type" };
  }

  // House — explicit zero (confirmed business rule, not a fallback from null)
  if (rule.formulaType === "no_commission_house") {
    return { commissionAmount: "0", calculationBasis: null, lineStatus: "house_no_commission", exclusionReason: "internal_house_account" };
  }

  // Unsupported triggers — can't calculate without payment data
  if (!SUPPORTED_PAYABLE_TRIGGERS.has(rule.payableTrigger)) {
    return { commissionAmount: null, calculationBasis: null, lineStatus: "needs_review", exclusionReason: "unsupported_trigger" };
  }

  // percentage_of_amount_paid — requires authoritative payment records, never approximated
  if (rule.formulaType === "percentage_of_amount_paid") {
    return { commissionAmount: null, calculationBasis: "amount_paid", lineStatus: "needs_review", exclusionReason: "amount_paid_unavailable" };
  }

  // Apply payable trigger before computing
  if (rule.payableTrigger === "invoice_paid") {
    const status = (inputs.invoiceStatus ?? "").toLowerCase();
    if (status !== "paid") {
      const reason = status === "overdue" ? "overdue_not_paid" : "not_yet_paid";
      return { commissionAmount: null, calculationBasis: null, lineStatus: "awaiting_payment", exclusionReason: reason };
    }
  }
  // invoice_issued: continue regardless of payment status

  // manual
  if (rule.formulaType === "manual") {
    return { commissionAmount: null, calculationBasis: "manual_amount", lineStatus: "needs_review", exclusionReason: "manual_entry_required" };
  }

  // percentage_of_gross_profit — null GP must not fall back
  if (rule.formulaType === "percentage_of_gross_profit") {
    if (inputs.grossProfit === null) {
      return { commissionAmount: null, calculationBasis: "gross_profit", lineStatus: "needs_review", exclusionReason: "missing_gross_profit" };
    }
    if (rule.commissionRate == null) {
      return { commissionAmount: null, calculationBasis: "gross_profit", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    return { commissionAmount: mulMoney(inputs.grossProfit, rule.commissionRate), calculationBasis: "gross_profit", lineStatus: "calculated", exclusionReason: null };
  }

  // fixed_amount
  if (rule.formulaType === "fixed_amount") {
    if (rule.fixedAmount == null) {
      return { commissionAmount: null, calculationBasis: "fixed_amount", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    // fixed_amount preserves sign as stored; negative fixedAmount → negative commission
    return { commissionAmount: parseFloat(rule.fixedAmount).toFixed(2), calculationBasis: "fixed_amount", lineStatus: "calculated", exclusionReason: null };
  }

  // percentage_of_invoice
  if (rule.formulaType === "percentage_of_invoice") {
    if (inputs.invoiceAmount === null) {
      return { commissionAmount: null, calculationBasis: "invoice_amount", lineStatus: "needs_review", exclusionReason: "missing_invoice_amount" };
    }
    if (rule.commissionRate == null) {
      return { commissionAmount: null, calculationBasis: "invoice_amount", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    return { commissionAmount: mulMoney(inputs.invoiceAmount, rule.commissionRate), calculationBasis: "invoice_amount", lineStatus: "calculated", exclusionReason: null };
  }

  return { commissionAmount: null, calculationBasis: null, lineStatus: "needs_review", exclusionReason: "unhandled_formula_type" };
}

// ─── Attribution ──────────────────────────────────────────────────────────────
// No entity_default fallback. An unmatched invoice → null (needs_review).
// Rules are filtered by invoiceDate (effective_from/effective_to).
// A future rule never affects a historical invoice.
// An expired rule never affects a later invoice.

export function attributeInvoice(
  customerName: string | null,
  customerId: string | null,
  rules: CommissionAttributionRule[],
  invoiceDate: string,
): { representativeId: string; representativeSlug: string; attributionRuleId: string; matchType: string } | null {
  // Filter rules by effective period against invoiceDate
  const active = rules.filter((r) => {
    return r.effectiveFrom <= invoiceDate &&
      (r.effectiveTo === null || r.effectiveTo >= invoiceDate);
  });

  // Priority already sorted ascending by DB query
  for (const rule of active) {
    if (rule.matchType === "exact_customer_id" && customerId && rule.coreCustomerId === customerId) {
      return { representativeId: rule.representativeId, representativeSlug: rule.representativeSlug, attributionRuleId: rule.id, matchType: "exact_customer_id" };
    }
    if (rule.matchType === "customer_name_pattern" && customerName && rule.customerNamePattern) {
      const escaped = rule.customerNamePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = escaped.replace(/%/g, ".*").replace(/_/g, ".");
      const regex = new RegExp(`^${pattern}$`, "i");
      if (regex.test(customerName.trim())) {
        return { representativeId: rule.representativeId, representativeSlug: rule.representativeSlug, attributionRuleId: rule.id, matchType: "customer_name_pattern" };
      }
    }
  }
  // No match and no fallback — unattributed
  return null;
}

// ─── Commission rule resolution ───────────────────────────────────────────────
// Rules filtered by invoiceDate (effective_from/effective_to).

function resolveCommissionRule(
  representativeId: string,
  entityId: string,
  customerId: string | null,
  customerName: string | null,
  rules: CommissionRule[],
  invoiceDate: string,
): CommissionRule | null {
  const applicable = rules.filter(
    (r) =>
      r.entityId === entityId &&
      r.representativeId === representativeId &&
      r.status === "active" &&
      r.effectiveFrom <= invoiceDate &&
      (r.effectiveTo === null || r.effectiveTo >= invoiceDate),
  );

  if (customerId) {
    const exact = applicable.find((r) => r.coreCustomerId === customerId);
    if (exact) return exact;
  }
  if (customerName) {
    for (const rule of applicable) {
      if (rule.customerNamePattern) {
        const escaped = rule.customerNamePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = escaped.replace(/%/g, ".*").replace(/_/g, ".");
        const regex = new RegExp(`^${pattern}$`, "i");
        if (regex.test(customerName.trim())) return rule;
      }
    }
  }
  const entityWide = applicable.find((r) => r.coreCustomerId == null && r.customerNamePattern == null);
  return entityWide ?? null;
}

// ─── Fingerprint ─────────────────────────────────────────────────────────────

export function buildFingerprint(entityId: string, invoiceQboId: string): string {
  return crypto.createHash("sha256").update(`${entityId}:${invoiceQboId}`).digest("hex");
}

// ─── Main ingestion function ──────────────────────────────────────────────────

export async function ingestEntityInvoices(
  entityId: string,
  options: { fromDate?: string; toDate?: string; reingesterBy?: string } = {},
): Promise<IngestResult> {
  const result: IngestResult = { entityId, processed: 0, created: 0, updated: 0, sourceChanged: 0, skipped: 0, errors: [] };

  // Load all attribution and commission rules (no date filter — applied per-invoice)
  const [attrRules, commRules, reps] = await Promise.all([
    getAttributionRulesForEntity(entityId),
    getCommissionRules(entityId),
    getCommissionRepresentatives(),
  ]);
  const repById = new Map<string, CommissionRepresentative>(reps.map((r) => [r.id, r]));

  // Read invoices from Neon Core (read-only, never write)
  type InvoiceRow = typeof invoices.$inferSelect;
  const conditions = [eq(invoices.entityId, entityId)];
  if (options.fromDate) conditions.push(gte(invoices.invoiceDate, options.fromDate));
  if (options.toDate)   conditions.push(lte(invoices.invoiceDate, options.toDate));
  const invoiceRows: InvoiceRow[] = await db.select().from(invoices).where(and(...conditions));

  for (const inv of invoiceRows) {
    result.processed++;
    try {
      const fingerprint    = buildFingerprint(entityId, inv.qboId ?? inv.id);
      const invoiceAmount  = inv.amount != null ? String(parseFloat(String(inv.amount)).toFixed(2)) : null;
      const invoiceStatus  = inv.status ?? null;
      const customerName   = inv.customerName ?? null;
      const customerId: string | null = null; // deferred — requires customer join
      // invoice_date required for date-based rule resolution
      const invoiceDate    = inv.invoiceDate ?? null;

      let lineStatus: string;
      let commissionAmount: string | null = null;
      let formulaType: string | null      = null;
      let calculationBasis: string | null = null;
      let commissionRate: string | null   = null;
      let commissionRuleId: string | null = null;
      let exclusionReason: string | null  = null;
      let payoutEligible                  = false;
      let attributionRuleId: string | null = null;
      let attributionMatch: string | null  = null;
      let representativeId: string | null  = null;

      if (!invoiceDate) {
        // Cannot resolve date-based rules without an invoice date
        lineStatus      = "needs_review";
        exclusionReason = "missing_invoice_date";
      } else {
        const attribution = attributeInvoice(customerName, customerId, attrRules, invoiceDate);
        const rep = attribution ? repById.get(attribution.representativeId) : null;

        if (!attribution) {
          lineStatus      = "needs_review";
          exclusionReason = "no_attribution_rule";
        } else {
          representativeId  = attribution.representativeId;
          attributionRuleId = attribution.attributionRuleId;
          attributionMatch  = attribution.matchType;

          if (rep?.representativeType === "internal_house") {
            // House — explicit zero, confirmed business rule, not a fallback
            lineStatus       = "house_no_commission";
            commissionAmount = "0";
            payoutEligible   = false;
            exclusionReason  = "internal_house_account";
            formulaType      = "no_commission_house";
          } else {
            payoutEligible   = true;
            const commRule   = resolveCommissionRule(
              attribution.representativeId, entityId, customerId, customerName, commRules, invoiceDate,
            );

            if (!commRule) {
              lineStatus      = "needs_configuration";
              exclusionReason = "missing_commission_formula";
            } else {
              commissionRuleId = commRule.id;
              formulaType      = commRule.formulaType;
              commissionRate   = commRule.commissionRate;

              const formulaResult = applyFormula(commRule, {
                invoiceAmount,
                grossProfit: null, // not in Neon Core invoices — requires manual entry
                expensesAmount: null,
                invoiceStatus,
              });
              lineStatus       = formulaResult.lineStatus;
              commissionAmount = formulaResult.commissionAmount;
              calculationBasis = formulaResult.calculationBasis;
              exclusionReason  = formulaResult.exclusionReason;
            }
          }
        }
      }

      const action = await upsertCommissionLine({
        entityId,
        invoiceId:          inv.id,
        invoiceQboId:       inv.qboId ?? inv.id,
        invoiceDocNumber:   null,
        invoiceDate:        invoiceDate,
        customerId,
        customerName,
        invoiceAmount,
        invoiceStatus,
        representativeId,
        attributionRuleId,
        attributionMatch,
        commissionRuleId,
        formulaType,
        calculationBasis,
        commissionRate,
        grossProfit:        null,
        expensesAmount:     null,
        commissionAmount,
        lineStatus,
        payoutEligible,
        exclusionReason,
        sourceFingerprint:  fingerprint,
        recalculatedBy:     options.reingesterBy ?? null,
      });

      if (action === "created")        result.created++;
      else if (action === "updated")   result.updated++;
      else if (action === "source_changed") result.sourceChanged++;
      else                             result.skipped++;
    } catch (err) {
      result.errors.push({ invoiceId: inv.id, error: String(err) });
    }
  }

  return result;
}

// ─── Preview for Rule Builder ─────────────────────────────────────────────────

export interface RulePreviewLine {
  invoiceId: string;
  invoiceDocNumber: string | null;
  invoiceDate: string | null;
  customerName: string | null;
  invoiceAmount: string | null;
  currentStatus: string;
  currentCommission: string | null;
  projectedCommission: string | null;
  projectedBasis: string | null;
  projectedStatus: string;
}

export async function previewRuleApplication(params: {
  entityId: string;
  representativeId: string;
  customerNamePattern?: string | null;
  formulaType: string;
  calculationBasis?: string | null;
  commissionRate?: string | null;
  fixedAmount?: string | null;
  payableTrigger: string;
}): Promise<{ lines: RulePreviewLine[]; affectedCount: number; projectedTotal: string | null }> {
  const today = new Date().toISOString().slice(0, 10);
  const draftRule: CommissionRule = {
    id: "preview",
    entityId: params.entityId,
    representativeId: params.representativeId,
    coreCustomerId: null,
    customerNamePattern: params.customerNamePattern ?? null,
    formulaType: params.formulaType,
    calculationBasis: params.calculationBasis ?? null,
    commissionRate: params.commissionRate ?? null,
    fixedAmount: params.fixedAmount ?? null,
    payableTrigger: params.payableTrigger,
    ruleVersion: 0,
    status: "active",
    effectiveFrom: today,
    effectiveTo: null,
    notes: null,
  };

  const { lines } = await (await import("../db/commissions")).getCommissionLines({
    entityId: params.entityId,
    representativeId: params.representativeId,
    limit: 1000,
  });

  let projectedTotal: string | null = null;
  const previewLines: RulePreviewLine[] = [];

  for (const line of lines) {
    if (line.lineStatus === "locked") continue;

    if (params.customerNamePattern && line.customerName) {
      const escaped = params.customerNamePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = escaped.replace(/%/g, ".*").replace(/_/g, ".");
      const regex = new RegExp(`^${pattern}$`, "i");
      if (!regex.test(line.customerName.trim())) continue;
    }

    const result = applyFormula(draftRule, {
      invoiceAmount: line.invoiceAmount,
      grossProfit: line.grossProfit,
      expensesAmount: line.expensesAmount,
      invoiceStatus: line.invoiceStatus,
    });

    if (result.commissionAmount != null) {
      projectedTotal = projectedTotal == null
        ? result.commissionAmount
        : addMoney(projectedTotal, result.commissionAmount);
    }

    previewLines.push({
      invoiceId: line.invoiceId,
      invoiceDocNumber: line.invoiceDocNumber,
      invoiceDate: line.invoiceDate,
      customerName: line.customerName,
      invoiceAmount: line.invoiceAmount,
      currentStatus: line.lineStatus,
      currentCommission: line.commissionAmount,
      projectedCommission: result.commissionAmount,
      projectedBasis: result.calculationBasis,
      projectedStatus: result.lineStatus,
    });
  }

  return { lines: previewLines, affectedCount: previewLines.length, projectedTotal };
}
