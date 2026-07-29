/**
 * Commission module — operational DB queries (opsDb / DATABASE_URL only).
 * Never reads from or writes to Neon Core (db / CORE_DATABASE_URL).
 */
import { opsDb } from "./connection";
import { sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommissionRepresentative {
  id: string;
  slug: string;
  displayName: string;
  representativeType: "external_rep" | "internal_house";
  payoutEligible: boolean;
  notes: string | null;
}

export interface CommissionAttributionRule {
  id: string;
  entityId: string;
  coreCustomerId: string | null;
  customerNamePattern: string | null;
  matchType: "exact_customer_id" | "customer_name_pattern" | "entity_default";
  priority: number;
  representativeId: string;
  representativeSlug: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface CommissionRule {
  id: string;
  entityId: string;
  representativeId: string;
  coreCustomerId: string | null;
  customerNamePattern: string | null;
  formulaType: string;
  calculationBasis: string | null;
  commissionRate: number | null;
  fixedAmount: number | null;
  payableTrigger: string;
  ruleVersion: number;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface CommissionRunLine {
  id: string;
  entityId: string;
  invoiceId: string;
  invoiceQboId: string;
  invoiceDocNumber: string | null;
  invoiceDate: string | null;
  customerId: string | null;
  customerName: string | null;
  invoiceAmount: number | null;
  invoiceStatus: string | null;
  representativeId: string | null;
  representativeSlug: string | null;
  representativeDisplayName: string | null;
  attributionMatchType: string | null;
  commissionRuleId: string | null;
  formulaType: string | null;
  calculationBasis: string | null;
  commissionRate: number | null;
  grossProfit: number | null;
  expensesAmount: number | null;
  commissionAmount: number | null;
  lineStatus: string;
  payoutEligible: boolean;
  exclusionReason: string | null;
  sourceFingerprint: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
}

// ─── Representatives ──────────────────────────────────────────────────────────

export async function getCommissionRepresentatives(): Promise<CommissionRepresentative[]> {
  const rows = await opsDb.execute(sql`
    SELECT id, slug, display_name, representative_type, payout_eligible, notes
    FROM commission_representatives
    ORDER BY representative_type ASC, display_name ASC
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    displayName: r.display_name as string,
    representativeType: r.representative_type as "external_rep" | "internal_house",
    payoutEligible: r.payout_eligible as boolean,
    notes: r.notes as string | null,
  }));
}

// ─── Attribution rules ────────────────────────────────────────────────────────

export async function getAttributionRulesForEntity(entityId: string): Promise<CommissionAttributionRule[]> {
  const rows = await opsDb.execute(sql`
    SELECT r.id, r.entity_id, r.core_customer_id, r.customer_name_pattern,
           r.match_type, r.priority, r.representative_id,
           rep.slug AS representative_slug,
           r.effective_from, r.effective_to, r.notes
    FROM commission_attribution_rules r
    JOIN commission_representatives rep ON rep.id = r.representative_id
    WHERE r.entity_id = ${entityId}::uuid
      AND r.effective_from <= CURRENT_DATE
      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
    ORDER BY r.priority ASC
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    entityId: r.entity_id as string,
    coreCustomerId: r.core_customer_id as string | null,
    customerNamePattern: r.customer_name_pattern as string | null,
    matchType: r.match_type as CommissionAttributionRule["matchType"],
    priority: r.priority as number,
    representativeId: r.representative_id as string,
    representativeSlug: r.representative_slug as string,
    effectiveFrom: String(r.effective_from),
    effectiveTo: r.effective_to ? String(r.effective_to) : null,
    notes: r.notes as string | null,
  }));
}

// ─── Commission rules ─────────────────────────────────────────────────────────

export async function getCommissionRules(entityId?: string): Promise<CommissionRule[]> {
  const whereClause = entityId
    ? sql`WHERE r.entity_id = ${entityId}::uuid AND r.status = 'active'`
    : sql`WHERE r.status = 'active'`;

  const rows = await opsDb.execute(sql`
    SELECT r.id, r.entity_id, r.representative_id, r.core_customer_id,
           r.customer_name_pattern, r.formula_type, r.calculation_basis,
           r.commission_rate, r.fixed_amount, r.payable_trigger,
           r.rule_version, r.status, r.effective_from, r.effective_to, r.notes
    FROM commission_rules r
    ${whereClause}
    ORDER BY r.entity_id, r.representative_id, r.effective_from DESC
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    entityId: r.entity_id as string,
    representativeId: r.representative_id as string,
    coreCustomerId: r.core_customer_id as string | null,
    customerNamePattern: r.customer_name_pattern as string | null,
    formulaType: r.formula_type as string,
    calculationBasis: r.calculation_basis as string | null,
    commissionRate: r.commission_rate != null ? Number(r.commission_rate) : null,
    fixedAmount: r.fixed_amount != null ? Number(r.fixed_amount) : null,
    payableTrigger: r.payable_trigger as string,
    ruleVersion: r.rule_version as number,
    status: r.status as string,
    effectiveFrom: String(r.effective_from),
    effectiveTo: r.effective_to ? String(r.effective_to) : null,
    notes: r.notes as string | null,
  }));
}

export async function createCommissionRule(rule: {
  entityId: string;
  representativeId: string;
  coreCustomerId?: string | null;
  customerNamePattern?: string | null;
  formulaType: string;
  calculationBasis?: string | null;
  commissionRate?: number | null;
  fixedAmount?: number | null;
  payableTrigger: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  createdBy?: string;
}): Promise<CommissionRule> {
  // Supersede any existing active rules for same entity+rep scope
  await opsDb.execute(sql`
    UPDATE commission_rules
    SET status = 'superseded', updated_at = now()
    WHERE entity_id = ${rule.entityId}::uuid
      AND representative_id = ${rule.representativeId}::uuid
      AND status = 'active'
      AND (
        (${rule.coreCustomerId ?? null}::uuid IS NULL AND core_customer_id IS NULL)
        OR core_customer_id = ${rule.coreCustomerId ?? null}::uuid
      )
      AND (
        (${rule.customerNamePattern ?? null} IS NULL AND customer_name_pattern IS NULL)
        OR customer_name_pattern = ${rule.customerNamePattern ?? null}
      )
  `);

  const rows = await opsDb.execute(sql`
    INSERT INTO commission_rules (
      entity_id, representative_id, core_customer_id, customer_name_pattern,
      formula_type, calculation_basis, commission_rate, fixed_amount,
      payable_trigger, effective_from, effective_to, notes, created_by
    ) VALUES (
      ${rule.entityId}::uuid,
      ${rule.representativeId}::uuid,
      ${rule.coreCustomerId ?? null}::uuid,
      ${rule.customerNamePattern ?? null},
      ${rule.formulaType},
      ${rule.calculationBasis ?? null},
      ${rule.commissionRate ?? null},
      ${rule.fixedAmount ?? null},
      ${rule.payableTrigger},
      ${rule.effectiveFrom}::date,
      ${rule.effectiveTo ?? null}::date,
      ${rule.notes ?? null},
      ${rule.createdBy ?? null}
    )
    RETURNING id, entity_id, representative_id, core_customer_id,
              customer_name_pattern, formula_type, calculation_basis,
              commission_rate, fixed_amount, payable_trigger, rule_version,
              status, effective_from, effective_to, notes
  `);
  const r = rows.rows[0] as Record<string, unknown>;
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    representativeId: r.representative_id as string,
    coreCustomerId: r.core_customer_id as string | null,
    customerNamePattern: r.customer_name_pattern as string | null,
    formulaType: r.formula_type as string,
    calculationBasis: r.calculation_basis as string | null,
    commissionRate: r.commission_rate != null ? Number(r.commission_rate) : null,
    fixedAmount: r.fixed_amount != null ? Number(r.fixed_amount) : null,
    payableTrigger: r.payable_trigger as string,
    ruleVersion: r.rule_version as number,
    status: r.status as string,
    effectiveFrom: String(r.effective_from),
    effectiveTo: r.effective_to ? String(r.effective_to) : null,
    notes: r.notes as string | null,
  };
}

// ─── Commission run lines ─────────────────────────────────────────────────────

export async function getCommissionLines(filters: {
  entityId?: string;
  representativeId?: string;
  lineStatus?: string;
  periodYear?: number;
  periodMonth?: number;
  limit?: number;
  offset?: number;
}): Promise<{ lines: CommissionRunLine[]; total: number }> {
  const conditions: string[] = ["1=1"];
  if (filters.entityId) conditions.push(`cl.entity_id = '${filters.entityId}'::uuid`);
  if (filters.representativeId) conditions.push(`cl.representative_id = '${filters.representativeId}'::uuid`);
  if (filters.lineStatus) conditions.push(`cl.line_status = '${filters.lineStatus}'`);
  if (filters.periodYear && filters.periodMonth) {
    conditions.push(
      `EXTRACT(YEAR FROM cl.invoice_date) = ${filters.periodYear} AND EXTRACT(MONTH FROM cl.invoice_date) = ${filters.periodMonth}`
    );
  }
  const where = conditions.join(" AND ");
  const limit = filters.limit ?? 500;
  const offset = filters.offset ?? 0;

  const rows = await opsDb.execute(sql.raw(`
    SELECT
      cl.id, cl.entity_id, cl.invoice_id, cl.invoice_qbo_id, cl.invoice_doc_number,
      cl.invoice_date::text, cl.customer_id, cl.customer_name, cl.invoice_amount,
      cl.invoice_status, cl.representative_id,
      rep.slug AS representative_slug,
      rep.display_name AS representative_display_name,
      cl.attribution_match AS attribution_match_type,
      cl.commission_rule_id, cl.formula_type, cl.calculation_basis,
      cl.commission_rate, cl.gross_profit, cl.expenses_amount, cl.commission_amount,
      cl.line_status, cl.payout_eligible, cl.exclusion_reason, cl.source_fingerprint,
      cl.created_at::text, cl.updated_at::text,
      cl.approved_at::text, cl.approved_by,
      cl.locked_at::text, cl.locked_by
    FROM commission_run_lines cl
    LEFT JOIN commission_representatives rep ON rep.id = cl.representative_id
    WHERE ${where}
    ORDER BY cl.invoice_date DESC NULLS LAST, cl.customer_name ASC
    LIMIT ${limit} OFFSET ${offset}
  `));

  const countRows = await opsDb.execute(sql.raw(`
    SELECT COUNT(*) AS total
    FROM commission_run_lines cl
    WHERE ${where}
  `));

  const total = Number((countRows.rows[0] as Record<string, unknown>).total ?? 0);
  const lines = (rows.rows as Record<string, unknown>[]).map(mapRunLine);
  return { lines, total };
}

export async function getCommissionLineSummary(entityId?: string) {
  const where = entityId ? `AND cl.entity_id = '${entityId}'::uuid` : "";
  const rows = await opsDb.execute(sql.raw(`
    SELECT
      rep.slug AS rep_slug,
      rep.display_name AS rep_name,
      rep.payout_eligible,
      COUNT(*) AS line_count,
      SUM(cl.invoice_amount) AS total_invoice_amount,
      SUM(cl.gross_profit) AS total_gross_profit,
      SUM(cl.commission_amount) AS total_commission,
      COUNT(*) FILTER (WHERE cl.line_status = 'needs_configuration') AS needs_config,
      COUNT(*) FILTER (WHERE cl.line_status = 'needs_review') AS needs_review,
      COUNT(*) FILTER (WHERE cl.line_status = 'calculated') AS calculated,
      COUNT(*) FILTER (WHERE cl.line_status = 'approved') AS approved,
      COUNT(*) FILTER (WHERE cl.line_status = 'locked') AS locked
    FROM commission_run_lines cl
    LEFT JOIN commission_representatives rep ON rep.id = cl.representative_id
    WHERE 1=1 ${where}
    GROUP BY rep.slug, rep.display_name, rep.payout_eligible
    ORDER BY rep.payout_eligible DESC, rep.display_name ASC
  `));
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    repSlug: r.rep_slug as string | null,
    repName: r.rep_name as string | null,
    payoutEligible: r.payout_eligible as boolean | null,
    lineCount: Number(r.line_count),
    totalInvoiceAmount: r.total_invoice_amount != null ? Number(r.total_invoice_amount) : null,
    totalGrossProfit: r.total_gross_profit != null ? Number(r.total_gross_profit) : null,
    totalCommission: r.total_commission != null ? Number(r.total_commission) : null,
    needsConfig: Number(r.needs_config),
    needsReview: Number(r.needs_review),
    calculated: Number(r.calculated),
    approved: Number(r.approved),
    locked: Number(r.locked),
  }));
}

export async function upsertCommissionLine(line: {
  entityId: string;
  invoiceId: string;
  invoiceQboId: string;
  invoiceDocNumber?: string | null;
  invoiceDate?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  invoiceAmount?: number | null;
  invoiceStatus?: string | null;
  representativeId?: string | null;
  attributionRuleId?: string | null;
  attributionMatch?: string | null;
  commissionRuleId?: string | null;
  formulaType?: string | null;
  calculationBasis?: string | null;
  commissionRate?: number | null;
  grossProfit?: number | null;
  expensesAmount?: number | null;
  commissionAmount?: number | null;
  lineStatus: string;
  payoutEligible: boolean;
  exclusionReason?: string | null;
  sourceFingerprint: string;
}): Promise<void> {
  await opsDb.execute(sql`
    INSERT INTO commission_run_lines (
      entity_id, invoice_id, invoice_qbo_id, invoice_doc_number, invoice_date,
      customer_id, customer_name, invoice_amount, invoice_status,
      representative_id, attribution_rule_id, attribution_match,
      commission_rule_id, formula_type, calculation_basis, commission_rate,
      gross_profit, expenses_amount, commission_amount,
      line_status, payout_eligible, exclusion_reason, source_fingerprint
    ) VALUES (
      ${line.entityId}::uuid,
      ${line.invoiceId}::uuid,
      ${line.invoiceQboId},
      ${line.invoiceDocNumber ?? null},
      ${line.invoiceDate ?? null}::date,
      ${line.customerId ?? null}::uuid,
      ${line.customerName ?? null},
      ${line.invoiceAmount ?? null},
      ${line.invoiceStatus ?? null},
      ${line.representativeId ?? null}::uuid,
      ${line.attributionRuleId ?? null}::uuid,
      ${line.attributionMatch ?? null},
      ${line.commissionRuleId ?? null}::uuid,
      ${line.formulaType ?? null},
      ${line.calculationBasis ?? null},
      ${line.commissionRate ?? null},
      ${line.grossProfit ?? null},
      ${line.expensesAmount ?? null},
      ${line.commissionAmount ?? null},
      ${line.lineStatus},
      ${line.payoutEligible},
      ${line.exclusionReason ?? null},
      ${line.sourceFingerprint}
    )
    ON CONFLICT (source_fingerprint) DO UPDATE SET
      invoice_status    = EXCLUDED.invoice_status,
      invoice_amount    = EXCLUDED.invoice_amount,
      customer_name     = EXCLUDED.customer_name,
      line_status       = CASE
        WHEN commission_run_lines.line_status = 'locked' THEN commission_run_lines.line_status
        ELSE EXCLUDED.line_status
      END,
      updated_at        = now()
  `);
}

export async function approveCommissionLine(lineId: string, approvedBy: string): Promise<void> {
  await opsDb.execute(sql`
    UPDATE commission_run_lines
    SET line_status = 'approved', approved_at = now(), approved_by = ${approvedBy}, updated_at = now()
    WHERE id = ${lineId}::uuid AND line_status = 'calculated'
  `);
}

export async function lockCommissionPeriod(
  entityId: string, year: number, month: number, lockedBy: string
): Promise<void> {
  await opsDb.execute(sql`
    UPDATE commission_run_lines
    SET line_status = 'locked', locked_at = now(), locked_by = ${lockedBy}, updated_at = now()
    WHERE entity_id = ${entityId}::uuid
      AND EXTRACT(YEAR  FROM invoice_date) = ${year}
      AND EXTRACT(MONTH FROM invoice_date) = ${month}
      AND line_status = 'approved'
  `);
  await opsDb.execute(sql`
    INSERT INTO commission_periods (entity_id, period_year, period_month, status, locked_at, locked_by)
    VALUES (${entityId}::uuid, ${year}, ${month}, 'locked', now(), ${lockedBy})
    ON CONFLICT (entity_id, period_year, period_month)
    DO UPDATE SET status = 'locked', locked_at = now(), locked_by = ${lockedBy}
  `);
}

function mapRunLine(r: Record<string, unknown>): CommissionRunLine {
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    invoiceId: r.invoice_id as string,
    invoiceQboId: r.invoice_qbo_id as string,
    invoiceDocNumber: r.invoice_doc_number as string | null,
    invoiceDate: r.invoice_date as string | null,
    customerId: r.customer_id as string | null,
    customerName: r.customer_name as string | null,
    invoiceAmount: r.invoice_amount != null ? Number(r.invoice_amount) : null,
    invoiceStatus: r.invoice_status as string | null,
    representativeId: r.representative_id as string | null,
    representativeSlug: r.representative_slug as string | null,
    representativeDisplayName: r.representative_display_name as string | null,
    attributionMatchType: r.attribution_match_type as string | null,
    commissionRuleId: r.commission_rule_id as string | null,
    formulaType: r.formula_type as string | null,
    calculationBasis: r.calculation_basis as string | null,
    commissionRate: r.commission_rate != null ? Number(r.commission_rate) : null,
    grossProfit: r.gross_profit != null ? Number(r.gross_profit) : null,
    expensesAmount: r.expenses_amount != null ? Number(r.expenses_amount) : null,
    commissionAmount: r.commission_amount != null ? Number(r.commission_amount) : null,
    lineStatus: r.line_status as string,
    payoutEligible: r.payout_eligible as boolean,
    exclusionReason: r.exclusion_reason as string | null,
    sourceFingerprint: r.source_fingerprint as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    approvedAt: r.approved_at as string | null,
    approvedBy: r.approved_by as string | null,
    lockedAt: r.locked_at as string | null,
    lockedBy: r.locked_by as string | null,
  };
}
