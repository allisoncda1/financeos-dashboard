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
 *   - null is never silently converted to 0.
 *   - Negative amounts are preserved.
 *   - Source fingerprint prevents double-import.
 *   - Locked lines are never recalculated.
 */
import crypto from "crypto";
import { db } from "../db/connection";
import { invoices, customers } from "@workspace/db";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import {
  getAttributionRulesForEntity,
  getCommissionRules,
  getCommissionRepresentatives,
  upsertCommissionLine,
  type CommissionAttributionRule,
  type CommissionRule,
  type CommissionRepresentative,
} from "../db/commissions";
import { parseNumeric } from "./numerics";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngestResult {
  entityId: string;
  processed: number;
  created: number;
  updated: number;
  errors: { invoiceId: string; error: string }[];
}

// ─── Formula engine ───────────────────────────────────────────────────────────

/** Controlled formula types — no free code execution. */
const ALLOWED_FORMULA_TYPES = new Set([
  "percentage_of_invoice",
  "percentage_of_amount_paid",
  "percentage_of_gross_profit",
  "fixed_amount",
  "manual",
  "no_commission_house",
]);

interface FormulaInputs {
  invoiceAmount: number | null;
  grossProfit: number | null;       // null means unknown, not zero
  expensesAmount: number | null;
  invoiceStatus: string | null;
}

interface FormulaResult {
  commissionAmount: number | null;  // null = not calculable
  calculationBasis: string | null;
  lineStatus: string;
  exclusionReason: string | null;
}

export function applyFormula(rule: CommissionRule, inputs: FormulaInputs): FormulaResult {
  if (!ALLOWED_FORMULA_TYPES.has(rule.formulaType)) {
    return { commissionAmount: null, calculationBasis: null, lineStatus: "needs_review", exclusionReason: "unknown_formula_type" };
  }

  if (rule.formulaType === "no_commission_house") {
    return { commissionAmount: 0, calculationBasis: null, lineStatus: "house_no_commission", exclusionReason: "internal_house_account" };
  }

  if (rule.formulaType === "fixed_amount") {
    if (rule.fixedAmount == null) {
      return { commissionAmount: null, calculationBasis: "fixed_amount", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    return { commissionAmount: rule.fixedAmount, calculationBasis: "fixed_amount", lineStatus: "calculated", exclusionReason: null };
  }

  if (rule.formulaType === "manual") {
    return { commissionAmount: null, calculationBasis: "manual_amount", lineStatus: "needs_review", exclusionReason: "manual_entry_required" };
  }

  if (rule.formulaType === "percentage_of_gross_profit") {
    if (inputs.grossProfit === null) {
      // gross_profit missing — cannot calculate, do not fall back to invoice_amount
      return { commissionAmount: null, calculationBasis: "gross_profit", lineStatus: "needs_review", exclusionReason: "missing_gross_profit" };
    }
    if (rule.commissionRate == null) {
      return { commissionAmount: null, calculationBasis: "gross_profit", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    // Preserve negatives
    return { commissionAmount: inputs.grossProfit * rule.commissionRate, calculationBasis: "gross_profit", lineStatus: "calculated", exclusionReason: null };
  }

  if (rule.formulaType === "percentage_of_invoice") {
    if (inputs.invoiceAmount === null) {
      return { commissionAmount: null, calculationBasis: "invoice_amount", lineStatus: "needs_review", exclusionReason: "missing_invoice_amount" };
    }
    if (rule.commissionRate == null) {
      return { commissionAmount: null, calculationBasis: "invoice_amount", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    return { commissionAmount: inputs.invoiceAmount * rule.commissionRate, calculationBasis: "invoice_amount", lineStatus: "calculated", exclusionReason: null };
  }

  if (rule.formulaType === "percentage_of_amount_paid") {
    // amount_paid ≈ invoice_amount when balance=0 (paid); otherwise 0 or partial
    // The dashboard doesn't have a separate payments table — use invoice_amount when status=Paid
    const isPaid = (inputs.invoiceStatus ?? "").toLowerCase() === "paid";
    const basis = isPaid ? inputs.invoiceAmount : null;
    if (basis === null) {
      return { commissionAmount: null, calculationBasis: "amount_paid", lineStatus: "needs_review", exclusionReason: "invoice_not_paid" };
    }
    if (rule.commissionRate == null) {
      return { commissionAmount: null, calculationBasis: "amount_paid", lineStatus: "needs_configuration", exclusionReason: "missing_commission_formula" };
    }
    return { commissionAmount: basis * rule.commissionRate, calculationBasis: "amount_paid", lineStatus: "calculated", exclusionReason: null };
  }

  return { commissionAmount: null, calculationBasis: null, lineStatus: "needs_review", exclusionReason: "unhandled_formula_type" };
}

// ─── Attribution ──────────────────────────────────────────────────────────────

function attributeInvoice(
  customerName: string | null,
  customerId: string | null,
  rules: CommissionAttributionRule[],
): { representativeId: string; representativeSlug: string; attributionRuleId: string; matchType: string } | null {
  // Sort by priority already done in DB query (ORDER BY priority ASC)
  for (const rule of rules) {
    if (rule.matchType === "entity_default") continue; // handled as fallback below

    if (rule.matchType === "exact_customer_id" && customerId && rule.coreCustomerId === customerId) {
      return { representativeId: rule.representativeId, representativeSlug: rule.representativeSlug, attributionRuleId: rule.id, matchType: "exact_customer_id" };
    }

    if (rule.matchType === "customer_name_pattern" && customerName && rule.customerNamePattern) {
      // Convert SQL ILIKE pattern to JS regex: % → .*, _ → .
      const pattern = rule.customerNamePattern
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // escape regex chars first
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      const regex = new RegExp(`^${pattern}$`, "i");
      if (regex.test(customerName.trim())) {
        return { representativeId: rule.representativeId, representativeSlug: rule.representativeSlug, attributionRuleId: rule.id, matchType: "customer_name_pattern" };
      }
    }
  }

  // Fallback to entity_default (always House)
  const defaultRule = rules.find((r) => r.matchType === "entity_default");
  if (defaultRule) {
    return { representativeId: defaultRule.representativeId, representativeSlug: defaultRule.representativeSlug, attributionRuleId: defaultRule.id, matchType: "entity_default" };
  }

  return null;
}

// ─── Commission rule resolution ───────────────────────────────────────────────

function resolveCommissionRule(
  representativeId: string,
  entityId: string,
  customerId: string | null,
  customerName: string | null,
  rules: CommissionRule[],
): CommissionRule | null {
  const entityRules = rules.filter(
    (r) => r.entityId === entityId && r.representativeId === representativeId && r.status === "active"
  );

  // 1. Exact customer match
  if (customerId) {
    const exact = entityRules.find((r) => r.coreCustomerId === customerId);
    if (exact) return exact;
  }

  // 2. Name pattern match
  if (customerName) {
    for (const rule of entityRules) {
      if (rule.customerNamePattern) {
        const pattern = rule.customerNamePattern
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/%/g, ".*")
          .replace(/_/g, ".");
        const regex = new RegExp(`^${pattern}$`, "i");
        if (regex.test(customerName.trim())) return rule;
      }
    }
  }

  // 3. Entity-wide rule for this rep (no customer scope)
  const entityWide = entityRules.find((r) => r.coreCustomerId == null && r.customerNamePattern == null);
  if (entityWide) return entityWide;

  return null;
}

// ─── Fingerprint ─────────────────────────────────────────────────────────────

export function buildFingerprint(entityId: string, invoiceQboId: string): string {
  return crypto
    .createHash("sha256")
    .update(`${entityId}:${invoiceQboId}`)
    .digest("hex");
}

// ─── Main ingestion function ──────────────────────────────────────────────────

export async function ingestEntityInvoices(
  entityId: string,
  options: { fromDate?: string; toDate?: string } = {}
): Promise<IngestResult> {
  const result: IngestResult = { entityId, processed: 0, created: 0, updated: 0, errors: [] };

  // Load attribution rules and commission rules for this entity
  const [attrRules, commRules, reps] = await Promise.all([
    getAttributionRulesForEntity(entityId),
    getCommissionRules(entityId),
    getCommissionRepresentatives(),
  ]);

  const repById = new Map<string, CommissionRepresentative>(reps.map((r) => [r.id, r]));

  // Read invoices from Neon Core (read-only)
  type InvoiceRow = typeof invoices.$inferSelect;
  const conditions = [eq(invoices.entityId, entityId)];
  if (options.fromDate) conditions.push(gte(invoices.invoiceDate, options.fromDate));
  if (options.toDate)   conditions.push(lte(invoices.invoiceDate, options.toDate));

  const invoiceRows: InvoiceRow[] = await db
    .select()
    .from(invoices)
    .where(and(...conditions));

  for (const inv of invoiceRows) {
    result.processed++;
    try {
      const fingerprint = buildFingerprint(entityId, inv.qboId ?? inv.id);
      const invoiceAmount = inv.amount != null ? parseNumeric(inv.amount) : null;
      const invoiceStatus = inv.status ?? null;
      const customerName = inv.customerName ?? null;
      const customerId: string | null = null; // customer_id resolution requires additional join; deferred

      // Attribute to a representative
      const attribution = attributeInvoice(customerName, customerId, attrRules);
      const rep = attribution ? repById.get(attribution.representativeId) : null;

      // Determine line status and commission
      let lineStatus = "attributed";
      let commissionAmount: number | null = null;
      let formulaType: string | null = null;
      let calculationBasis: string | null = null;
      let commissionRate: number | null = null;
      let commissionRuleId: string | null = null;
      let exclusionReason: string | null = null;
      let payoutEligible = false;

      if (!attribution) {
        lineStatus = "needs_review";
        exclusionReason = "no_attribution_rule";
      } else if (rep?.representativeType === "internal_house") {
        // House — explicit zero, confirmed business rule
        lineStatus = "house_no_commission";
        commissionAmount = 0;
        payoutEligible = false;
        exclusionReason = "internal_house_account";
        formulaType = "no_commission_house";
      } else {
        payoutEligible = true;
        const commRule = resolveCommissionRule(
          attribution.representativeId,
          entityId,
          customerId,
          customerName,
          commRules,
        );

        if (!commRule) {
          lineStatus = "needs_configuration";
          exclusionReason = "missing_commission_formula";
        } else {
          commissionRuleId = commRule.id;
          formulaType = commRule.formulaType;
          commissionRate = commRule.commissionRate;

          const formulaResult = applyFormula(commRule, {
            invoiceAmount,
            grossProfit: null, // GP is not in Neon Core invoices — must be entered manually or via Excel import
            expensesAmount: null,
            invoiceStatus,
          });
          lineStatus = formulaResult.lineStatus;
          commissionAmount = formulaResult.commissionAmount;
          calculationBasis = formulaResult.calculationBasis;
          exclusionReason = formulaResult.exclusionReason;
        }
      }

      await upsertCommissionLine({
        entityId,
        invoiceId: inv.id,
        invoiceQboId: inv.qboId ?? inv.id,
        invoiceDocNumber: null,
        invoiceDate: inv.invoiceDate ?? null,
        customerId,
        customerName,
        invoiceAmount,
        invoiceStatus,
        representativeId: attribution?.representativeId ?? null,
        attributionRuleId: attribution?.attributionRuleId ?? null,
        attributionMatch: attribution?.matchType ?? null,
        commissionRuleId,
        formulaType,
        calculationBasis,
        commissionRate,
        grossProfit: null,       // not available from Neon Core; must be supplied via UI or Excel import
        expensesAmount: null,
        commissionAmount,
        lineStatus,
        payoutEligible,
        exclusionReason,
        sourceFingerprint: fingerprint,
      });

      result.created++; // upsert handles created vs updated internally
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
  invoiceAmount: number | null;
  currentStatus: string;
  currentCommission: number | null;
  projectedCommission: number | null;
  projectedBasis: string | null;
  projectedStatus: string;
}

export async function previewRuleApplication(params: {
  entityId: string;
  representativeId: string;
  customerNamePattern?: string | null;
  formulaType: string;
  calculationBasis?: string | null;
  commissionRate?: number | null;
  fixedAmount?: number | null;
  payableTrigger: string;
}): Promise<{ lines: RulePreviewLine[]; affectedCount: number; projectedTotal: number | null }> {
  // Build a synthetic rule for preview (not saved)
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
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: null,
    notes: null,
  };

  // Get existing lines for this entity+rep from opsDb
  const { lines } = await (await import("../db/commissions")).getCommissionLines({
    entityId: params.entityId,
    representativeId: params.representativeId,
    limit: 1000,
  });

  let projectedTotal: number | null = null;
  const previewLines: RulePreviewLine[] = [];

  for (const line of lines) {
    // Skip locked lines
    if (line.lineStatus === "locked") continue;

    // Apply customer scope filter if pattern provided
    if (params.customerNamePattern && line.customerName) {
      const pattern = params.customerNamePattern
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
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
      projectedTotal = (projectedTotal ?? 0) + result.commissionAmount;
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
