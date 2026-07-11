import { Pool } from "pg";
import type { EntityMetrics, EntitySlug, MetricSnapshot, MetricSnapshotsData } from "./types";
import { ENTITY_SLUGS } from "./types";
import { withHealth } from "./health";

/**
 * Postgres-backed monthly snapshots of per-entity metrics. One row per
 * (slug, month); each pipeline day the latest as_of within a month wins.
 * This is what makes the History page's health-score trend real: scores are
 * recomputed from the metrics that were actually observed in each month,
 * instead of pretending the current score applies retroactively.
 */

let pool: Pool | null = null;
let ensured: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required for metric snapshots");
    }
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}

function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS "metric_snapshots" (
          "slug" text NOT NULL,
          "month" text NOT NULL,
          "as_of" date NOT NULL,
          "metrics" jsonb NOT NULL,
          "captured_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("slug", "month")
        )`,
      )
      .then(() => undefined)
      .catch((err) => {
        ensured = null;
        throw err;
      });
  }
  return ensured;
}

/**
 * Upsert this month's snapshot for an entity. A newer (or equal) as_of within
 * the same month replaces the stored one; older data never overwrites newer.
 */
export async function archiveMetricSnapshot(slug: EntitySlug, metrics: EntityMetrics): Promise<void> {
  const asOf = (metrics.as_of ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return;
  const month = asOf.slice(0, 7);

  await ensureTable();
  await getPool().query(
    `INSERT INTO "metric_snapshots" ("slug", "month", "as_of", "metrics")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("slug", "month") DO UPDATE
       SET "as_of" = EXCLUDED."as_of",
           "metrics" = EXCLUDED."metrics",
           "captured_at" = now()
       WHERE "metric_snapshots"."as_of" <= EXCLUDED."as_of"`,
    [slug, month, asOf, JSON.stringify(metrics)],
  );
}

export async function getMetricSnapshots(): Promise<MetricSnapshotsData> {
  await ensureTable();
  const result = await getPool().query<{
    slug: string;
    month: string;
    as_of: string;
    metrics: EntityMetrics;
  }>(
    `SELECT "slug", "month", to_char("as_of", 'YYYY-MM-DD') AS "as_of", "metrics"
     FROM "metric_snapshots"
     ORDER BY "slug", "month"`,
  );

  const data = Object.fromEntries(
    ENTITY_SLUGS.map((slug) => [slug, [] as MetricSnapshot[]]),
  ) as MetricSnapshotsData;

  for (const row of result.rows) {
    const slug = row.slug as EntitySlug;
    if (!ENTITY_SLUGS.includes(slug)) continue;
    // Re-derive health from the single source so historical snapshots (even
    // those archived before health injection existed) expose the same field
    // the frontend reads — never recomputed client-side.
    data[slug].push({ month: row.month, as_of: row.as_of, metrics: withHealth(row.metrics) });
  }
  return data;
}
