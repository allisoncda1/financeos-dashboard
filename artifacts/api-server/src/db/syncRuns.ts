import { eq, and, desc } from "drizzle-orm";
import { db } from "./connection";
import { syncRunsTable } from "@workspace/db";

export type { SyncRunRow as SyncRun } from "@workspace/db";

/**
 * Most recent completed sync run for one entity.
 * Used to derive pipeline freshness (last successful sync time).
 */
export async function getLastSuccessfulRun(entityId: string) {
  const rows = await db
    .select()
    .from(syncRunsTable)
    .where(
      and(
        eq(syncRunsTable.entityId, entityId),
        eq(syncRunsTable.syncType, "incremental"),
        eq(syncRunsTable.status, "success"),
      ),
    )
    .orderBy(desc(syncRunsTable.completedAt))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Most recent sync runs across all entities (no entity filter).
 * Used by the pipeline status endpoint.
 */
export async function getRecentRuns(limit = 20) {
  return db
    .select()
    .from(syncRunsTable)
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(limit);
}

/**
 * All runs for one entity, newest first.
 */
export async function getRunsByEntity(entityId: string, limit = 10) {
  return db
    .select()
    .from(syncRunsTable)
    .where(eq(syncRunsTable.entityId, entityId))
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(limit);
}
