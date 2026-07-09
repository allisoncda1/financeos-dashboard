import { pgTable, uuid, text, numeric, date, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { entities } from "./entities";

export const alerts = pgTable("alerts", {
  id:           uuid("id").primaryKey().defaultRandom(),
  entityId:     uuid("entity_id").references(() => entities.id),
  alertType:    text("alert_type").notNull(),
  severity:     text("severity").notNull(),
  title:        text("title").notNull(),
  message:      text("message").notNull(),
  metricValue:  numeric("metric_value"),
  threshold:    numeric("threshold"),
  periodType:   text("period_type"),
  periodStart:  date("period_start"),
  status:       text("status").notNull().default("open"),
  firstSeenAt:  timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt:   timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:   timestamp("resolved_at", { withTimezone: true }),
  source:       text("source").notNull().default("alerts_engine"),
  metadata:     text("metadata"),
}, (t) => [
  // Mirrors the partial unique index on the live table for idempotent upserts.
  // Drizzle cannot express WHERE-clause partial indexes in defineTable, so
  // this is annotated for reference only — the constraint lives in Postgres.
  index("alerts_entity_id_idx").on(t.entityId),
  index("alerts_status_idx").on(t.status),
  index("alerts_severity_idx").on(t.severity),
  index("alerts_last_seen_at_idx").on(t.lastSeenAt),
]);

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;
