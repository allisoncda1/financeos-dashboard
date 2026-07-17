-- ============================================================
-- FinanceOS Dashboard — Operational DB Migration 0003
-- Report Commentary, Draft, and Version Tables
--
-- Database:   DATABASE_URL (Replit operational DB — not Core)
-- Schema:     Dashboard-owned tables only
-- Author:     FinanceOS automated migration
-- Branch:     feature/report-commentary-preview
--
-- ⚠ DO NOT apply to CORE_DATABASE_URL (read-only Neon)
-- ⚠ Apply manually via the Replit PostgreSQL console or
--   psql against DATABASE_URL. Never auto-run in production.
-- ============================================================


-- ── PREFLIGHT CHECKS ─────────────────────────────────────────────────────────
-- Run these SELECT statements first. They should all return 0 rows.
-- If any returns rows, the migration is already applied; stop here.
--
-- SELECT COUNT(*) FROM information_schema.tables
--   WHERE table_name IN
--     ('report_commentary', 'report_drafts', 'report_draft_versions');
--
-- Expected output: 0
-- If output is non-zero, the migration is already applied (idempotent guard).
-- ── END PREFLIGHT ─────────────────────────────────────────────────────────────


BEGIN;

-- ── Table: report_commentary ─────────────────────────────────────────────────
-- Stores all narrative text for reports: FinanceOS-generated analysis,
-- management commentary, and recommended actions.
-- Financial values are NEVER stored here — prose only.

CREATE TABLE IF NOT EXISTS report_commentary (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: entity slug OR "portfolio" for consolidated reports
  entity_slug      TEXT NOT NULL,

  -- Matches the period string used by the report engine
  reporting_period TEXT NOT NULL,

  -- Template ID (e.g. "monthly-close", "board-package")
  template_id      TEXT NOT NULL,

  -- Section within the template (e.g. "executive_summary", "cash_and_liquidity")
  section_key      TEXT NOT NULL,

  -- Source type: controls display labels and permissions
  commentary_type  TEXT NOT NULL
    CHECK (commentary_type IN (
      'financeos_analysis',
      'management_commentary',
      'recommended_action'
    )),

  -- The narrative text. Never a financial value — prose only.
  content          TEXT NOT NULL,

  -- Provenance JSON for financeos_analysis rows only.
  -- Contains: { metric, currentValue, comparisonValue, formula,
  --             reportingPeriod, comparisonPeriod, entitySlugs,
  --             sourceTable, generatedAt }
  provenance       JSONB,

  -- Lifecycle status
  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'superseded', 'waived')),

  -- Version counter (starts at 1; incremented on each content edit)
  version          INTEGER NOT NULL DEFAULT 1,

  -- Whether included in the current report (user can toggle)
  included         BOOLEAN NOT NULL DEFAULT TRUE,

  -- Display order within a section (for recommended_action blocks)
  sort_order       INTEGER NOT NULL DEFAULT 0,

  -- Audit columns
  created_by       TEXT,
  updated_by       TEXT,
  approved_by      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rcomm_entity_period
  ON report_commentary (entity_slug, reporting_period);

CREATE INDEX IF NOT EXISTS idx_rcomm_template_period
  ON report_commentary (template_id, reporting_period);

CREATE INDEX IF NOT EXISTS idx_rcomm_section
  ON report_commentary (entity_slug, reporting_period, template_id, section_key);

CREATE INDEX IF NOT EXISTS idx_rcomm_type_status
  ON report_commentary (commentary_type, status);


-- ── Table: report_drafts ──────────────────────────────────────────────────────
-- One draft per (template, period, entities) combination.
-- When a new draft is created for the same key, the old one is superseded.
-- Approved drafts are immutable — data changes mark them stale, requiring
-- re-approval before a new final report can be generated.

CREATE TABLE IF NOT EXISTS report_drafts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  template_id      TEXT NOT NULL,
  reporting_period TEXT NOT NULL,

  -- Sorted array of entity slugs, or ["portfolio"] for consolidated reports
  entity_slugs     TEXT[] NOT NULL,

  -- Lifecycle: draft → ready_for_review → approved → generated
  -- OR: any stage → superseded (when replaced by a newer draft)
  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'ready_for_review',
      'approved',
      'superseded',
      'generated'
    )),

  -- Incrementing draft version (separate from commentary version)
  current_version  INTEGER NOT NULL DEFAULT 1,

  -- Frozen snapshot of FinanceOS-generated analysis at draft creation time.
  -- JSONB array of { id, sectionKey, commentaryType, content, provenance }.
  -- This does NOT change after approval.
  generated_analysis JSONB,

  -- User-editable overlay:
  -- { reportTitle?, sectionOverrides: { [sectionKey]: { heading?, intro?,
  --   conclusion?, notes? } }, includedSections: string[] }
  editable_content JSONB,

  -- SHA-256 of key financial values at draft creation time.
  -- Used to detect if live data changed after approval (stale guard).
  data_fingerprint TEXT,

  -- Set to TRUE when live financial data changes after approval.
  is_stale         BOOLEAN NOT NULL DEFAULT FALSE,

  -- Human-readable explanation of what changed (set when is_stale = TRUE).
  stale_reason     TEXT,

  -- Audit columns
  created_by       TEXT,
  updated_by       TEXT,
  approved_by      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rdraft_template_period
  ON report_drafts (template_id, reporting_period);

CREATE INDEX IF NOT EXISTS idx_rdraft_status
  ON report_drafts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rdraft_created_by
  ON report_drafts (created_by, created_at DESC);


-- ── Table: report_draft_versions ─────────────────────────────────────────────
-- Immutable audit log. Every Save Draft call appends a new version row.
-- Rows are never updated or deleted.
-- "Restore" creates a new draft version using an old snapshot's content.

CREATE TABLE IF NOT EXISTS report_draft_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  report_draft_id UUID NOT NULL
    REFERENCES report_drafts (id) ON DELETE CASCADE,

  version_number  INTEGER NOT NULL,

  -- Complete snapshot:
  -- { editableContent: {...}, commentarySnapshot: [{id, content, ...}],
  --   changeSummary: "..." }
  content_snapshot JSONB NOT NULL,

  -- Short description of what changed in this version
  change_summary  TEXT,

  -- User who saved this version
  created_by      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (report_draft_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_rdraftv_draft_version
  ON report_draft_versions (report_draft_id, version_number DESC);


-- ── Extend report_history with draft linkage ──────────────────────────────────
-- Add optional columns to record which draft/approval produced this report.
-- NULL values are safe for all existing rows — no backfill required.
-- Existing Report History rows remain fully readable after this migration.

ALTER TABLE report_history
  ADD COLUMN IF NOT EXISTS draft_id          UUID,
  ADD COLUMN IF NOT EXISTS draft_version     INTEGER,
  ADD COLUMN IF NOT EXISTS approval_status   TEXT
    CHECK (approval_status IS NULL OR approval_status IN (
      'not_required', 'approved', 'auto_approved'
    )),
  ADD COLUMN IF NOT EXISTS approved_by       TEXT,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_fingerprint  TEXT,
  ADD COLUMN IF NOT EXISTS commentary_version INTEGER;


COMMIT;


-- ── VERIFICATION SQL ──────────────────────────────────────────────────────────
-- Run after committing to confirm migration success.
--
-- 1. All three tables exist:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name IN
--     ('report_commentary', 'report_drafts', 'report_draft_versions')
--   ORDER BY table_name;
-- Expected: 3 rows
--
-- 2. report_history has new columns:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'report_history'
--   AND column_name IN
--     ('draft_id','draft_version','approval_status','approved_by',
--      'approved_at','data_fingerprint','commentary_version')
--   ORDER BY column_name;
-- Expected: 7 rows
--
-- 3. Indexes created:
-- SELECT indexname FROM pg_indexes
--   WHERE tablename IN
--     ('report_commentary','report_drafts','report_draft_versions')
--   ORDER BY indexname;
-- Expected: 6+ rows
--
-- 4. Existing report_history rows still readable:
-- SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM report_history;
-- Expected: count unchanged from before migration
-- ── END VERIFICATION ──────────────────────────────────────────────────────────


-- ── ROLLBACK INSTRUCTIONS ─────────────────────────────────────────────────────
-- Apply ONLY if the migration must be reversed (e.g., during a failed deploy).
-- This permanently destroys all commentary and draft data.
--
-- BEGIN;
-- DROP TABLE IF EXISTS report_draft_versions CASCADE;
-- DROP TABLE IF EXISTS report_drafts CASCADE;
-- DROP TABLE IF EXISTS report_commentary CASCADE;
-- ALTER TABLE report_history
--   DROP COLUMN IF EXISTS draft_id,
--   DROP COLUMN IF EXISTS draft_version,
--   DROP COLUMN IF EXISTS approval_status,
--   DROP COLUMN IF EXISTS approved_by,
--   DROP COLUMN IF EXISTS approved_at,
--   DROP COLUMN IF EXISTS data_fingerprint,
--   DROP COLUMN IF EXISTS commentary_version;
-- COMMIT;
-- ── END ROLLBACK ──────────────────────────────────────────────────────────────
