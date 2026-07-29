/**
 * Commission module — operational DB queries (opsDb / DATABASE_URL only).
 *
 * Security constraints:
 *   - Never reads from or writes to Neon Core (db / CORE_DATABASE_URL).
 *   - All user-supplied values go through parameterized sql`` tags.
 *   - No sql.raw() with user values.
 *   - Null is never silently converted to zero.
 *   - locked lines are immutable.
 *   - approved lines flag source_changed if source fields differ on re-sync.
 */
import { opsDb } from "./connection";
import { sql } from "drizzle-orm";

// ─── Validation helpers ───────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_LINE_STATUSES = new Set([
  "attributed","house_no_commission","needs_configuration","needs_review",
  "calculated","awaiting_payment","ready_for_review","approved","locked","excluded",
]);

export function isValidUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function assertValidUuid(v: unknown, name: string): string {
  if (!isValidUuid(v)) throw new Error(`Invalid UUID for ${name}: ${String(v)}`);
  return v;
}

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
  matchType: "exact_customer_id" | "customer_name_pattern";
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
  commissionRate: string | null;   // stored as NUMERIC string — use mulMoney, never Number()
  fixedAmount: string | null;      // stored as NUMERIC string
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
  invoiceAmount: string | null;    // NUMERIC string
  invoiceStatus: string | null;
  representativeId: string | null;
  representativeSlug: string | null;
  representativeDisplayName: string | null;
  attributionMatchType: string | null;
  commissionRuleId: string | null;
  formulaType: string | null;
  calculationBasis: string | null;
  commissionRate: string | null;   // NUMERIC string
  grossProfit: string | null;      // NUMERIC string
  expensesAmount: string | null;   // NUMERIC string
  commissionAmount: string | null; // NUMERIC string — null = not calculable; "0" = House explicit zero
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
// Loads ALL rules for the entity without date filtering.
// Date-based filtering (effective_from / effective_to vs invoice_date) is done
// in application code per-invoice in commissionEngine.ts.

export async function getAttributionRulesForEntity(entityId: string): Promise<CommissionAttributionRule[]> {
  assertValidUuid(entityId, "entityId");
  const rows = await opsDb.execute(sql`
    SELECT r.id, r.entity_id, r.core_customer_id, r.customer_name_pattern,
           r.match_type, r.priority, r.representative_id,
           rep.slug AS representative_slug,
           r.effective_from::text, r.effective_to::text, r.notes
    FROM commission_attribution_rules r
    JOIN commission_representatives rep ON rep.id = r.representative_id
    WHERE r.entity_id = ${entityId}::uuid
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
    effectiveFrom: r.effective_from as string,
    effectiveTo: r.effective_to as string | null,
    notes: r.notes as string | null,
  }));
}

// ─── Commission rules ─────────────────────────────────────────────────────────

export async function getCommissionRules(entityId?: string): Promise<CommissionRule[]> {
  if (entityId) assertValidUuid(entityId, "entityId");

  const rows = entityId
    ? await opsDb.execute(sql`
        SELECT r.id, r.entity_id, r.representative_id, r.core_customer_id,
               r.customer_name_pattern, r.formula_type, r.calculation_basis,
               r.commission_rate::text, r.fixed_amount::text, r.payable_trigger,
               r.rule_version, r.status, r.effective_from::text, r.effective_to::text, r.notes
        FROM commission_rules r
        WHERE r.entity_id = ${entityId}::uuid AND r.status = 'active'
        ORDER BY r.entity_id, r.representative_id, r.effective_from DESC
      `)
    : await opsDb.execute(sql`
        SELECT r.id, r.entity_id, r.representative_id, r.core_customer_id,
               r.customer_name_pattern, r.formula_type, r.calculation_basis,
               r.commission_rate::text, r.fixed_amount::text, r.payable_trigger,
               r.rule_version, r.status, r.effective_from::text, r.effective_to::text, r.notes
        FROM commission_rules r
        WHERE r.status = 'active'
        ORDER BY r.entity_id, r.representative_id, r.effective_from DESC
      `);

  return (rows.rows as Record<string, unknown>[]).map(mapCommissionRule);
}

/** Transactional rule creation: MAX(version)+1, supersede old, write audit.
 *  If insert fails, old rule stays active (transaction rolls back). */
export async function createCommissionRule(rule: {
  entityId: string;
  representativeId: string;
  coreCustomerId?: string | null;
  customerNamePattern?: string | null;
  formulaType: string;
  calculationBasis?: string | null;
  commissionRate?: string | null;
  fixedAmount?: string | null;
  payableTrigger: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  createdBy?: string;
  reason?: string;
}): Promise<CommissionRule> {
  assertValidUuid(rule.entityId, "entityId");
  assertValidUuid(rule.representativeId, "representativeId");
  if (rule.coreCustomerId) assertValidUuid(rule.coreCustomerId, "coreCustomerId");

  const result = await opsDb.execute(sql`
    WITH
    -- Step 1: compute next version number for this scope
    next_ver AS (
      SELECT COALESCE(MAX(rule_version), 0) + 1 AS v
      FROM commission_rules
      WHERE entity_id = ${rule.entityId}::uuid
        AND representative_id = ${rule.representativeId}::uuid
        AND (
          (${rule.coreCustomerId ?? null}::uuid IS NULL AND core_customer_id IS NULL)
          OR core_customer_id = ${rule.coreCustomerId ?? null}::uuid
        )
        AND (
          (${rule.customerNamePattern ?? null}::text IS NULL AND customer_name_pattern IS NULL)
          OR customer_name_pattern = ${rule.customerNamePattern ?? null}
        )
    ),
    -- Step 2: supersede old active rules for same scope
    superseded AS (
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
          (${rule.customerNamePattern ?? null}::text IS NULL AND customer_name_pattern IS NULL)
          OR customer_name_pattern = ${rule.customerNamePattern ?? null}
        )
      RETURNING id, formula_type, commission_rate, payable_trigger, rule_version
    ),
    -- Step 3: insert new rule with next version
    new_rule AS (
      INSERT INTO commission_rules (
        entity_id, representative_id, core_customer_id, customer_name_pattern,
        formula_type, calculation_basis, commission_rate, fixed_amount,
        payable_trigger, effective_from, effective_to, notes, created_by,
        rule_version
      )
      SELECT
        ${rule.entityId}::uuid,
        ${rule.representativeId}::uuid,
        ${rule.coreCustomerId ?? null}::uuid,
        ${rule.customerNamePattern ?? null},
        ${rule.formulaType},
        ${rule.calculationBasis ?? null},
        ${rule.commissionRate ?? null}::numeric,
        ${rule.fixedAmount ?? null}::numeric,
        ${rule.payableTrigger},
        ${rule.effectiveFrom}::date,
        ${rule.effectiveTo ?? null}::date,
        ${rule.notes ?? null},
        ${rule.createdBy ?? null},
        next_ver.v
      FROM next_ver
      RETURNING id, entity_id, representative_id, core_customer_id,
                customer_name_pattern, formula_type, calculation_basis,
                commission_rate::text, fixed_amount::text, payable_trigger,
                rule_version, status, effective_from::text, effective_to::text, notes
    ),
    -- Step 4: write audit for the new rule
    _audit AS (
      INSERT INTO commission_rule_audit (rule_id, action, performed_by, reason, snapshot)
      SELECT
        new_rule.id,
        'created',
        ${rule.createdBy ?? null},
        ${rule.reason ?? null},
        jsonb_build_object(
          'formula_type', new_rule.formula_type,
          'commission_rate', new_rule.commission_rate,
          'payable_trigger', new_rule.payable_trigger,
          'rule_version', new_rule.rule_version,
          'superseded_ids', (SELECT jsonb_agg(s.id) FROM superseded s)
        )
      FROM new_rule
    )
    SELECT * FROM new_rule
  `);

  const r = result.rows[0] as Record<string, unknown>;
  return mapCommissionRule(r);
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
  // Validate all filter inputs
  if (filters.entityId) assertValidUuid(filters.entityId, "entityId");
  if (filters.representativeId) assertValidUuid(filters.representativeId, "representativeId");
  if (filters.lineStatus && !VALID_LINE_STATUSES.has(filters.lineStatus)) {
    throw new Error(`Invalid lineStatus: ${filters.lineStatus}`);
  }
  const year = filters.periodYear;
  const month = filters.periodMonth;
  if (year !== undefined && (year < 2000 || year > 2100)) throw new Error(`Invalid periodYear: ${year}`);
  if (month !== undefined && (month < 1 || month > 12)) throw new Error(`Invalid periodMonth: ${month}`);
  const limit = Math.min(Math.max(1, filters.limit ?? 500), 1000);
  const offset = Math.max(0, Math.floor(filters.offset ?? 0));

  // All conditions use parameterized sql`` — no user values concatenated into strings
  const baseQuery = sql`
    FROM commission_run_lines cl
    LEFT JOIN commission_representatives rep ON rep.id = cl.representative_id
    WHERE 1=1
      ${filters.entityId        ? sql`AND cl.entity_id = ${filters.entityId}::uuid` : sql``}
      ${filters.representativeId ? sql`AND cl.representative_id = ${filters.representativeId}::uuid` : sql``}
      ${filters.lineStatus       ? sql`AND cl.line_status = ${filters.lineStatus}` : sql``}
      ${year != null && month != null ? sql`AND EXTRACT(YEAR FROM cl.invoice_date) = ${year} AND EXTRACT(MONTH FROM cl.invoice_date) = ${month}` : sql``}
  `;

  const rows = await opsDb.execute(sql`
    SELECT
      cl.id, cl.entity_id, cl.invoice_id, cl.invoice_qbo_id, cl.invoice_doc_number,
      cl.invoice_date::text, cl.customer_id, cl.customer_name,
      cl.invoice_amount::text, cl.invoice_status, cl.representative_id,
      rep.slug AS representative_slug,
      rep.display_name AS representative_display_name,
      cl.attribution_match AS attribution_match_type,
      cl.commission_rule_id, cl.formula_type, cl.calculation_basis,
      cl.commission_rate::text, cl.gross_profit::text, cl.expenses_amount::text,
      cl.commission_amount::text,
      cl.line_status, cl.payout_eligible, cl.exclusion_reason, cl.source_fingerprint,
      cl.created_at::text, cl.updated_at::text,
      cl.approved_at::text, cl.approved_by,
      cl.locked_at::text, cl.locked_by
    ${baseQuery}
    ORDER BY cl.invoice_date DESC NULLS LAST, cl.customer_name ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countRows = await opsDb.execute(sql`SELECT COUNT(*) AS total ${baseQuery}`);
  const total = Number((countRows.rows[0] as Record<string, unknown>).total ?? 0);
  return { lines: (rows.rows as Record<string, unknown>[]).map(mapRunLine), total };
}

export async function getCommissionLineSummary(entityId?: string) {
  if (entityId) assertValidUuid(entityId, "entityId");

  const rows = await opsDb.execute(sql`
    SELECT
      rep.slug AS rep_slug,
      rep.display_name AS rep_name,
      rep.payout_eligible,
      COUNT(*) AS line_count,
      SUM(cl.invoice_amount)::text AS total_invoice_amount,
      SUM(cl.gross_profit)::text   AS total_gross_profit,
      SUM(cl.commission_amount)::text AS total_commission,
      COUNT(*) FILTER (WHERE cl.line_status = 'needs_configuration') AS needs_config,
      COUNT(*) FILTER (WHERE cl.line_status = 'needs_review')        AS needs_review,
      COUNT(*) FILTER (WHERE cl.line_status = 'calculated')          AS calculated,
      COUNT(*) FILTER (WHERE cl.line_status = 'approved')            AS approved,
      COUNT(*) FILTER (WHERE cl.line_status = 'locked')              AS locked
    FROM commission_run_lines cl
    LEFT JOIN commission_representatives rep ON rep.id = cl.representative_id
    WHERE 1=1
      ${entityId ? sql`AND cl.entity_id = ${entityId}::uuid` : sql``}
    GROUP BY rep.slug, rep.display_name, rep.payout_eligible
    ORDER BY rep.payout_eligible DESC, rep.display_name ASC
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    repSlug: r.rep_slug as string | null,
    repName: r.rep_name as string | null,
    payoutEligible: r.payout_eligible as boolean | null,
    lineCount: Number(r.line_count),
    totalInvoiceAmount: r.total_invoice_amount as string | null,
    totalGrossProfit: r.total_gross_profit as string | null,
    totalCommission: r.total_commission as string | null,
    needsConfig: Number(r.needs_config),
    needsReview: Number(r.needs_review),
    calculated: Number(r.calculated),
    approved: Number(r.approved),
    locked: Number(r.locked),
  }));
}

/** Upsert result — distinguishes created, updated, skipped.
 *  source_changed: approved line where source fields differ (flags for review). */
export type UpsertAction = "created" | "updated" | "skipped" | "source_changed";

export async function upsertCommissionLine(line: {
  entityId: string;
  invoiceId: string;
  invoiceQboId: string;
  invoiceDocNumber?: string | null;
  invoiceDate?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  invoiceAmount?: string | null;
  invoiceStatus?: string | null;
  representativeId?: string | null;
  attributionRuleId?: string | null;
  attributionMatch?: string | null;
  commissionRuleId?: string | null;
  formulaType?: string | null;
  calculationBasis?: string | null;
  commissionRate?: string | null;
  grossProfit?: string | null;
  expensesAmount?: string | null;
  commissionAmount?: string | null;
  lineStatus: string;
  payoutEligible: boolean;
  exclusionReason?: string | null;
  sourceFingerprint: string;
  recalculatedBy?: string | null;
}): Promise<UpsertAction> {
  // Check for existing line
  const existing = await opsDb.execute(sql`
    SELECT id, line_status, invoice_amount::text, invoice_status, customer_name
    FROM commission_run_lines
    WHERE source_fingerprint = ${line.sourceFingerprint}
    LIMIT 1
  `);

  if (existing.rows.length === 0) {
    // New line — insert
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
        ${line.invoiceAmount ?? null}::numeric,
        ${line.invoiceStatus ?? null},
        ${line.representativeId ?? null}::uuid,
        ${line.attributionRuleId ?? null}::uuid,
        ${line.attributionMatch ?? null},
        ${line.commissionRuleId ?? null}::uuid,
        ${line.formulaType ?? null},
        ${line.calculationBasis ?? null},
        ${line.commissionRate ?? null}::numeric,
        ${line.grossProfit ?? null}::numeric,
        ${line.expensesAmount ?? null}::numeric,
        ${line.commissionAmount ?? null}::numeric,
        ${line.lineStatus},
        ${line.payoutEligible},
        ${line.exclusionReason ?? null},
        ${line.sourceFingerprint}
      )
    `);
    return "created";
  }

  const ex = existing.rows[0] as Record<string, unknown>;
  const currentStatus = ex.line_status as string;

  // Locked lines are immutable
  if (currentStatus === "locked") return "skipped";

  // Approved lines: if source fields changed, flag for review
  if (currentStatus === "approved") {
    const sourceChanged =
      ex.invoice_amount !== (line.invoiceAmount ?? null) ||
      ex.invoice_status !== (line.invoiceStatus ?? null) ||
      ex.customer_name  !== (line.customerName ?? null);
    if (sourceChanged) {
      await opsDb.execute(sql`
        UPDATE commission_run_lines
        SET
          invoice_amount     = ${line.invoiceAmount ?? null}::numeric,
          invoice_status     = ${line.invoiceStatus ?? null},
          customer_name      = ${line.customerName ?? null},
          customer_id        = ${line.customerId ?? null}::uuid,
          representative_id  = ${line.representativeId ?? null}::uuid,
          attribution_rule_id = ${line.attributionRuleId ?? null}::uuid,
          attribution_match  = ${line.attributionMatch ?? null},
          commission_rule_id = ${line.commissionRuleId ?? null}::uuid,
          formula_type       = ${line.formulaType ?? null},
          calculation_basis  = ${line.calculationBasis ?? null},
          commission_rate    = ${line.commissionRate ?? null}::numeric,
          commission_amount  = NULL,
          payout_eligible    = ${line.payoutEligible},
          exclusion_reason   = 'source_changed',
          line_status        = 'needs_review',
          recalculated_at    = now(),
          recalculated_by    = ${line.recalculatedBy ?? null},
          updated_at         = now()
        WHERE source_fingerprint = ${line.sourceFingerprint}
      `);
      return "source_changed";
    }
    return "skipped";
  }

  // All other non-locked, non-approved lines: full update
  await opsDb.execute(sql`
    UPDATE commission_run_lines
    SET
      invoice_amount      = ${line.invoiceAmount ?? null}::numeric,
      invoice_status      = ${line.invoiceStatus ?? null},
      customer_id         = ${line.customerId ?? null}::uuid,
      customer_name       = ${line.customerName ?? null},
      representative_id   = ${line.representativeId ?? null}::uuid,
      attribution_rule_id = ${line.attributionRuleId ?? null}::uuid,
      attribution_match   = ${line.attributionMatch ?? null},
      commission_rule_id  = ${line.commissionRuleId ?? null}::uuid,
      formula_type        = ${line.formulaType ?? null},
      calculation_basis   = ${line.calculationBasis ?? null},
      commission_rate     = ${line.commissionRate ?? null}::numeric,
      commission_amount   = ${line.commissionAmount ?? null}::numeric,
      payout_eligible     = ${line.payoutEligible},
      exclusion_reason    = ${line.exclusionReason ?? null},
      line_status         = ${line.lineStatus},
      recalculated_at     = now(),
      recalculated_by     = ${line.recalculatedBy ?? null},
      updated_at          = now()
    WHERE source_fingerprint = ${line.sourceFingerprint}
  `);
  return "updated";
}

/** Approve a single calculated line.
 *  Returns false if no line was updated (wrong status, wrong entity, or not found). */
export async function approveCommissionLine(
  lineId: string,
  entityId: string,
  approvedBy: string,
): Promise<boolean> {
  assertValidUuid(lineId, "lineId");
  assertValidUuid(entityId, "entityId");
  const result = await opsDb.execute(sql`
    UPDATE commission_run_lines
    SET line_status = 'approved', approved_at = now(), approved_by = ${approvedBy}, updated_at = now()
    WHERE id = ${lineId}::uuid
      AND entity_id = ${entityId}::uuid
      AND line_status = 'calculated'
  `);
  return (result.rowCount ?? 0) > 0;
}

/** Lock a commission period.
 *  Pre-checks: all external lines must be approved; house lines may be house_no_commission.
 *  Returns 409 error string if pre-checks fail; otherwise locks atomically in a transaction.
 *  Returns null on success. */
export async function lockCommissionPeriod(
  entityId: string,
  year: number,
  month: number,
  lockedBy: string,
): Promise<string | null> {
  assertValidUuid(entityId, "entityId");
  if (month < 1 || month > 12) throw new Error("Invalid month");

  // Pre-check: count external lines not yet approved
  const blockingRows = await opsDb.execute(sql`
    SELECT COUNT(*) AS blocking
    FROM commission_run_lines cl
    JOIN commission_representatives rep ON rep.id = cl.representative_id
    WHERE cl.entity_id = ${entityId}::uuid
      AND EXTRACT(YEAR  FROM cl.invoice_date) = ${year}
      AND EXTRACT(MONTH FROM cl.invoice_date) = ${month}
      AND rep.representative_type = 'external_rep'
      AND cl.line_status NOT IN ('approved', 'locked')
  `);
  const blocking = Number((blockingRows.rows[0] as Record<string, unknown>).blocking ?? 0);
  if (blocking > 0) {
    return `Cannot lock: ${blocking} external line(s) are not yet approved`;
  }

  // Pre-check: no needs_review or needs_configuration for any rep type
  const problemRows = await opsDb.execute(sql`
    SELECT COUNT(*) AS problems
    FROM commission_run_lines cl
    WHERE cl.entity_id = ${entityId}::uuid
      AND EXTRACT(YEAR  FROM cl.invoice_date) = ${year}
      AND EXTRACT(MONTH FROM cl.invoice_date) = ${month}
      AND cl.line_status IN ('needs_review', 'needs_configuration', 'calculated', 'attributed')
  `);
  const problems = Number((problemRows.rows[0] as Record<string, unknown>).problems ?? 0);
  if (problems > 0) {
    return `Cannot lock: ${problems} line(s) in unresolved status (needs_review/needs_configuration/calculated/attributed)`;
  }

  // Atomic lock — update lines and upsert period in one transaction
  await opsDb.execute(sql`
    WITH locked_lines AS (
      UPDATE commission_run_lines
      SET line_status = 'locked', locked_at = now(), locked_by = ${lockedBy}, updated_at = now()
      WHERE entity_id = ${entityId}::uuid
        AND EXTRACT(YEAR  FROM invoice_date) = ${year}
        AND EXTRACT(MONTH FROM invoice_date) = ${month}
        AND line_status IN ('approved', 'house_no_commission')
      RETURNING id
    )
    INSERT INTO commission_periods (entity_id, period_year, period_month, status, locked_at, locked_by)
    VALUES (${entityId}::uuid, ${year}, ${month}, 'locked', now(), ${lockedBy})
    ON CONFLICT (entity_id, period_year, period_month)
    DO UPDATE SET status = 'locked', locked_at = now(), locked_by = ${lockedBy}
  `);
  return null;
}

// ─── Internal mappers ─────────────────────────────────────────────────────────

function mapCommissionRule(r: Record<string, unknown>): CommissionRule {
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    representativeId: r.representative_id as string,
    coreCustomerId: r.core_customer_id as string | null,
    customerNamePattern: r.customer_name_pattern as string | null,
    formulaType: r.formula_type as string,
    calculationBasis: r.calculation_basis as string | null,
    commissionRate: r.commission_rate as string | null,
    fixedAmount: r.fixed_amount as string | null,
    payableTrigger: r.payable_trigger as string,
    ruleVersion: r.rule_version as number,
    status: r.status as string,
    effectiveFrom: String(r.effective_from),
    effectiveTo: r.effective_to ? String(r.effective_to) : null,
    notes: r.notes as string | null,
  };
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
    invoiceAmount: r.invoice_amount as string | null,
    invoiceStatus: r.invoice_status as string | null,
    representativeId: r.representative_id as string | null,
    representativeSlug: r.representative_slug as string | null,
    representativeDisplayName: r.representative_display_name as string | null,
    attributionMatchType: r.attribution_match_type as string | null,
    commissionRuleId: r.commission_rule_id as string | null,
    formulaType: r.formula_type as string | null,
    calculationBasis: r.calculation_basis as string | null,
    commissionRate: r.commission_rate as string | null,
    grossProfit: r.gross_profit as string | null,
    expensesAmount: r.expenses_amount as string | null,
    commissionAmount: r.commission_amount as string | null,
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
