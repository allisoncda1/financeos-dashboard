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

    // ── Draft linkage (nullable — pre-draft rows remain readable) ────────────
    /** UUID of the report draft used to generate this report, if any. */
    draftId:           uuid("draft_id"),
    /** Version number of the draft snapshot used. */
    draftVersion:      integer("draft_version"),
    /** Approval status at generation time: approved | auto_approved | null */
    approvalStatus:    text("approval_status"),
    /** Email of the user who approved the draft. */
    approvedBy:        text("approved_by"),
    /** When the draft was approved. */
    approvedAt:        timestamp("approved_at", { withTimezone: true }),
    /** SHA-256 fingerprint of financial data at draft creation time. */
    dataFingerprint:   text("data_fingerprint"),
    /** Commentary version number at generation time. */
    commentaryVersion: integer("commentary_version"),

    // ── Stored artifact metadata (nullable — pre-storage rows remain readable) ─
    /** Storage provider: "replit-object-storage" | "s3" | null (not stored). */
    storageProvider: text("storage_provider"),
    /** Object storage key, e.g. reports/2026/07/monthly-close/portfolio/{id}/report.pdf */
    storageKey: text("storage_key"),
    /** Original filename for download. */
    fileName: text("file_name"),
    /** MIME type of the stored file. */
    contentType: text("content_type"),
    /** File size in bytes. */
    fileSize: integer("file_size"),
    /** SHA-256 hex checksum of the stored file. */
    checksum: text("checksum"),
    /** When the artifact was stored. */
    storedAt: timestamp("stored_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_report_history_created").on(t.createdAt),
    index("idx_report_history_template").on(t.template, t.createdAt),
    index("idx_report_history_draft").on(t.draftId),
    check("chk_report_history_status", sql`${t.status} IN ('queued', 'processing', 'completed', 'failed')`),
    check("chk_report_history_format", sql`${t.format} IN ('json', 'pdf', 'excel', 'html')`),
  ],
);

export type ReportHistoryRow    = typeof reportHistory.$inferSelect;
export type InsertReportHistory = typeof reportHistory.$inferInsert;
