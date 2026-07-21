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
 * - source_date_mismatch    Credit sync completed before the snapshot EndPeriod — point-in-time incompatible.
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
}

const RECON_TOLERANCE = 0.02;

type CoverageStatus = "ok" | "no_sync" | "date_mismatch";

// Maps credit object type → aging report type stored in qbo_raw.
const CREDIT_TO_REPORT: Record<"CreditMemo" | "VendorCredit", string> = {
  CreditMemo:   "AgedReceivableSummary",
  VendorCredit: "AgedPayableSummary",
};

/**
 * Determine credit coverage status for one entity + credit type.
 *
 * Primary rule — shared batch lineage (preferred):
 *   The controlling check is sync_run_id equality between the credit objects
 *   (qbo_raw.sync_run_id) and the aging report (also in qbo_raw). Same
 *   sync_run_id = same controlled extraction = point-in-time compatible.
 *
 *   A sync that completed AFTER the report's EndPeriod is NOT automatically
 *   compatible. RemainingCredit and VendorCredit.Balance are current-state
 *   values at extraction time. A credit applied, refunded, or deleted after
 *   the EndPeriod changes those balances and invalidates the reconciliation.
 *
 * Fallback rule — timestamp (when aging report is not in qbo_raw):
 *   sync completed_at must be >= snapshot.asOf. Weaker but safe as a fallback.
 *
 * Statuses:
 *   "ok"            — shared sync_run_id (or fallback: completed_at >= asOf)
 *   "no_sync"       — no credit objects found in qbo_raw
 *   "date_mismatch" — different sync_run_ids, or timestamp shows sync predates EndPeriod
 */
async function _getCreditCoverage(
  entityId: string,
  creditType: "CreditMemo" | "VendorCredit",
  reportAsOf: string | null,
): Promise<{ coverageStatus: CoverageStatus; lastSyncAt: string | null }> {
  // Step 1: Find the sync_run_id that most recently wrote credit objects.
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

  if (!creditRunId) {
    // No credit objects exist in qbo_raw — sync never ran or produced zero rows
    // but we don't know which. Check for a completed sync_run to distinguish.
    const ranRows = await db.execute<{ completed_at: string | null }>(
      sql`SELECT completed_at::text
          FROM sync_runs
          WHERE entity_id = ${entityId}
            AND ${creditType} = ANY(object_types)
            AND status = 'completed'
          ORDER BY completed_at DESC
          LIMIT 1`,
    );
    const completedAt = ranRows.rows[0]?.completed_at ?? null;

    if (!completedAt) {
      // No completed sync_run at all → never synced
      return { coverageStatus: "no_sync", lastSyncAt: null };
    }

    // Completed sync with 0 rows = legitimately zero credits.
    // Still need to verify the run covers the report EndPeriod.
    if (reportAsOf && completedAt.slice(0, 10) < reportAsOf) {
      return { coverageStatus: "date_mismatch", lastSyncAt: completedAt };
    }
    return { coverageStatus: "ok", lastSyncAt: completedAt };
  }

  // Step 2: Find the sync_run_id that most recently wrote the aging report.
  const reportType = CREDIT_TO_REPORT[creditType];
  const reportRunRows = await db.execute<{ sync_run_id: string | null; synced_at: string | null }>(
    sql`SELECT sync_run_id::text, synced_at::text
        FROM qbo_raw
        WHERE entity_id = ${entityId}
          AND object_type = ${reportType}
        ORDER BY synced_at DESC
        LIMIT 1`,
  );
  const reportRunId = reportRunRows.rows[0]?.sync_run_id ?? null;
  const creditSyncedAt = creditRunRows.rows[0]?.synced_at ?? null;

  if (reportRunId !== null) {
    // Primary check: shared-batch lineage.
    if (creditRunId === reportRunId) {
      // Same controlled batch — point-in-time compatible.
      return { coverageStatus: "ok", lastSyncAt: creditSyncedAt };
    } else {
      // Different sync_run_ids — credit values are not proven compatible
      // with the report's accounting state.
      return { coverageStatus: "date_mismatch", lastSyncAt: creditSyncedAt };
    }
  }

  // Step 3: Fallback — aging report not stored in qbo_raw.
  // Use completion timestamp vs reportAsOf as a weaker but safe check.
  const completedAtRows = await db.execute<{ completed_at: string | null }>(
    sql`SELECT completed_at::text
        FROM sync_runs
        WHERE entity_id = ${entityId}
          AND ${creditType} = ANY(object_types)
          AND status = 'completed'
        ORDER BY completed_at DESC
        LIMIT 1`,
  );
  const completedAt = completedAtRows.rows[0]?.completed_at ?? null;

  if (!completedAt) {
    return { coverageStatus: "no_sync", lastSyncAt: null };
  }
  if (reportAsOf && completedAt.slice(0, 10) < reportAsOf) {
    return { coverageStatus: "date_mismatch", lastSyncAt: completedAt };
  }
  return { coverageStatus: "ok", lastSyncAt: completedAt };
}

function _classifyStatus(
  official: number | null,
  normalizedNet: number | null,
  coverageStatus: CoverageStatus,
): ReconciliationStatus {
  if (official === null) return "no_official_snapshot";
  if (coverageStatus === "no_sync") return "normalized_data_incomplete";
  if (coverageStatus === "date_mismatch") return "source_date_mismatch";
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
      return `${creditType} sync (${lastSyncAt?.slice(0, 10) ?? "unknown"}) ran before the ` +
        `official report EndPeriod (${reportAsOf ?? "unknown"}). ` +
        `RemainingCredit values are not point-in-time compatible with the ${reportAsOf} snapshot. ` +
        `Re-sync on or after ${reportAsOf} to reconcile.`;
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
