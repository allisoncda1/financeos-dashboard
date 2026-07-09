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

  return rows[0] ?? null;
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
