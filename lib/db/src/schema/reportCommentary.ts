/**
 * Report Commentary & Draft tables.
 *
 * These tables are Dashboard-owned and live in the operational database
 * (DATABASE_URL). They must never be written to FinanceOS Core (CORE_DATABASE_URL).
 *
 * Design principles:
 * - Financial values remain in Core, read-only. These tables store narrative only.
 * - Every auto-generated statement carries provenance (metric, value, formula, period, source).
 * - Management commentary is clearly typed and separated from FinanceOS analysis.
 * - Drafts are versioned; approved drafts cannot silently mutate.
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── report_commentary ────────────────────────────────────────────────────────
// One row per (entity/portfolio, period, template, section, commentary_type, version).
// Multiple versions accumulate; only the latest "active" one is displayed.
export const reportCommentary = pgTable(
  "report_commentary",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Entity slug (e.g. "T3_Marketing") or "portfolio" for consolidated reports. */
    entitySlug: text("entity_slug").notNull(),

    /** Reporting period exactly as used by the report engine (e.g. "Jun 2026 (Latest)"). */
    reportingPeriod: text("reporting_period").notNull(),

    /** Template ID (e.g. "monthly-close"). */
    templateId: text("template_id").notNull(),

    /**
     * Section key within the template (e.g. "executive_summary", "management_commentary",
     * "entity_performance", "cash_and_liquidity", "recommended_actions").
     */
    sectionKey: text("section_key").notNull(),

    /**
     * Type of commentary:
     * - financeos_analysis   : auto-generated, deterministic, traceable
     * - management_commentary: entered/edited by a user
     * - recommended_action   : auto-suggested or user-added action item
     */
    commentaryType: text("commentary_type").notNull(),

    /** The narrative text. Never a financial value — prose only. */
    content: text("content").notNull(),

    /**
     * Provenance JSON for financeos_analysis rows. Contains:
     * { metric, currentValue, comparisonValue, formula, reportingPeriod,
     *   comparisonPeriod, entitySlugs, sourceTable, generatedAt }
     * Null for management_commentary and recommended_action rows.
     */
    provenance: jsonb("provenance"),

    /**
     * Status of this commentary entry:
     * - draft     : being worked on
     * - approved  : signed off by an authorized user
     * - superseded: replaced by a newer version
     * - waived    : section intentionally left empty, approved by authorized user
     */
    status: text("status").notNull().default("draft"),

    /** Version counter. Starts at 1; incremented each time content is edited. */
    version: integer("version").notNull().default(1),

    /** Whether this entry is currently included in the report (user can toggle). */
    included: boolean("included").notNull().default(true),

    /** Sort order within a section (for recommended_action and management blocks). */
    sortOrder: integer("sort_order").notNull().default(0),

    /** User email who created this entry (from session at creation time). */
    createdBy: text("created_by"),

    /** User email who last modified this entry. */
    updatedBy: text("updated_by"),

    /** User email who approved this entry. */
    approvedBy: text("approved_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_rcomm_entity_period").on(t.entitySlug, t.reportingPeriod),
    index("idx_rcomm_template_period").on(t.templateId, t.reportingPeriod),
    index("idx_rcomm_section").on(t.entitySlug, t.reportingPeriod, t.templateId, t.sectionKey),
    check(
      "chk_rcomm_type",
      sql`${t.commentaryType} IN ('financeos_analysis', 'management_commentary', 'recommended_action')`,
    ),
    check(
      "chk_rcomm_status",
      sql`${t.status} IN ('draft', 'approved', 'superseded', 'waived')`,
    ),
  ],
);

export type ReportCommentaryRow    = typeof reportCommentary.$inferSelect;
export type InsertReportCommentary = typeof reportCommentary.$inferInsert;

// ─── report_drafts ────────────────────────────────────────────────────────────
// One row per (template, period, entitySlugs) draft. Only one non-superseded
// draft can be active at a time per (template, period). When a new draft is
// created for the same key, the old one is superseded.
export const reportDrafts = pgTable(
  "report_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Template ID (e.g. "monthly-close"). */
    templateId: text("template_id").notNull(),

    /** Reporting period. */
    reportingPeriod: text("reporting_period").notNull(),

    /**
     * Sorted array of entity slugs. "portfolio" is a synthetic slug used
     * when all entities are included in a consolidated report.
     */
    entitySlugs: text("entity_slugs").array().notNull(),

    /**
     * Draft lifecycle status:
     * - draft           : in progress, not yet submitted for review
     * - ready_for_review: submitted, awaiting approval
     * - approved        : approved, ready for final generation
     * - superseded      : replaced by a newer draft
     * - generated       : final PDF/HTML generated from this approved draft
     */
    status: text("status").notNull().default("draft"),

    /** Incrementing version of this draft (not the same as commentary version). */
    currentVersion: integer("current_version").notNull().default(1),

    /**
     * Snapshot of the auto-generated FinanceOS analysis at the time the draft
     * was created or refreshed. JSONB array of commentary entries with provenance.
     * This is "frozen" at draft creation time so the approved content is stable.
     */
    generatedAnalysis: jsonb("generated_analysis"),

    /**
     * User-editable content: { reportTitle, sectionOverrides, includedSections }.
     * reportTitle: optional override of the default report title.
     * sectionOverrides: map of sectionKey → { heading?, intro?, conclusion?, notes? }
     * includedSections: set of section keys the user toggled on/off.
     */
    editableContent: jsonb("editable_content"),

    /**
     * SHA-256 fingerprint of the financial data used to build this draft.
     * If live data changes after approval, the fingerprint changes and the draft
     * is marked stale, requiring re-approval.
     */
    dataFingerprint: text("data_fingerprint"),

    /** Whether live data has changed since the draft was approved (stale guard). */
    isStale: boolean("is_stale").notNull().default(false),

    /** Description of what changed when marked stale. */
    staleReason: text("stale_reason"),

    /** User email who created this draft. */
    createdBy: text("created_by"),

    /** User email who last modified this draft. */
    updatedBy: text("updated_by"),

    /** User email who approved this draft. */
    approvedBy: text("approved_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    // ── Soft-archive (nullable — unarchived rows have null) ──────────────────
    /** When this draft was archived. NULL = active draft. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** User who archived this draft. */
    archivedBy: text("archived_by"),
    /** Optional reason provided when archiving. */
    archiveReason: text("archive_reason"),
  },
  (t) => [
    index("idx_rdraft_template_period").on(t.templateId, t.reportingPeriod),
    index("idx_rdraft_status").on(t.status, t.createdAt),
    index("idx_rdraft_archived").on(t.archivedAt),
    check(
      "chk_rdraft_status",
      sql`${t.status} IN ('draft', 'ready_for_review', 'approved', 'superseded', 'generated')`,
    ),
  ],
);

export type ReportDraftRow    = typeof reportDrafts.$inferSelect;
export type InsertReportDraft = typeof reportDrafts.$inferInsert;

// ─── report_draft_versions ────────────────────────────────────────────────────
// Immutable audit log. Every time a draft is saved, a version snapshot is appended.
// Versions are never updated or deleted. Restore = create a new draft version
// whose content comes from an old snapshot.
export const reportDraftVersions = pgTable(
  "report_draft_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    reportDraftId: uuid("report_draft_id")
      .notNull()
      .references(() => reportDrafts.id, { onDelete: "cascade" }),

    versionNumber: integer("version_number").notNull(),

    /**
     * Complete snapshot of draft.editableContent + commentary rows at this version.
     * Contains: { editableContent, commentaryIds, summary }
     */
    contentSnapshot: jsonb("content_snapshot").notNull(),

    /** Short description of what changed in this version. */
    changeSummary: text("change_summary"),

    /** User who saved this version. */
    createdBy: text("created_by"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_rdraftv_draft_version").on(t.reportDraftId, t.versionNumber),
    unique("uq_rdraftv_draft_version").on(t.reportDraftId, t.versionNumber),
  ],
);

export type ReportDraftVersionRow    = typeof reportDraftVersions.$inferSelect;
export type InsertReportDraftVersion = typeof reportDraftVersions.$inferInsert;
