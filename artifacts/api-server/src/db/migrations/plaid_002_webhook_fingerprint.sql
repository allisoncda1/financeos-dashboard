-- Migration: plaid_002_webhook_fingerprint
-- Target:     DATABASE_URL (heliumdb) ONLY — do NOT run against CORE_DATABASE_URL
-- Purpose:    Add event_fingerprint column to plaid_webhook_events for idempotent webhook processing
--
-- SAFE TO APPLY ONLY when preflight confirms row count = 0.
-- If rows exist, stop and seek manual review before proceeding past Step 2.

-- ============================================================
-- PREFLIGHT (run before applying anything)
-- ============================================================
--
-- SELECT COUNT(*) AS row_count FROM plaid_webhook_events;
--
-- Expected: 0
-- If row_count > 0: do NOT proceed — report count and await review.

-- ============================================================
-- FORWARD MIGRATION
-- ============================================================

-- Step 1: Add column as nullable first (safe on any row count)
ALTER TABLE plaid_webhook_events
  ADD COLUMN IF NOT EXISTS event_fingerprint TEXT;

-- Step 2: Confirm table is empty before applying NOT NULL + UNIQUE.
--         The DO block below aborts the migration if rows exist without a fingerprint.
DO $$
DECLARE
  unfingerprinted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unfingerprinted_count
  FROM plaid_webhook_events
  WHERE event_fingerprint IS NULL;

  IF unfingerprinted_count > 0 THEN
    RAISE EXCEPTION
      'plaid_002 aborted: % rows in plaid_webhook_events have NULL event_fingerprint. '
      'Backfill fingerprints manually before proceeding.', unfingerprinted_count;
  END IF;
END $$;

-- Step 3: Set NOT NULL now that we have confirmed no unfingerprinted rows
ALTER TABLE plaid_webhook_events
  ALTER COLUMN event_fingerprint SET NOT NULL;

-- Step 4: Add unique index (faster than a table constraint for large tables;
--         enforces the same guarantee)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_plaid_webhook_events_fingerprint
  ON plaid_webhook_events (event_fingerprint);

-- ============================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================
--
-- SELECT
--   column_name,
--   is_nullable,
--   data_type
-- FROM information_schema.columns
-- WHERE table_name = 'plaid_webhook_events'
--   AND column_name = 'event_fingerprint';
--
-- Expected:
--   column_name        | is_nullable | data_type
--   event_fingerprint  | NO          | text
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'plaid_webhook_events'
--   AND indexname = 'uidx_plaid_webhook_events_fingerprint';
--
-- Expected: one row with a UNIQUE index definition

-- ============================================================
-- ROLLBACK
-- ============================================================
--
-- DROP INDEX IF EXISTS uidx_plaid_webhook_events_fingerprint;
-- ALTER TABLE plaid_webhook_events DROP COLUMN IF EXISTS event_fingerprint;
