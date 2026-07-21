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
 * - source_date_mismatch    Snapshot asOf and normalized data differ by > 7 days.
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
const DATE_MISMATCH_DAYS = 7;

function _daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  try {
    return Math.abs(
      (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24),
    );
  } catch {
    return null;
  }
}

function _arStatus(
  officialAr: number | null,
  normalizedNetAr: number | null,
  unappliedCredits: number | null,
  officialAsOf: string | null,
  normalizedAsOf: string | null,
): ReconciliationStatus {
  if (officialAr === null) return "no_official_snapshot";
  if (unappliedCredits === null) return "normalized_data_incomplete";
  if (normalizedNetAr === null) return "normalized_data_incomplete";
  const days = _daysBetween(officialAsOf, normalizedAsOf);
  if (days !== null && days > DATE_MISMATCH_DAYS) return "source_date_mismatch";
  const diff = Math.abs(officialAr - normalizedNetAr);
  return diff <= RECON_TOLERANCE ? "reconciled" : "unreconciled";
}

function _statusExplanation(
  status: ReconciliationStatus,
  side: "AR" | "AP",
  officialTotal: number | null,
  normalizedGross: number,
  unappliedCredits: number | null,
  normalizedNet: number | null,
  absDiff: number | null,
): string {
  switch (status) {
    case "reconciled":
      return `${side} reconciles within $${RECON_TOLERANCE.toFixed(2)}.`;
    case "no_official_snapshot":
      return `No ${side} snapshot available. Run the Python pipeline to generate entity_snapshots.`;
    case "normalized_data_incomplete":
      return `${side} credit data (${side === "AR" ? "CreditMemo" : "VendorCredit"}) has not been synced to qbo_raw. ` +
        `Net normalized ${side} cannot be computed honestly. Run the pipeline with the updated TRANSACTION_OBJECT_TYPES.`;
    case "source_date_mismatch":
      return `${side} snapshot and normalized data dates differ by more than ${DATE_MISMATCH_DAYS} days. ` +
        `Re-sync normalized data to align with the official report period.`;
    case "unreconciled": {
      const diff = absDiff !== null ? `$${absDiff.toFixed(2)}` : "unknown";
      const credStr = unappliedCredits !== null ? `$${unappliedCredits.toFixed(2)}` : "unknown";
      return `${side} gap of ${diff}. Official: $${(officialTotal ?? 0).toFixed(2)}, ` +
        `gross detail: $${normalizedGross.toFixed(2)}, unapplied ${side === "AR" ? "customer" : "vendor"} credits: ${credStr}, ` +
        `net detail: $${(normalizedNet ?? 0).toFixed(2)}.`;
    }
  }
}

/**
 * Returns full AR/AP reconciliation data for one entity.
 *
 * Correct data contract (QBO accounting treatment):
 *   1. Invoice.Balance already reflects applied CreditMemos — QBO reduces Balance
 *      when a CreditMemo is applied to an invoice. Do NOT subtract applied amounts again.
 *   2. Only the RemainingCredit (unapplied portion) of a CreditMemo is not yet
 *      in Invoice.Balance and must be subtracted separately.
 *   3. Same for VendorCredit: Bill.Balance already reflects applied amounts;
 *      only VendorCredit.Balance (remaining) is subtracted separately.
 *   4. If CreditMemo/VendorCredit data has never been synced (qbo_raw has 0 rows
 *      for that type), the reconciliation status is normalized_data_incomplete —
 *      never coerce to zero.
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

  // ── Gross normalized AR from invoices table ────────────────────────────────
  // Invoice.Balance already reflects applied CreditMemos (QBO reduces it on application).
  const arRows = await db.execute<{ total: string | null; asof: string | null }>(
    sql`SELECT COALESCE(SUM(balance), 0)::text AS total,
               MAX(synced_at)::text AS asof
        FROM invoices
        WHERE entity_id = ${entityId} AND status != 'Paid' AND is_deleted = false`,
  );
  const normalizedGrossAr = parseFloat(arRows.rows[0]?.total ?? "0") || 0;
  const normalizedArAsOf = arRows.rows[0]?.asof ?? null;

  // ── Unapplied customer credits from qbo_raw ────────────────────────────────
  // RemainingCredit = portion not yet applied to any invoice.
  // Returns null (not 0) when no CreditMemo rows exist → normalized_data_incomplete.
  const cmCountRows = await db.execute<{ n: string }>(
    sql`SELECT COUNT(*)::text AS n FROM qbo_raw
        WHERE entity_id = ${entityId} AND object_type = 'CreditMemo' AND is_deleted = false`,
  );
  const cmCount = parseInt(cmCountRows.rows[0]?.n ?? "0", 10);

  let unappliedCustomerCredits: number | null = null;
  if (cmCount > 0) {
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
    unappliedCustomerCredits = parseFloat(cmRows.rows[0]?.total ?? "0") || 0;
  }

  const normalizedNetAr =
    unappliedCustomerCredits !== null
      ? normalizedGrossAr - unappliedCustomerCredits
      : null;

  // ── Gross normalized AP from bills table ───────────────────────────────────
  const apRows = await db.execute<{ total: string | null; asof: string | null }>(
    sql`SELECT COALESCE(SUM(balance), 0)::text AS total,
               MAX(synced_at)::text AS asof
        FROM bills
        WHERE entity_id = ${entityId} AND status != 'Paid' AND is_deleted = false`,
  );
  const normalizedGrossAp = parseFloat(apRows.rows[0]?.total ?? "0") || 0;
  const normalizedApAsOf = apRows.rows[0]?.asof ?? null;

  // ── Unapplied vendor credits from qbo_raw ─────────────────────────────────
  // VendorCredit uses Balance field (not RemainingCredit) for the unapplied portion.
  const vcCountRows = await db.execute<{ n: string }>(
    sql`SELECT COUNT(*)::text AS n FROM qbo_raw
        WHERE entity_id = ${entityId} AND object_type = 'VendorCredit' AND is_deleted = false`,
  );
  const vcCount = parseInt(vcCountRows.rows[0]?.n ?? "0", 10);

  let unappliedVendorCredits: number | null = null;
  if (vcCount > 0) {
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
    unappliedVendorCredits = parseFloat(vcRows.rows[0]?.total ?? "0") || 0;
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
  const arStatus = _arStatus(officialAr, normalizedNetAr, unappliedCustomerCredits, officialAsOf, normalizedArAsOf);
  const apStatus = _arStatus(officialAp, normalizedNetAp, unappliedVendorCredits, officialAsOf, normalizedApAsOf);

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
    ),
    apExplanation: _statusExplanation(
      apStatus, "AP", officialAp, normalizedGrossAp, unappliedVendorCredits, normalizedNetAp, apAbsDiff,
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
