import { date, index, json, jsonb, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * These two tables are created at runtime by the api-server (see
 * `artifacts/api-server/src/app.ts` for "session" and
 * `artifacts/api-server/src/lib/snapshotStore.ts` for "metric_snapshots").
 * They are mirrored here so `drizzle-kit push` recognizes them and does not
 * propose dropping them (which would destroy live sessions and archived
 * metric history). Keep these definitions in sync with the runtime DDL.
 */

export const sessionTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, mode: "date" }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const metricSnapshotsTable = pgTable(
  "metric_snapshots",
  {
    slug: text("slug").notNull(),
    month: text("month").notNull(),
    asOf: date("as_of").notNull(),
    metrics: jsonb("metrics").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ name: "metric_snapshots_pkey", columns: [table.slug, table.month] })],
);

export type MetricSnapshotRow = typeof metricSnapshotsTable.$inferSelect;
