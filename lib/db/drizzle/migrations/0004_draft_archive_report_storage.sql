-- Migration 0004: Draft archive + Report History artifact storage
--
-- PREFLIGHT: verify current state
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'report_drafts' AND column_name = 'archived_at';
--   (should return 0 rows before applying)
--
-- APPLY:
--   Run this SQL in the Replit PostgreSQL console (or Supabase SQL Editor).
--   Do NOT include in startup scripts or deployment pipelines.
--
-- ROLLBACK: see bottom of file.
--
-- VERIFICATION: see bottom of file.

-- ─── Part 1: Soft-archive columns on report_drafts ─────────────────────────
ALTER TABLE report_drafts
  ADD COLUMN IF NOT EXISTS archived_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by     TEXT,
  ADD COLUMN IF NOT EXISTS archive_reason  TEXT;

CREATE INDEX IF NOT EXISTS idx_rdraft_archived
  ON report_drafts (archived_at)
  WHERE archived_at IS NOT NULL;

-- ─── Part 2: Artifact storage metadata on report_history ───────────────────
ALTER TABLE report_history
  ADD COLUMN IF NOT EXISTS storage_provider  TEXT,
  ADD COLUMN IF NOT EXISTS storage_key       TEXT,
  ADD COLUMN IF NOT EXISTS file_name         TEXT,
  ADD COLUMN IF NOT EXISTS content_type      TEXT,
  ADD COLUMN IF NOT EXISTS file_size         INTEGER,
  ADD COLUMN IF NOT EXISTS checksum          TEXT,
  ADD COLUMN IF NOT EXISTS stored_at         TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rhistory_storage_key
  ON report_history (storage_key)
  WHERE storage_key IS NOT NULL;

-- ─── VERIFICATION ──────────────────────────────────────────────────────────
-- Run after applying to confirm all columns exist:
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'report_drafts'
--     AND column_name IN ('archived_at', 'archived_by', 'archive_reason')
--   ORDER BY column_name;
--
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'report_history'
--     AND column_name IN ('storage_provider', 'storage_key', 'file_name',
--                         'content_type', 'file_size', 'checksum', 'stored_at')
--   ORDER BY column_name;
--
--   SELECT COUNT(*) FROM report_drafts;   -- should equal pre-migration count
--   SELECT COUNT(*) FROM report_history;  -- should equal pre-migration count

-- ─── ROLLBACK ──────────────────────────────────────────────────────────────
-- To undo:
--   DROP INDEX IF EXISTS idx_rdraft_archived;
--   ALTER TABLE report_drafts
--     DROP COLUMN IF EXISTS archived_at,
--     DROP COLUMN IF EXISTS archived_by,
--     DROP COLUMN IF EXISTS archive_reason;
--
--   DROP INDEX IF EXISTS idx_rhistory_storage_key;
--   ALTER TABLE report_history
--     DROP COLUMN IF EXISTS storage_provider,
--     DROP COLUMN IF EXISTS storage_key,
--     DROP COLUMN IF EXISTS file_name,
--     DROP COLUMN IF EXISTS content_type,
--     DROP COLUMN IF EXISTS file_size,
--     DROP COLUMN IF EXISTS checksum,
--     DROP COLUMN IF EXISTS stored_at;
