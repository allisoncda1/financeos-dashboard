/**
 * Commission module — operational DB queries (opsDb / COMMISSION_DATABASE_URL only).
 *
 * Security constraints:
 *   - Never reads from or writes to Neon Core (db / CORE_DATABASE_URL).
 *   - All user-supplied values go through parameterized sql`` tags.
 *   - No sql.raw() with user values.
 *   - Null is never silently converted to zero.
 *   - Locked lines are immutable.
 *   - Approved lines flag source_changed if source fields differ on re-sync;
 *     approved_at/approved_by are cleared when a line re-enters needs_review.
 */
import { getCommissionOpsDb } from "./ops-connection";
import { sql } from "drizzle-orm";

// ─── Validation helpers ───────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_LINE_STATUSES = new Set([
  "attributed","house_no_commission","needs_configuration","needs_review",
  "calculated","awaiting_payment","ready_for_review","approved","locked","excluded",
]);
const ALLOWED_FORMULA_TYPES = new Set([
  "percentage_of_invoice","percentage_of_amount_paid","percentage_of_gross_profit",
  "fixed_amount","manual","no_commission_house",
]);
const ALLOWED_TRIGGERS = new Set(["invoice_issued","invoice_paid","payment_received","manual_approval"]);

export function isValidUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function assertValidUuid(v: unknown, name: string): string {
  if (!isValidUuid(v)) throw new Error(`Invalid UUID for ${name}: ${String(v)}`);
  return v;
}

function assertValidDate(v: unknown, name: string): string {
  if (typeof v !== "string" || !DATE_RE.test(v))
    throw new Error(`Invalid ISO date for ${name}: ${String(v)}`);
  // Strict calendar validation — rejects normalised dates (e.g. 2026-02-31 → Mar 3).
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
    throw new Error(`Invalid calendar date for ${name}: ${String(v)}`);
  return v;
}

/**
 * Strict decimal validator — rejects "1abc", "1e2", "NaN", "Infinity", and
 * values that would silently truncate in NUMERIC SQL columns.
 *
 * @param maxDp  Maximum decimal places (enforces DB column precision).
 */
const _STRICT_DECIMAL_RE = /^-?\d+(\.\d+)?$/;

function assertValidNumericString(
  v: string | null | undefined,
  name: string,
  opts: { min?: number; max?: number; maxDp?: number } = {},
): string | null {
  if (v == null) return null;
  // Reject scientific notation, whitespace (leading, trailing, or internal), partial parses, NaN, Infinity.
  if (!_STRICT_DECIMAL_RE.test(v))
    throw new Error(`${name} must be a plain decimal number (no scientific notation, suffix, or whitespace): "${v}"`);
  const n = Number(v);  // Number() — unlike parseFloat — returns NaN for "1abc"
  if (!isFinite(n)) throw new Error(`${name} must be finite: ${v}`);
  if (opts.min !== undefined && n < opts.min) throw new Error(`${name} must be >= ${opts.min}: ${n}`);
  if (opts.max !== undefined && n > opts.max) throw new Error(`${name} must be <= ${opts.max}: ${n}`);
  if (opts.maxDp !== undefined) {
    const dp = (v.split(".")[1] ?? "").length;
    if (dp > opts.maxDp)
      throw new Error(`${name} must have at most ${opts.maxDp} decimal place(s): "${v}"`);
  }
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
  commissionRate: string | null;   // NUMERIC string — use mulMoney, never Number()
  fixedAmount: string | null;      // NUMERIC string
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

// ─── Period-lock helpers (shared by lockCommissionPeriod and upsertCommissionLine) ───

/** Parse year and month from a YYYY-MM-DD string. */
function _parsePeriod(dateStr: string): [number, number] {
  const parts = dateStr.split("-");
  return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
}

/**
 * Returns the set of (year, month) periods to advisory-lock, sorted in a
 * deterministic order (ascending by year*100+month) to prevent deadlocks when
 * multiple transactions lock different periods.
 */
function _sortedUniquePeriods(
  newYear: number, newMonth: number,
  prevDateStr: string | null,
): Array<[number, number]> {
  const periods: Array<[number, number]> = [[newYear, newMonth]];
  if (prevDateStr) {
    const [oldYear, oldMonth] = _parsePeriod(prevDateStr);
    if (oldYear !== newYear || oldMonth !== newMonth) {
      periods.push([oldYear, oldMonth]);
    }
  }
  return periods.sort((a, b) => (a[0] * 100 + a[1]) - (b[0] * 100 + b[1]));
}

/**
 * Check whether a period is locked — called INSIDE a transaction under the
 * advisory lock so the read is consistent with the lock state.
 */
async function _isPeriodLockedTx(
  tx: { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> },
  entityId: string,
  year: number,
  month: number,
): Promise<boolean> {
  const rows = await tx.execute(sql`
    SELECT EXISTS(
      SELECT 1 FROM commission_periods
      WHERE entity_id = ${entityId}::uuid
        AND period_year  = ${year}
        AND period_month = ${month}
        AND status = 'locked'
    ) AS is_locked
  `);
  return (rows.rows[0] as Record<string, unknown>).is_locked as boolean;
}

// ─── Representatives ──────────────────────────────────────────────────────────

export async function getCommissionRepresentatives(): Promise<CommissionRepresentative[]> {
  const rows = await getCommissionOpsDb().execute(sql`
    SELECT id, slug, display_name, representative_type, payout_eligible, notes
    FROM commission_representatives
    ORDER BY representative_type ASC, display_name ASC
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapRep);
}

export async function getCommissionRepresentativeById(id: string): Promise<CommissionRepresentative | null> {
  assertValidUuid(id, "representative id");
  const rows = await getCommissionOpsDb().execute(sql`
    SELECT id, slug, display_name, representative_type, payout_eligible, notes
    FROM commission_representatives
    WHERE id = ${id}::uuid
    LIMIT 1
  `);
  if (rows.rows.length === 0) return null;
  return mapRep(rows.rows[0] as Record<string, unknown>);
}

function mapRep(r: Record<string, unknown>): CommissionRepresentative {
  return {
    id: r.id as string,
    slug: r.slug as string,
    displayName: r.display_name as string,
    representativeType: r.representative_type as "external_rep" | "internal_house",
    payoutEligible: r.payout_eligible as boolean,
    notes: r.notes as string | null,
  };
}

// ─── Attribution rules ────────────────────────────────────────────────────────
// Loads ALL rules without date filtering.
// Date-based filtering (effective_from/effective_to vs invoice_date) is done
// per-invoice in commissionEngine.ts.

export async function getAttributionRulesForEntity(entityId: string): Promise<CommissionAttributionRule[]> {
  assertValidUuid(entityId, "entityId");
  const rows = await getCommissionOpsDb().execute(sql`
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
    ? await getCommissionOpsDb().execute(sql`
        SELECT r.id, r.entity_id, r.representative_id, r.core_customer_id,
               r.customer_name_pattern, r.formula_type, r.calculation_basis,
               r.commission_rate::text, r.fixed_amount::text, r.payable_trigger,
               r.rule_version, r.status, r.effective_from::text, r.effective_to::text, r.notes
        FROM commission_rules r
        WHERE r.entity_id = ${entityId}::uuid AND r.status = 'active'
        ORDER BY r.entity_id, r.representative_id, r.effective_from DESC
      `)
    : await getCommissionOpsDb().execute(sql`
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

/** Transactional rule creation: MAX(version)+1 in CTE, supersede old, write audit.
 *  The unique index uq_commission_rule_scope_version prevents concurrent duplicates.
 *  If the insert fails (e.g. concurrent duplicate version), old rule stays active. */
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
  if (!ALLOWED_FORMULA_TYPES.has(rule.formulaType)) throw new Error(`Invalid formulaType: ${rule.formulaType}`);
  if (!ALLOWED_TRIGGERS.has(rule.payableTrigger)) throw new Error(`Invalid payableTrigger: ${rule.payableTrigger}`);
  assertValidDate(rule.effectiveFrom, "effectiveFrom");
  if (rule.effectiveTo) {
    assertValidDate(rule.effectiveTo, "effectiveTo");
    if (rule.effectiveTo < rule.effectiveFrom) throw new Error("effectiveTo must be >= effectiveFrom");
  }
  if (rule.customerNamePattern != null) {
    if (rule.customerNamePattern.trim() === "%" || rule.customerNamePattern.trim() === "") {
      throw new Error("customerNamePattern cannot be a bare wildcard '%' or empty");
    }
  }
  // ── Rate / amount validation ──────────────────────────────────────────────
  assertValidNumericString(rule.commissionRate, "commissionRate", { min: 0, max: 10, maxDp: 6 });
  assertValidNumericString(rule.fixedAmount, "fixedAmount", { min: -999999.99, max: 999999.99, maxDp: 2 });

  // ── Formula / field invariants (mirrors route validateFormulaMatrix) ───────
  const _PCT = new Set(["percentage_of_invoice","percentage_of_amount_paid","percentage_of_gross_profit"]);
  if (_PCT.has(rule.formulaType)) {
    if (rule.commissionRate == null) throw new Error(`${rule.formulaType} requires commissionRate`);
    if (rule.fixedAmount != null)    throw new Error(`${rule.formulaType} must not have fixedAmount`);
  }
  if (rule.formulaType === "fixed_amount") {
    if (rule.fixedAmount == null)     throw new Error("fixed_amount requires fixedAmount");
    if (rule.commissionRate != null)  throw new Error("fixed_amount must not have commissionRate");
  }
  if (rule.formulaType === "no_commission_house") {
    if (rule.commissionRate != null || rule.fixedAmount != null)
      throw new Error("no_commission_house must not have commissionRate or fixedAmount");
    if (rule.calculationBasis != null)
      throw new Error("no_commission_house must not have calculationBasis");
  }

  // ── calculationBasis — required for PCT and fixed_amount, forbidden for house ─
  const _EXPECTED_BASIS: Record<string, string | null> = {
    percentage_of_invoice:      "invoice_amount",
    percentage_of_amount_paid:  "amount_paid",
    percentage_of_gross_profit: "gross_profit",
    fixed_amount:               "fixed_amount",
    manual:                     null,
    no_commission_house:        null,
  };
  const _PCT_AND_FIXED = new Set(["percentage_of_invoice","percentage_of_amount_paid","percentage_of_gross_profit","fixed_amount"]);
  if (_PCT_AND_FIXED.has(rule.formulaType)) {
    // These formulas MUST have the correct calculationBasis — null is not accepted.
    const expected = _EXPECTED_BASIS[rule.formulaType]!;
    if (rule.calculationBasis !== expected) {
      throw new Error(
        `calculationBasis must be '${expected}' for '${rule.formulaType}', got '${rule.calculationBasis ?? "null"}'`
      );
    }
  }
  // manual: null or any explicit value allowed (no enforcement).

  // Wrap in a transaction with an advisory lock scoped to this rule's entity+rep+scope.
  // This prevents concurrent MAX(version)+1 races without relying solely on the unique index.
  // The unique index uq_commission_rule_scope_version remains as a final safety net.
  let result;
  try {
    result = await getCommissionOpsDb().transaction(async (tx) => {
      // Advisory xact lock — automatically released at transaction end.
      // Key is a stable hash over entity+rep+customer scope.
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          ('x' || md5(
            ${rule.entityId} || '|' ||
            ${rule.representativeId} || '|' ||
            COALESCE(${rule.coreCustomerId ?? null}::text, '') || '|' ||
            COALESCE(${rule.customerNamePattern ?? null}, '')
          ))::bit(64)::bigint
        )
      `);
      return tx.execute(sql`
    WITH
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
    });
  } catch (err) {
    const pgCode = (err as { code?: string }).code;
    if (pgCode === "23505") {
      throw new Error("UNIQUE_VIOLATION: A concurrent version of this rule was already created. Please retry.");
    }
    throw err;
  }

  const r = (result as { rows: unknown[] }).rows[0] as Record<string, unknown>;
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

  const baseQuery = sql`
    FROM commission_run_lines cl
    LEFT JOIN commission_representatives rep ON rep.id = cl.representative_id
    WHERE 1=1
      ${filters.entityId         ? sql`AND cl.entity_id = ${filters.entityId}::uuid` : sql``}
      ${filters.representativeId ? sql`AND cl.representative_id = ${filters.representativeId}::uuid` : sql``}
      ${filters.lineStatus       ? sql`AND cl.line_status = ${filters.lineStatus}` : sql``}
      ${year != null && month != null ? sql`AND EXTRACT(YEAR FROM cl.invoice_date) = ${year} AND EXTRACT(MONTH FROM cl.invoice_date) = ${month}` : sql``}
  `;

  const rows = await getCommissionOpsDb().execute(sql`
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

  const countRows = await getCommissionOpsDb().execute(sql`SELECT COUNT(*) AS total ${baseQuery}`);
  const total = Number((countRows.rows[0] as Record<string, unknown>).total ?? 0);
  return { lines: (rows.rows as Record<string, unknown>[]).map(mapRunLine), total };
}

export async function getCommissionLineSummary(
  entityId?: string,
  periodYear?: number,
  periodMonth?: number,
) {
  if (entityId) assertValidUuid(entityId, "entityId");

  const rows = await getCommissionOpsDb().execute(sql`
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
      ${periodYear != null && periodMonth != null
        ? sql`AND EXTRACT(YEAR  FROM cl.invoice_date::date) = ${periodYear}
              AND EXTRACT(MONTH FROM cl.invoice_date::date) = ${periodMonth}`
        : sql``}
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
  return await getCommissionOpsDb().transaction(async (tx) => {
    // ── Step 1: Acquire source_fingerprint advisory lock FIRST ────────────────
    // This serializes all concurrent upserts for the same invoice, eliminating
    // the race where two upserts read divergent old-period state and disagree on
    // which period locks to acquire.
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        ('x' || md5(${line.sourceFingerprint}))::bit(64)::bigint
      )
    `);

    // ── Step 2: Read the existing line INSIDE the transaction ─────────────────
    // Under the source_fingerprint lock we get a consistent view of the current
    // invoice_date — no other upsert for this fingerprint can be running.
    const existing = await tx.execute(sql`
      SELECT id, line_status,
             invoice_date::text AS invoice_date,
             invoice_amount::text, invoice_status, customer_name, customer_id::text
      FROM commission_run_lines
      WHERE source_fingerprint = ${line.sourceFingerprint}
      LIMIT 1
    `);
    const prevDateStr = existing.rows.length > 0
      ? ((existing.rows[0] as Record<string, unknown>).invoice_date as string | null)
      : null;

    // ── Step 3: Compute period set to lock (new + old, deduplicated, sorted) ──
    // Sorted order prevents deadlocks when two transactions lock overlapping sets.
    const seen = new Set<string>();
    const periodsToLock: Array<[number, number]> = [];
    function addPeriod(y: number, m: number) {
      const key = `${y}-${m}`;
      if (!seen.has(key)) { seen.add(key); periodsToLock.push([y, m]); }
    }
    if (line.invoiceDate) {
      const [ny, nm] = _parsePeriod(line.invoiceDate);
      addPeriod(ny, nm);
    }
    if (prevDateStr) {
      // Existing line has a period — must guard it whether or not the new date changes it.
      // This also handles the null-date path: setting invoiceDate=null on a line that was
      // previously dated would move it out of a locked period, which must be prevented.
      const [oy, om] = _parsePeriod(prevDateStr);
      addPeriod(oy, om);
    }
    periodsToLock.sort((a, b) => (a[0] * 100 + a[1]) - (b[0] * 100 + b[1]));

    // ── Step 4: Acquire period advisory lock(s) in deterministic order ────────
    for (const [y, m] of periodsToLock) {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          ('x' || md5(${line.entityId} || '|' || ${y}::text || '|' || ${m}::text))::bit(64)::bigint
        )
      `);
    }

    // ── Step 5: Verify no affected period is closed ───────────────────────────
    for (const [y, m] of periodsToLock) {
      if (await _isPeriodLockedTx(tx, line.entityId, y, m)) return "skipped";
    }

    // ── Step 6: Execute insert/update with pre-read existing rows ────────────
    return _upsertCore(tx, line, existing);
  });
}

/**
 * Core insert/update logic — called from upsertCommissionLine with pre-read
 * existing rows (already fetched inside the serialized transaction).
 */
async function _upsertCore(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: unknown[]; rowCount?: number | null }> },
  line: Parameters<typeof upsertCommissionLine>[0],
  existing: { rows: unknown[] },
): Promise<UpsertAction> {

  if (existing.rows.length === 0) {
    await db.execute(sql`
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

  if (currentStatus === "locked") return "skipped";

  if (currentStatus === "approved") {
    const sourceChanged =
      ex.invoice_amount !== (line.invoiceAmount ?? null) ||
      ex.invoice_status !== (line.invoiceStatus ?? null) ||
      ex.customer_name  !== (line.customerName  ?? null) ||
      ex.invoice_date   !== (line.invoiceDate    ?? null) ||
      ex.customer_id    !== (line.customerId     ?? null);
    if (sourceChanged) {
      await db.execute(sql`
        UPDATE commission_run_lines
        SET
          invoice_amount      = ${line.invoiceAmount ?? null}::numeric,
          invoice_status      = ${line.invoiceStatus ?? null},
          customer_name       = ${line.customerName ?? null},
          customer_id         = ${line.customerId ?? null}::uuid,
          invoice_date        = ${line.invoiceDate ?? null}::date,
          representative_id   = ${line.representativeId ?? null}::uuid,
          attribution_rule_id = ${line.attributionRuleId ?? null}::uuid,
          attribution_match   = ${line.attributionMatch ?? null},
          commission_rule_id  = ${line.commissionRuleId ?? null}::uuid,
          formula_type        = ${line.formulaType ?? null},
          calculation_basis   = ${line.calculationBasis ?? null},
          commission_rate     = ${line.commissionRate ?? null}::numeric,
          commission_amount   = NULL,
          payout_eligible     = ${line.payoutEligible},
          exclusion_reason    = 'source_changed',
          line_status         = 'needs_review',
          approved_at         = NULL,
          approved_by         = NULL,
          recalculated_at     = now(),
          recalculated_by     = ${line.recalculatedBy ?? null},
          updated_at          = now()
        WHERE source_fingerprint = ${line.sourceFingerprint}
      `);
      return "source_changed";
    }
    return "skipped";
  }

  await db.execute(sql`
    UPDATE commission_run_lines
    SET
      invoice_amount      = ${line.invoiceAmount ?? null}::numeric,
      invoice_status      = ${line.invoiceStatus ?? null},
      customer_id         = ${line.customerId ?? null}::uuid,
      customer_name       = ${line.customerName ?? null},
      invoice_date        = ${line.invoiceDate ?? null}::date,
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
 *  Returns false if no line was updated (wrong status, wrong entity, or not found).
 *  Only 'calculated' lines can be approved — enforced server-side. */
export async function approveCommissionLine(
  lineId: string,
  entityId: string,
  approvedBy: string,
): Promise<boolean> {
  assertValidUuid(lineId, "lineId");
  assertValidUuid(entityId, "entityId");
  const result = await getCommissionOpsDb().execute(sql`
    UPDATE commission_run_lines
    SET line_status = 'approved', approved_at = now(), approved_by = ${approvedBy}, updated_at = now()
    WHERE id = ${lineId}::uuid
      AND entity_id = ${entityId}::uuid
      AND line_status = 'calculated'
  `);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Lock a commission period.
 *
 * All checks and updates are executed in a single SQL statement so they see the
 * same consistent snapshot. The unique constraint on commission_periods prevents
 * a second concurrent lock from completing if one is already in progress.
 *
 * Pre-checks:
 *   1. Period must not be empty (at least one line).
 *   2. External-rep lines must all be approved or locked.
 *   3. No line in needs_review / needs_configuration / calculated / attributed /
 *      awaiting_payment for any rep type.
 *
 * Returns null on success; error string (for 409) on failure.
 */
export async function lockCommissionPeriod(
  entityId: string,
  year: number,
  month: number,
  lockedBy: string,
): Promise<string | null> {
  assertValidUuid(entityId, "entityId");
  if (month < 1 || month > 12) throw new Error("Invalid month");

  // Transaction with advisory lock ensures no concurrent lock attempt for the same period.
  // upsertCommissionLine checks commission_periods before inserting, so a new ingestion
  // that starts while we hold the lock will see the locked period and skip.
  const result = await getCommissionOpsDb().transaction(async (tx) => {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        ('x' || md5(${entityId} || '|' || ${year}::text || '|' || ${month}::text))::bit(64)::bigint
      )
    `);
    return tx.execute(sql`
    WITH
    _period_count AS (
      SELECT COUNT(*) AS cnt
      FROM commission_run_lines cl
      WHERE cl.entity_id = ${entityId}::uuid
        AND EXTRACT(YEAR  FROM cl.invoice_date) = ${year}
        AND EXTRACT(MONTH FROM cl.invoice_date) = ${month}
    ),
    _blockers AS (
      SELECT COUNT(*) AS blocking
      FROM commission_run_lines cl
      JOIN commission_representatives rep ON rep.id = cl.representative_id
      WHERE cl.entity_id = ${entityId}::uuid
        AND EXTRACT(YEAR  FROM cl.invoice_date) = ${year}
        AND EXTRACT(MONTH FROM cl.invoice_date) = ${month}
        AND rep.representative_type = 'external_rep'
        AND cl.line_status NOT IN ('approved', 'locked', 'house_no_commission')
    ),
    _unresolved AS (
      SELECT COUNT(*) AS problems
      FROM commission_run_lines cl
      WHERE cl.entity_id = ${entityId}::uuid
        AND EXTRACT(YEAR  FROM cl.invoice_date) = ${year}
        AND EXTRACT(MONTH FROM cl.invoice_date) = ${month}
        AND cl.line_status IN (
          'needs_review','needs_configuration','calculated','attributed','awaiting_payment'
        )
    ),
    _can_lock AS (
      SELECT
        (SELECT cnt FROM _period_count)       AS period_count,
        (SELECT blocking FROM _blockers)      AS blocking,
        (SELECT problems FROM _unresolved)    AS problems,
        (SELECT cnt FROM _period_count) > 0
        AND (SELECT blocking FROM _blockers)  = 0
        AND (SELECT problems FROM _unresolved) = 0 AS ok
    ),
    _locked AS (
      UPDATE commission_run_lines
      SET line_status = 'locked', locked_at = now(), locked_by = ${lockedBy}, updated_at = now()
      WHERE entity_id = ${entityId}::uuid
        AND EXTRACT(YEAR  FROM invoice_date) = ${year}
        AND EXTRACT(MONTH FROM invoice_date) = ${month}
        AND line_status IN ('approved', 'house_no_commission')
        AND (SELECT ok FROM _can_lock)
      RETURNING id
    ),
    _upsert AS (
      INSERT INTO commission_periods (entity_id, period_year, period_month, status, locked_at, locked_by)
      SELECT ${entityId}::uuid, ${year}, ${month}, 'locked', now(), ${lockedBy}
      WHERE (SELECT ok FROM _can_lock)
      ON CONFLICT (entity_id, period_year, period_month)
      DO UPDATE SET status = 'locked', locked_at = now(), locked_by = EXCLUDED.locked_by
    )
    SELECT period_count, blocking, problems, ok FROM _can_lock
    `);
  });

  const row = (result as { rows: unknown[] }).rows[0] as Record<string, unknown>;
  const ok          = row.ok          as boolean;
  const periodCount = Number(row.period_count ?? 0);
  const blocking    = Number(row.blocking     ?? 0);
  const problems    = Number(row.problems     ?? 0);

  if (!ok) {
    if (periodCount === 0) return "Cannot lock: no commission lines found for this period";
    if (blocking > 0) return `Cannot lock: ${blocking} external line(s) are not yet approved`;
    if (problems > 0) return `Cannot lock: ${problems} line(s) in unresolved status (needs_review/needs_configuration/calculated/attributed/awaiting_payment)`;
    return "Cannot lock: pre-check failed";
  }
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
