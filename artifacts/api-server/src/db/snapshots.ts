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

export interface ArApReconciliation {
  /** QBO-authoritative open AR from AgedReceivableSummary (entity_snapshots). */
  officialAr: number | null;
  /** QBO-authoritative open AP from AgedPayableSummary (entity_snapshots). */
  officialAp: number | null;
  /** ISO date of the snapshot report used for official values. */
  asOf: string | null;
  /** Sum of invoices.balance for non-Paid, non-deleted rows. */
  normalizedAr: number | null;
  /** Sum of bills.balance for non-Paid, non-deleted rows. */
  normalizedAp: number | null;
  /** |officialAr - normalizedAr|. Null when either source is unavailable. */
  arDiff: number | null;
  /** |officialAp - normalizedAp|. Null when either source is unavailable. */
  apDiff: number | null;
  /** True when arDiff ≤ $0.02 (floating-point tolerance). */
  arReconciled: boolean;
  /** True when apDiff ≤ $0.02. */
  apReconciled: boolean;
}

/**
 * Returns AR/AP reconciliation data for one entity.
 * Combines the QBO-authoritative totals from entity_snapshots with
 * normalized sums from the invoices and bills tables so the UI can
 * show a warning when the two sources diverge.
 *
 * Read-only — never writes to any table.
 */
export async function getArApReconciliation(entityId: string): Promise<ArApReconciliation> {
  const TOLERANCE = 0.02;

  const snapshot = await getCurrentSnapshot(entityId);
  const arApMetrics = (snapshot?.metrics as Record<string, unknown> | null)?.["ar_ap_metrics"] as
    | Record<string, unknown>
    | undefined;

  const officialAr = typeof arApMetrics?.["open_ar"] === "number" ? arApMetrics["open_ar"] : null;
  const officialAp = typeof arApMetrics?.["open_ap"] === "number" ? arApMetrics["open_ap"] : null;
  const asOf = snapshot?.asOf ? String(snapshot.asOf) : null;

  // Normalised sums from typed tables — live at query time
  const arRows = await db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM(balance), 0)::text AS total
        FROM invoices
        WHERE entity_id = ${entityId} AND status != 'Paid' AND is_deleted = false`,
  );
  const apRows = await db.execute<{ total: string | null }>(
    sql`SELECT COALESCE(SUM(balance), 0)::text AS total
        FROM bills
        WHERE entity_id = ${entityId} AND status != 'Paid' AND is_deleted = false`,
  );

  const normalizedAr = parseFloat(arRows.rows[0]?.total ?? "0") || 0;
  const normalizedAp = parseFloat(apRows.rows[0]?.total ?? "0") || 0;

  const arDiff = officialAr !== null ? Math.abs(officialAr - normalizedAr) : null;
  const apDiff = officialAp !== null ? Math.abs(officialAp - normalizedAp) : null;

  return {
    officialAr,
    officialAp,
    asOf,
    normalizedAr,
    normalizedAp,
    arDiff,
    apDiff,
    arReconciled: arDiff !== null && arDiff <= TOLERANCE,
    apReconciled: apDiff !== null && apDiff <= TOLERANCE,
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
