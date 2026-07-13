import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const reportHistory = pgTable(
  "report_history",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    template:        text("template").notNull(),
    title:           text("title").notNull(),
    period:          text("period").notNull(),
    format:          text("format").notNull(),
    /** Array of entity slugs included in the report (e.g. ["cardealer_ai", "t3_marketing"]). */
    entitySlugs:     text("entity_slugs").array().notNull(),
    /** queued | processing | completed | failed */
    status:          text("status").notNull().default("completed"),
    /** live | cache | mock | db — worst-case source across all data pulled for the report. */
    source:          text("source"),
    /** ISO date string of the data snapshot used (as_of). */
    dataFreshness:   text("data_freshness"),
    entityCount:     integer("entity_count"),
    confidenceScore: integer("confidence_score"),
    /** Authenticated user email from the session at request time. */
    requestedBy:     text("requested_by"),
    /** Safe error summary — must never contain credentials or PII. */
    errorMessage:    text("error_message"),
    completedAt:     timestamp("completed_at", { withTimezone: true }),
    createdAt:       timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_report_history_created").on(t.createdAt),
    index("idx_report_history_template").on(t.template, t.createdAt),
    check("chk_report_history_status", sql`${t.status} IN ('queued', 'processing', 'completed', 'failed')`),
    check("chk_report_history_format", sql`${t.format} IN ('json', 'pdf', 'excel', 'html')`),
  ],
);

export type ReportHistoryRow    = typeof reportHistory.$inferSelect;
export type InsertReportHistory = typeof reportHistory.$inferInsert;
