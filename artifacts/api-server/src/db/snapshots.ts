import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./connection";
import { entitySnapshots, portfolioSnapshots } from "@workspace/db";

export type { EntitySnapshot, PortfolioSnapshot } from "@workspace/db";

/**
 * Current entity snapshot (is_current = true).
 * Used exclusively by summary KPI cards and the AI briefing engine.
 * Must NOT be used as a data source for detailed module pages.
 */
export async function getCurrentSnapshot(entityId: string) {
  const rows = await db
    .select()
    .from(entitySnapshots)
    .where(
      and(
        eq(entitySnapshots.entityId, entityId),
        eq(entitySnapshots.isCurrent, true),
      ),
    )
    .limit(1);

  return rows.at(0) ?? null;
}

/**
 * Reconciliation status codes for AR/AP comparison.
 *
 * - reconciled              Both totals exist and |diff| ≤ $0.02.
 * - unreconciled            Both totals exist but gap exceeds tolerance.
 * - no_official_snapshot    entity_snapshots has no current record.
 * - normalized_data_incomplete  Required QBO objects (CreditMemo/VendorCredit) have
 *                           never been synced into qbo_raw; net normalized total
 *                           cannot be calculated honestly.
 * - source_date_mismatch    Credit objects and aging report do not share a sync_run_id —
 *                           point-in-time compatibility cannot be proven. Includes cases where
 *                           the aging report is absent from qbo_raw (lineage_unavailable) or
 *                           where different sync batches were used (date_mismatch).
 */
export type ReconciliationStatus =
  | "reconciled"
  | "unreconciled"
  | "no_official_snapshot"
  | "normalized_data_incomplete"
  | "source_date_mismatch";

export interface ArApReconciliation {
  /** QBO-authoritative open AR from AgedReceivableSummary. Null = no snapshot. */
  officialAr: number | null;
  /** QBO-authoritative open AP from AgedPayableSummary. Null = no snapshot. */
  officialAp: number | null;
  /** ISO date the official aging reports were generated. */
  officialAsOf: string | null;

  /** SUM(invoices.balance WHERE not Paid and not deleted). Applied credits are
   *  already reflected here — QBO reduces Invoice.Balance when a CreditMemo is applied. */
  normalizedGrossAr: number;
  /** SUM(qbo_raw CreditMemo.RemainingCredit) — unapplied customer credits.
   *  Null when no CreditMemo rows exist in qbo_raw (data_incomplete). */
  unappliedCustomerCredits: number | null;
  /** normalizedGrossAr − unappliedCustomerCredits. Null when credits unknown. */
  normalizedNetAr: number | null;

  /** SUM(bills.balance WHERE not Paid and not deleted). Applied vendor credits
   *  are already reflected here — QBO reduces Bill.Balance when a VendorCredit is applied. */
  normalizedGrossAp: number;
  /** SUM(qbo_raw VendorCredit.Balance) — unapplied vendor credits.
   *  Null when no VendorCredit rows exist in qbo_raw (data_incomplete). */
  unappliedVendorCredits: number | null;
  /** normalizedGrossAp − unappliedVendorCredits. Null when credits unknown. */
  normalizedNetAp: number | null;

  /** officialAr − normalizedNetAr (signed). Null when either is unavailable. */
  arSignedDiff: number | null;
  /** |arSignedDiff|. Null when either source is unavailable. */
  arAbsDiff: number | null;
  /** Reconciliation classification for AR. */
  arStatus: ReconciliationStatus;

  /** officialAp − normalizedNetAp (signed). */
  apSignedDiff: number | null;
  /** |apSignedDiff|. */
  apAbsDiff: number | null;
  /** Reconciliation classification for AP. */
  apStatus: ReconciliationStatus;

  /** ISO timestamp of the most-recent invoice row in the DB. */
  normalizedArAsOf: string | null;
  /** ISO timestamp of the most-recent bill row in the DB. */
  normalizedApAsOf: string | null;

  /** Human-readable explanation for the current status. */
  arExplanation: string;
  /** Human-readable explanation for the current status. */
  apExplanation: string;

  /** Per-currency coverage detail for CreditMemo (from sync_run_objects + normalized table). */
  creditMemoCoverage: CreditCoverageDetail[];
  /** Per-currency coverage detail for VendorCredit (from sync_run_objects + normalized table). */
  vendorCreditCoverage: CreditCoverageDetail[];
}

const RECON_TOLERANCE = 0.02;

// ── PR #43: CreditCoverageDetail types ────────────────────────────────────────

type SyncStatus =
  | "never_attempted"
  | "running"
  | "failed"
  | "success_zero_rows"
  | "success_with_rows"
  | "success_with_exceptions";

type DataSourceUsed = "none" | "raw" | "normalized";
type VerificationStatus = "not_available" | "pending" | "verified" | "parity_mismatch";

interface CreditCoverageDetail {
  /** Sync status derived from sync_run_objects or sync_runs. */
  syncStatus: SyncStatus;
  /** Which data source was used for the total. */
  dataSourceUsed: DataSourceUsed;
  /** Whether we can treat the data as audit-quality. */
  verificationStatus: VerificationStatus;
  /** True only when dataSourceUsed=normalized and verificationStatus=verified. */
  coverageComplete: boolean;
  /** Raw JSONB total from qbo_raw (null when no raw rows exist). */
  rawTotal: number | null;
  /** Normalized table total (null when no normalized rows exist or not verified). */
  normalizedTotal: number | null;
  /** |rawTotal - normalizedTotal|. Null when either is unavailable. */
  difference: number | null;
  /** The currency this coverage record applies to. */
  currency: string;
  /** records_fetched from sync_run_objects. Null when no sync row found. */
  recordsFetched: number | null;
  /** records_skipped from sync_run_objects. Null when no sync row found. */
  recordsSkipped: number | null;
  /** error_message from sync_run_objects. Null on success. */
  errorSummary: string | null;
}

// Parity tolerance for normalized vs raw comparison (same as overall recon tolerance)
const PARITY_TOLERANCE = 0.02;

/**
 * Build per-currency CreditCoverageDetail[] for one entity + credit type.
 * Uses sync_run_objects for authoritative syncStatus, then reads normalized table
 * (credit_memos / vendor_credits) and qbo_raw for parity comparison.
 *
 * Transition rule: normalized table is only trusted when syncStatus = success_with_rows
 * AND parity is within tolerance. Otherwise, raw is the operational source.
 */
async function _getCreditCoverageDetails(
  entityId: string,
  creditType: "CreditMemo" | "VendorCredit",
  entityCurrency: string,
): Promise<CreditCoverageDetail[]> {
  // 1. Most recent sync_run_objects row for this (entity, type)
  const sroRows = await db.execute<{
    status: string;
    records_fetched: number | null;
    records_skipped: number | null;
    error_message: string | null;
    completed_at: string | null;
  }>(
    sql`SELECT status, records_fetched, records_skipped, error_message, completed_at::text
        FROM sync_run_objects
        WHERE entity_id = ${entityId}
          AND object_type = ${creditType}
        ORDER BY completed_at DESC NULLS LAST
        LIMIT 1`,
  );
  const sro = sroRows.rows[0] ?? null;

  const rawStatus = sro?.status ?? null;
  const recordsFetched = sro?.records_fetched ?? null;
  const recordsSkipped = sro?.records_skipped ?? null;
  const errorSummary = sro?.error_message ?? null;

  // Derive syncStatus from sync_run_objects row
  let syncStatus: SyncStatus;
  if (!sro) {
    syncStatus = "never_attempted";
  } else if (rawStatus === "running") {
    syncStatus = "running";
  } else if (rawStatus === "failed") {
    syncStatus = "failed";
  } else if (rawStatus === "success_with_exceptions") {
    syncStatus = "success_with_exceptions";
  } else if (rawStatus === "success" && recordsFetched === 0 && (recordsSkipped ?? 0) === 0) {
    syncStatus = "success_zero_rows";
  } else if (rawStatus === "success") {
    syncStatus = "success_with_rows";
  } else {
    syncStatus = "never_attempted";
  }

  // 2. success_zero_rows: entity has no credits — authoritative empty
  if (syncStatus === "success_zero_rows") {
    return [{
      syncStatus,
      dataSourceUsed: "normalized",
      verificationStatus: "verified",
      coverageComplete: true,
      rawTotal: null,
      normalizedTotal: 0,
      difference: null,
      currency: entityCurrency,
      recordsFetched,
      recordsSkipped,
      errorSummary: null,
    }];
  }

  // 3. For states where we can query normalized data, try normalized table
  const normalizedTable = creditType === "CreditMemo" ? "credit_memos" : "vendor_credits";
  const amountCol = creditType === "CreditMemo" ? "remaining_credit" : "remaining_balance";

  const normalizedRows = await db.execute<{ currency: string; total: string }>(
    sql.raw(`SELECT currency, COALESCE(SUM(${amountCol}), 0)::text AS total
             FROM ${normalizedTable}
             WHERE entity_id = '${entityId}'
               AND is_deleted = false
               AND is_voided = false
             GROUP BY currency`),
  );

  // 4. Raw totals from qbo_raw JSONB per currency
  const rawField = creditType === "CreditMemo" ? "RemainingCredit" : "Balance";
  const rawRows = await db.execute<{ currency: string; total: string }>(
    sql`SELECT
          COALESCE(payload->>'CurrencyRef'->>'value', 'USD') AS currency,
          COALESCE(SUM((payload->>${rawField})::numeric), 0)::text AS total
        FROM qbo_raw
        WHERE entity_id = ${entityId}
          AND object_type = ${creditType}
          AND is_deleted = false
          AND (payload->>${rawField}) IS NOT NULL
          AND (payload->>${rawField})::numeric > 0
        GROUP BY COALESCE(payload->>'CurrencyRef'->>'value', 'USD')`,
  );

  // Build maps
  const normalizedByCurrency = new Map<string, number>(
    normalizedRows.rows.map(r => [r.currency, parseFloat(r.total)]),
  );
  const rawByCurrency = new Map<string, number>(
    rawRows.rows.map(r => [r.currency, parseFloat(r.total)]),
  );

  // All currencies present in either source
  const currencies = new Set<string>([
    ...normalizedByCurrency.keys(),
    ...rawByCurrency.keys(),
    ...(normalizedRows.rows.length === 0 && rawRows.rows.length === 0 ? [entityCurrency] : []),
  ]);

  if (currencies.size === 0) currencies.add(entityCurrency);

  return Array.from(currencies).map((currency): CreditCoverageDetail => {
    const rawTotal = rawByCurrency.get(currency) ?? null;
    const normalizedTotal = normalizedByCurrency.get(currency) ?? null;
    const difference =
      rawTotal !== null && normalizedTotal !== null
        ? Math.abs(rawTotal - normalizedTotal)
        : null;

    // Determine data source + verification
    if (syncStatus === "success_with_exceptions") {
      return {
        syncStatus,
        dataSourceUsed: rawTotal !== null ? "raw" : "none",
        verificationStatus: "pending",
        coverageComplete: false,
        rawTotal, normalizedTotal, difference, currency,
        recordsFetched, recordsSkipped, errorSummary,
      };
    }

    if (syncStatus === "failed" || syncStatus === "running" || syncStatus === "never_attempted") {
      return {
        syncStatus,
        dataSourceUsed: rawTotal !== null ? "raw" : "none",
        verificationStatus: "not_available",
        coverageComplete: false,
        rawTotal, normalizedTotal, difference, currency,
        recordsFetched, recordsSkipped, errorSummary,
      };
    }

    // success_with_rows: compare parity
    if (normalizedTotal !== null && rawTotal !== null) {
      const withinTolerance = difference !== null && difference <= PARITY_TOLERANCE;
      if (withinTolerance) {
        return {
          syncStatus,
          dataSourceUsed: "normalized",
          verificationStatus: "verified",
          coverageComplete: true,
          rawTotal, normalizedTotal, difference, currency,
          recordsFetched, recordsSkipped, errorSummary: null,
        };
      } else {
        return {
          syncStatus,
          dataSourceUsed: "raw",
          verificationStatus: "parity_mismatch",
          coverageComplete: false,
          rawTotal, normalizedTotal, difference, currency,
          recordsFetched, recordsSkipped, errorSummary,
        };
      }
    }

    // Only one source exists
    const onlyNormalized = normalizedTotal !== null && rawTotal === null;
    const onlyRaw = rawTotal !== null && normalizedTotal === null;
    return {
      syncStatus,
      dataSourceUsed: onlyNormalized ? "normalized" : onlyRaw ? "raw" : "none",
      verificationStatus: "pending",
      coverageComplete: false,
      rawTotal, normalizedTotal, difference, currency,
      recordsFetched, recordsSkipped, errorSummary,
    };
  });
}

type CoverageStatus = "ok" | "no_sync" | "date_mismatch" | "lineage_unavailable";

// Maps credit object type → aging report type stored in qbo_raw.
const CREDIT_TO_REPORT: Record<"CreditMemo" | "VendorCredit", string> = {
  CreditMemo:   "AgedReceivableSummary",
  VendorCredit: "AgedPayableSummary",
};

/**
 * Determine credit coverage status for one entity + credit type.
 *
 * Lineage contract (strict — no timestamp fallback):
 *   Reconciliation is allowed ONLY when the credit type (CreditMemo / VendorCredit)
 *   AND the corresponding aging report (AgedReceivableSummary / AgedPayableSummary)
 *   were extracted in the SAME controlled sync_run_id. Timestamp comparison alone
 *   never proves point-in-time compatibility.
 *
 *   RemainingCredit and VendorCredit.Balance are current-state values at extraction
 *   time. A credit applied, refunded, or deleted after the report EndPeriod changes
 *   those balances, making a later extraction incompatible with an earlier report.
 *
 * Statuses:
 *   "ok"                  — shared sync_run_id; same controlled extraction batch.
 *                           Zero credit rows = legitimately zero (not incomplete).
 *   "no_sync"             — no completed (status='success') sync_run covered this type.
 *                           Partial (status='partial') and failed runs are excluded.
 *   "date_mismatch"       — credit objects and aging report have different sync_run_ids;
 *                           point-in-time compatibility not proven.
 *   "lineage_unavailable" — a completed sync exists but aging report is absent from
 *                           qbo_raw; shared-batch lineage cannot be verified.
 */
async function _getCreditCoverage(
  entityId: string,
  creditType: "CreditMemo" | "VendorCredit",
  reportAsOf: string | null,
): Promise<{ coverageStatus: CoverageStatus; lastSyncAt: string | null }> {
  // Step 1: Find the sync_run_id of the most recently synced active credit objects.
  // Returns null when zero active rows exist (zero-row or never-synced).
  const creditRunRows = await db.execute<{ sync_run_id: string | null; synced_at: string | null }>(
    sql`SELECT sync_run_id::text, synced_at::text
        FROM qbo_raw
        WHERE entity_id = ${entityId}
          AND object_type = ${creditType}
          AND is_deleted = false
        ORDER BY synced_at DESC
        LIMIT 1`,
  );
  const creditRunId = creditRunRows.rows[0]?.sync_run_id ?? null;
  const creditSyncedAt = creditRunRows.rows[0]?.synced_at ?? null;

  // Step 2: Find the most recent completed (status='success') sync_run for this type.
  // Authoritative answer to "did we ever successfully sync this type?"
  // Partial (status='partial') and failed (status='failed') runs are excluded.
  const completedRunRows = await db.execute<{
    id: string | null;
    completed_at: string | null;
    object_types: string[] | null;
  }>(
    sql`SELECT id::text, completed_at::text, object_types
        FROM sync_runs
        WHERE entity_id = ${entityId}
          AND ${creditType} = ANY(object_types)
          AND status = 'success'
        ORDER BY completed_at DESC
        LIMIT 1`,
  );
  const completedRun = completedRunRows.rows[0] ?? null;

  if (!completedRun?.id) {
    // No successful sync_run ever covered this type.
    return { coverageStatus: "no_sync", lastSyncAt: null };
  }

  // Anchor: prefer credit rows' run_id (when rows exist), else use the completed_run.id.
  const anchorRunId = creditRunId ?? completedRun.id;
  const lastSyncAt = creditSyncedAt ?? completedRun.completed_at;

  // Step 3: Find the aging report's sync_run_id in qbo_raw.
  // The aging report MUST be present and share the anchor run_id.
  // Do NOT fall back to timestamp comparison.
  const reportType = CREDIT_TO_REPORT[creditType];
  const reportRunRows = await db.execute<{ sync_run_id: string | null }>(
    sql`SELECT sync_run_id::text
        FROM qbo_raw
        WHERE entity_id = ${entityId}
          AND object_type = ${reportType}
        ORDER BY synced_at DESC
        LIMIT 1`,
  );
  const reportRunId = reportRunRows.rows[0]?.sync_run_id ?? null;

  if (reportRunId === null) {
    // No aging report in qbo_raw — cannot verify shared-batch lineage.
    // Do NOT fall back to timestamp comparison.
    return { coverageStatus: "lineage_unavailable", lastSyncAt };
  }

  if (anchorRunId !== reportRunId) {
    // Different sync_run_ids — credit values not proven compatible with the report.
    return { coverageStatus: "date_mismatch", lastSyncAt };
  }

  // Same controlled batch — point-in-time compatible.
  // Zero credit rows = legitimately zero (entity has no open unapplied credits).
  return { coverageStatus: "ok", lastSyncAt };
}

function _classifyStatus(
  official: number | null,
  normalizedNet: number | null,
  coverageStatus: CoverageStatus,
): ReconciliationStatus {
  if (official === null) return "no_official_snapshot";
  if (coverageStatus === "no_sync") return "normalized_data_incomplete";
  if (coverageStatus === "date_mismatch" || coverageStatus === "lineage_unavailable") {
    return "source_date_mismatch";
  }
  if (normalizedNet === null) return "normalized_data_incomplete";
  return Math.abs(official - normalizedNet) <= RECON_TOLERANCE ? "reconciled" : "unreconciled";
}

function _statusExplanation(
  status: ReconciliationStatus,
  side: "AR" | "AP",
  officialTotal: number | null,
  normalizedGross: number,
  unappliedCredits: number | null,
  normalizedNet: number | null,
  absDiff: number | null,
  lastSyncAt: string | null,
  reportAsOf: string | null,
): string {
  const creditType = side === "AR" ? "CreditMemo" : "VendorCredit";
  switch (status) {
    case "reconciled":
      return `${side} reconciles within $${RECON_TOLERANCE.toFixed(2)}.`;
    case "no_official_snapshot":
      return `No ${side} snapshot available. Run the Python pipeline to generate entity_snapshots.`;
    case "normalized_data_incomplete":
      return `No completed sync_run found for ${creditType}. ` +
        `Zero rows in qbo_raw is ambiguous without sync evidence — run the pipeline with the updated TRANSACTION_OBJECT_TYPES.`;
    case "source_date_mismatch":
      return `${creditType} and aging report do not share a sync_run_id — ` +
        `point-in-time compatibility cannot be proven. ` +
        `Either the aging report is absent from qbo_raw, or the credit objects ` +
        `and report were extracted in different sync batches. ` +
        `Run a controlled sync that fetches all eight required types together.`;
    case "unreconciled": {
      const gap = absDiff !== null ? `$${absDiff.toFixed(2)}` : "unknown";
      const credStr = unappliedCredits !== null ? `$${unappliedCredits.toFixed(2)}` : "N/A";
      return `${side} gap of ${gap}. Official: $${(officialTotal ?? 0).toFixed(2)}, ` +
        `gross detail: $${normalizedGross.toFixed(2)}, unapplied ${creditType}: ${credStr}, ` +
        `net detail: $${(normalizedNet ?? 0).toFixed(2)}.`;
    }
  }
}

/**
 * Returns full AR/AP reconciliation data for one entity.
 *
 * Correct QBO accounting treatment:
 *   1. Invoice.Balance already reflects applied CreditMemos. Only RemainingCredit
 *      (unapplied portion) is subtracted separately.
 *   2. VendorCredit uses Balance field for the same purpose.
 *   3. Zero rows in qbo_raw after a COMPLETED sync = legitimately zero credits.
 *      Zero rows without sync evidence = normalized_data_incomplete.
 *   4. Sync completed before the report EndPeriod = source_date_mismatch.
 *      RemainingCredit values captured after the EndPeriod are not point-in-time
 *      compatible with the snapshot.
 *
 * Read-only — never writes to any table.
 */
export async function getArApReconciliation(entityId: string): Promise<ArApReconciliation> {
  // ── Official totals from entity_snapshots ──────────────────────────────────
  const snapshot = await getCurrentSnapshot(entityId);
  const arApMetrics = (snapshot?.metrics as Record<string, unknown> | null)?.["ar_ap_metrics"] as
    | Record<string, unknown>
    | undefined;

  const officialAr = typeof arApMetrics?.["open_ar"] === "number" ? arApMetrics["open_ar"] : null;
  const officialAp = typeof arApMetrics?.["open_ap"] === "number" ? arApMetrics["open_ap"] : null;
  const officialAsOf = snapshot?.asOf ? String(snapshot.asOf) : null;

  // ── Gross normalized AR — Invoice.Balance already reflects applied CreditMemos ──
  const arRows = await db.execute<{ total: string | null; asof: string | null }>(
    sql`SELECT COALESCE(SUM(balance), 0)::text AS total,
               MAX(synced_at)::text AS asof
        FROM invoices
        WHERE entity_id = ${entityId} AND status != 'Paid' AND is_deleted = false`,
  );
  const normalizedGrossAr = parseFloat(arRows.rows[0]?.total ?? "0") || 0;
  const normalizedArAsOf = arRows.rows[0]?.asof ?? null;

  // ── CreditMemo sync coverage and unapplied credits ─────────────────────────
  const { coverageStatus: arCoverageStatus, lastSyncAt: arLastSyncAt } =
    await _getCreditCoverage(entityId, "CreditMemo", officialAsOf);

  let unappliedCustomerCredits: number | null = null;
  if (arCoverageStatus === "ok") {
    // Sync ran and covers the EndPeriod. 0 rows = legitimately zero credits.
    const cmRows = await db.execute<{ total: string | null }>(
      sql`SELECT COALESCE(SUM(
              CASE WHEN (payload->>'RemainingCredit') IS NOT NULL
                    AND (payload->>'RemainingCredit')::numeric > 0
              THEN (payload->>'RemainingCredit')::numeric
              ELSE 0 END
          ), 0)::text AS total
          FROM qbo_raw
          WHERE entity_id = ${entityId} AND object_type = 'CreditMemo' AND is_deleted = false`,
    );
    unappliedCustomerCredits = parseFloat(cmRows.rows[0]?.total ?? "0");
  }

  const normalizedNetAr =
    unappliedCustomerCredits !== null
      ? normalizedGrossAr - unappliedCustomerCredits
      : null;

  // ── Gross normalized AP — Bill.Balance already reflects applied VendorCredits ──
  const apRows = await db.execute<{ total: string | null; asof: string | null }>(
    sql`SELECT COALESCE(SUM(balance), 0)::text AS total,
               MAX(synced_at)::text AS asof
        FROM bills
        WHERE entity_id = ${entityId} AND status != 'Paid' AND is_deleted = false`,
  );
  const normalizedGrossAp = parseFloat(apRows.rows[0]?.total ?? "0") || 0;
  const normalizedApAsOf = apRows.rows[0]?.asof ?? null;

  // ── VendorCredit sync coverage and unapplied credits ──────────────────────
  const { coverageStatus: apCoverageStatus, lastSyncAt: apLastSyncAt } =
    await _getCreditCoverage(entityId, "VendorCredit", officialAsOf);

  let unappliedVendorCredits: number | null = null;
  if (apCoverageStatus === "ok") {
    const vcRows = await db.execute<{ total: string | null }>(
      sql`SELECT COALESCE(SUM(
              CASE WHEN (payload->>'Balance') IS NOT NULL
                    AND (payload->>'Balance')::numeric > 0
              THEN (payload->>'Balance')::numeric
              ELSE 0 END
          ), 0)::text AS total
          FROM qbo_raw
          WHERE entity_id = ${entityId} AND object_type = 'VendorCredit' AND is_deleted = false`,
    );
    unappliedVendorCredits = parseFloat(vcRows.rows[0]?.total ?? "0");
  }

  const normalizedNetAp =
    unappliedVendorCredits !== null
      ? normalizedGrossAp - unappliedVendorCredits
      : null;

  // ── Diffs ──────────────────────────────────────────────────────────────────
  const arSignedDiff =
    officialAr !== null && normalizedNetAr !== null ? officialAr - normalizedNetAr : null;
  const arAbsDiff = arSignedDiff !== null ? Math.abs(arSignedDiff) : null;

  const apSignedDiff =
    officialAp !== null && normalizedNetAp !== null ? officialAp - normalizedNetAp : null;
  const apAbsDiff = apSignedDiff !== null ? Math.abs(apSignedDiff) : null;

  // ── Status ─────────────────────────────────────────────────────────────────
  const arStatus = _classifyStatus(officialAr, normalizedNetAr, arCoverageStatus);
  const apStatus = _classifyStatus(officialAp, normalizedNetAp, apCoverageStatus);

  // ── PR #43: per-currency coverage detail from sync_run_objects ────────────
  // Entity functional currency: needed for zero-row case coverage output
  const entityCurrencyRows = await db.execute<{ currency: string }>(
    sql`SELECT currency FROM entities WHERE id = ${entityId} LIMIT 1`,
  );
  const entityCurrency = entityCurrencyRows.rows[0]?.currency ?? "USD";

  const [creditMemoCoverage, vendorCreditCoverage] = await Promise.all([
    _getCreditCoverageDetails(entityId, "CreditMemo", entityCurrency),
    _getCreditCoverageDetails(entityId, "VendorCredit", entityCurrency),
  ]);

  return {
    officialAr,
    officialAp,
    officialAsOf,
    normalizedGrossAr,
    unappliedCustomerCredits,
    normalizedNetAr,
    normalizedGrossAp,
    unappliedVendorCredits,
    normalizedNetAp,
    arSignedDiff,
    arAbsDiff,
    arStatus,
    apSignedDiff,
    apAbsDiff,
    apStatus,
    normalizedArAsOf,
    normalizedApAsOf,
    arExplanation: _statusExplanation(
      arStatus, "AR", officialAr, normalizedGrossAr, unappliedCustomerCredits, normalizedNetAr, arAbsDiff,
      arLastSyncAt, officialAsOf,
    ),
    apExplanation: _statusExplanation(
      apStatus, "AP", officialAp, normalizedGrossAp, unappliedVendorCredits, normalizedNetAp, apAbsDiff,
      apLastSyncAt, officialAsOf,
    ),
    creditMemoCoverage,
    vendorCreditCoverage,
  };
}

/**
 * Snapshot history for one entity, newest first.
 * For historical trend analysis only — not real-time data.
 */
export async function getSnapshotHistory(entityId: string, limit = 30) {
  return db
    .select()
    .from(entitySnapshots)
    .where(eq(entitySnapshots.entityId, entityId))
    .orderBy(desc(entitySnapshots.asOf))
    .limit(limit);
}

/**
 * Current portfolio snapshot (is_current = true).
 * Used by the portfolio KPI strip only.
 */
export async function getCurrentPortfolioSnapshot() {
  const rows = await db
    .select()
    .from(portfolioSnapshots)
    .where(eq(portfolioSnapshots.isCurrent, true))
    .limit(1);

  return rows[0] ?? null;
}
