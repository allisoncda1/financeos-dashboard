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
 *
 * Known limitations:
 *   - customerId is always null during ingestion: QBO invoices do not carry a canonical
 *     customer UUID without a separate customer join. Attribution relies on customer_name
 *     pattern matching only. Exact customer_id attribution requires a customer join that
 *     is not yet implemented. Ambiguous name matches remain in needs_review.
 */
import crypto from "crypto";
import { db } from "../db/connection";
import { invoices } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  getAttributionRulesForEntity,
  getCommissionRules,
  getCommissionRepresentatives,
  upsertCommissionLine,
  type CommissionAttributionRule,
  type CommissionRule,
  type CommissionRepresentative,
} from "../db/commissions";

// ─── Decimal arithmetic — BigInt-based, no floating-point ────────────────────
//
// All commission amounts are NUMERIC strings throughout.
// Intermediate calculations use BigInt scaled to 10^8 decimal places.
// Rounding policy: half-away-from-zero to 2 decimal places.
// Negative amounts are preserved.
//
// Accepted input format: /^-?\d{1,15}(\.\d{1,8})?$/
//   - No scientific notation (1e5, 1.5E+6)
//   - No NaN, Infinity
//   - Max 15 integer digits, max 8 decimal digits
//   - Negative sign prefix supported

const MONEY_RE = /^-?\d{1,15}(\.\d{1,8})?$/;
const SCALE = 100_000_000n; // 10^8

/** Parse a monetary string to an integer scaled by 10^8. Throws on invalid input. */
function parseToScaled(s: string): bigint {
  const t = s.trim();
  if (!MONEY_RE.test(t)) {
    throw new Error(`Invalid monetary value: "${t}" — expected decimal string, no scientific notation`);
  }
  const negative = t.startsWith("-");
  const abs = negative ? t.slice(1) : t;
  const [intPart, fracPart = ""] = abs.split(".");
  // Pad fractional part to exactly 8 digits
  const frac8 = (fracPart + "00000000").slice(0, 8);
  const scaled = BigInt(intPart) * SCALE + BigInt(frac8);
  return negative ? -scaled : scaled;
}

/** Format a BigInt cent value (10^2 scale) as a 2dp string. */
function centsToString(cents: bigint): string {
  const sign = cents < 0n ? -1n : 1n;
  const abs = cents < 0n ? -cents : cents;
  const dollars = abs / 100n;
  const rem = abs % 100n;
  return `${sign < 0n ? "-" : ""}${dollars}.${String(rem).padStart(2, "0")}`;
}

/**
 * mulMoney — multiply two monetary strings, round half-away-from-zero to 2dp.
 * Uses BigInt to avoid floating-point drift.
 *
 * Examples:
 *   mulMoney("1495.00", "0.150000") === "224.25"
 *   mulMoney("-500.00", "0.100000") === "-50.00"
 *   mulMoney("1.00",    "0.005000") === "0.01"  (half-cent rounds away from zero)
 */
export function mulMoney(amountStr: string, rateStr: string): string {
  const a = parseToScaled(amountStr); // scaled by 10^8
  const r = parseToScaled(rateStr);   // scaled by 10^8
  // Product is scaled by 10^16. We want result in cents (10^2),
  // so we divide by 10^14 with half-away-from-zero rounding.
  const product = a * r; // 10^16 scale
  const DIVISOR = 100_000_000_000_000n; // 10^14
  const HALF    =  50_000_000_000_000n; // 5 × 10^13  (half of DIVISOR)
  const sign    = product < 0n ? -1n : 1n;
  const absP    = product < 0n ? -product : product;
  const cents   = (absP + HALF) / DIVISOR;
  return centsToString(sign * cents);
}

/**
 * addMoney — add two 2dp monetary strings.
 * Inputs are expected to be 2dp outputs of mulMoney or "0".
 * Division by 10^6 is exact for 2dp inputs (no rounding needed).
 */
export function addMoney(a: string, b: string): string {
  const aS = parseToScaled(a); // 10^8 scale
  const bS = parseToScaled(b); // 10^8 scale
  const sum = aS + bS;          // 10^8 scale
  // Convert to cents: divide by 10^6 (exact for 2dp inputs where last 6 digits are 0)
  const CENTS_DIVISOR = 1_000_000n; // 10^6
  const sign = sum < 0n ? -1n : 1n;
  const abs  = sum < 0n ? -sum : sum;
  const cents = abs / CENTS_DIVISOR;
  return centsToString(sign * cents);
}

/**
 * deriveAmountPaid — compute amount_paid = amount − balance using BigInt arithmetic.
 * Returns null if either component is null. Preserves negative values.
 * Rounds half-away-from-zero to 2 decimal places.
 *
 * amount_paid is NEVER approximated: if either DB column is null, return null.
 */
export function deriveAmountPaid(amount: string | null, balance: string | null): string | null {
  if (amount === null || balance === null) return null;
  try {
    const aScaled = parseToScaled(amount.trim());
    const bScaled = parseToScaled(balance.trim());
    const diff = aScaled - bScaled;
    const CENTS_DIVISOR = 1_000_000n;
    const HALF = 500_000n;
    const sign = diff < 0n ? -1n : 1n;
    const abs = diff < 0n ? -diff : diff;
    const cents = (abs + HALF) / CENTS_DIVISOR;
    return centsToString(sign * cents);
  } catch {
    return null;
  }
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
  amountPaid: string | null;       // derived: amount − balance; null if either component is null
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
 *   payment_received / manual_approval → unsupported → needs_review/unsupported_trigger
 *
 * amount_paid is NEVER approximated from invoice_amount.
 * fixed_amount is returned as-is from the DB string (NUMERIC(12,2) → always 2dp).
 */
export function applyFormula(rule: CommissionRule, inputs: FormulaInputs): FormulaResult {
  if (!ALLOWED_FORMULA_TYPES.has(rule.formulaType)) {
    return { commissionAmount: null, calculationBasis: null, lineStatus: "needs_review", exclusionReason: "unknown_formula_type" };
  }

  // House — explicit zero (confirmed business rule, not a fallback from null)
  if (rule.formulaType === "no_commission_house") {
    return { commissionAmount: "0", calculationBasis: null, lineStatus: "house_no_commission", exclusionReason: "internal_house_account" };
  }

  // Unsupported triggers — can't calculate without authoritative payment data
  if (!SUPPORTED_PAYABLE_TRIGGERS.has(rule.payableTrigger)) {
    return { commissionAmount: null, calculationBasis: null, lineStatus: "needs_review", exclusionReason: "unsupported_trigger" };
  }

  // Apply payable trigger before any formula calculation
  if (rule.payableTrigger === "invoice_paid") {
    const status = (inputs.invoiceStatus ?? "").toLowerCase();
    if (status !== "paid") {
      const reason = status === "overdue" ? "overdue_not_paid" : "not_yet_paid";
      return { commissionAmount: null, calculationBasis: null, lineStatus: "awaiting_payment", exclusionReason: reason };
    }
  }
  // invoice_issued: continue regardless of payment status

  // percentage_of_amount_paid — only reached after trigger gate passes
  if (rule.formulaType === "percentage_of_amount_paid") {
    if (inputs.amountPaid === null) {
      return { commissionAmount: null, calculationBasis: "amount_paid", lineStatus: "needs_review", exclusionReason: "amount_paid_unavailable" };
    }
    if (rule.commissionRate == null) {
      return { commissionAmount: null, calculationBasis: "amount_paid", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    return { commissionAmount: mulMoney(inputs.amountPaid, rule.commissionRate), calculationBasis: "amount_paid", lineStatus: "calculated", exclusionReason: null };
  }

  // manual
  if (rule.formulaType === "manual") {
    return { commissionAmount: null, calculationBasis: "manual_amount", lineStatus: "needs_review", exclusionReason: "manual_entry_required" };
  }

  // percentage_of_gross_profit — null GP must not fall back to invoice_amount
  if (rule.formulaType === "percentage_of_gross_profit") {
    if (inputs.grossProfit === null) {
      return { commissionAmount: null, calculationBasis: "gross_profit", lineStatus: "needs_review", exclusionReason: "missing_gross_profit" };
    }
    if (rule.commissionRate == null) {
      return { commissionAmount: null, calculationBasis: "gross_profit", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    return { commissionAmount: mulMoney(inputs.grossProfit, rule.commissionRate), calculationBasis: "gross_profit", lineStatus: "calculated", exclusionReason: null };
  }

  // fixed_amount — stored as NUMERIC(12,2) string from DB; validate then return
  if (rule.formulaType === "fixed_amount") {
    if (rule.fixedAmount == null) {
      return { commissionAmount: null, calculationBasis: "fixed_amount", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    // Validate and normalize via BigInt path (no parseFloat)
    const scaled = parseToScaled(rule.fixedAmount);
    const CENTS_DIVISOR = 1_000_000n;
    const sign = scaled < 0n ? -1n : 1n;
    const abs = scaled < 0n ? -scaled : scaled;
    const cents = abs / CENTS_DIVISOR;
    const normalized = centsToString(sign * cents);
    return { commissionAmount: normalized, calculationBasis: "fixed_amount", lineStatus: "calculated", exclusionReason: null };
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
// customerNamePattern '%' (global wildcard) is rejected in rule creation.

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

  // Priority already sorted ascending by DB query (lower number = higher priority)
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
  // No match and no fallback — unattributed; caller sets needs_review
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

  const [attrRules, commRules, reps] = await Promise.all([
    getAttributionRulesForEntity(entityId),
    getCommissionRules(entityId),
    getCommissionRepresentatives(),
  ]);
  const repById = new Map<string, CommissionRepresentative>(reps.map((r) => [r.id, r]));

  type InvoiceRow = typeof invoices.$inferSelect;
  const conditions = [eq(invoices.entityId, entityId)];
  if (options.fromDate) conditions.push(gte(invoices.invoiceDate, options.fromDate));
  if (options.toDate)   conditions.push(lte(invoices.invoiceDate, options.toDate));
  // Exclude soft-deleted invoices. IS NOT TRUE covers both FALSE and NULL.
  conditions.push(sql`${invoices.isDeleted} IS NOT TRUE`);
  const invoiceRows: InvoiceRow[] = await db.select().from(invoices).where(and(...conditions));

  for (const inv of invoiceRows) {
    result.processed++;
    try {
      const fingerprint   = buildFingerprint(entityId, inv.qboId ?? inv.id);
      // Invoice amount and amount_paid: stored as NUMERIC strings, BigInt path (no parseFloat)
      const rawAmount     = inv.amount  != null ? String(inv.amount)  : null;
      const rawBalance    = inv.balance != null ? String(inv.balance) : null;
      const invoiceAmount = rawAmount  != null ? normalizeMoneyString(rawAmount)  : null;
      const amountPaid    = deriveAmountPaid(rawAmount, rawBalance); // null if either column is null
      const invoiceStatus = inv.status ?? null;
      const customerName  = inv.customerName ?? null;
      // customerId: always null — QBO invoices lack canonical customer UUID without a join.
      // Limitation documented; ambiguous name matches → needs_review.
      const customerId: string | null = null;
      const invoiceDate   = inv.invoiceDate ?? null;

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
                amountPaid,        // derived from amount − balance; null if either is null
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

      if (action === "created")            result.created++;
      else if (action === "updated")       result.updated++;
      else if (action === "source_changed") result.sourceChanged++;
      else                                 result.skipped++;
    } catch (err) {
      result.errors.push({ invoiceId: inv.id, error: String(err) });
    }
  }

  return result;
}

/** Normalize a raw DB amount string to a valid 2dp monetary string without parseFloat. */
function normalizeMoneyString(s: string): string {
  const scaled = parseToScaled(String(s).trim());
  const CENTS_DIVISOR = 1_000_000n;
  const HALF = 500_000n;
  const sign = scaled < 0n ? -1n : 1n;
  const abs = scaled < 0n ? -scaled : scaled;
  const cents = (abs + HALF) / CENTS_DIVISOR;
  return centsToString(sign * cents);
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
      invoiceAmount:  line.invoiceAmount,
      amountPaid:     null, // not stored in commission_run_lines; balance not available in preview
      grossProfit:    line.grossProfit,
      expensesAmount: line.expensesAmount,
      invoiceStatus:  line.invoiceStatus,
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
