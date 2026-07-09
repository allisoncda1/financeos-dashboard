import { eq, and, desc } from "drizzle-orm";
import { db } from "./connection";
import { syncRuns } from "@workspace/db";

export type { SyncRun } from "@workspace/db";

/**
 * Most recent completed sync run for one entity.
 * Used to derive pipeline freshness (last successful sync time).
 */
export async function getLastSuccessfulRun(entityId: string) {
  const rows = await db
    .select()
    .from(syncRuns)
    .where(
      and(
        eq(syncRuns.entityId, entityId),
        eq(syncRuns.status, "complete"),
      ),
    )
    .orderBy(desc(syncRuns.startedAt))
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
    .from(syncRuns)
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit);
}

/**
 * All runs for one entity, newest first.
 */
export async function getRunsByEntity(entityId: string, limit = 10) {
  return db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.entityId, entityId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(limit);
}
