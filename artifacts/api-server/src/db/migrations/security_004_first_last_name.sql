-- Migration: security_004_first_last_name
-- Adds first_name and last_name to user_invitations and app_users.
-- display_name is kept for backward compatibility; the application layer
-- derives it from first_name || ' ' || last_name on every write.
--
-- Target:  DATABASE_URL / heliumdb (Replit PostgreSQL) ONLY.
-- Apply:   psql "$DATABASE_URL" -f artifacts/api-server/src/db/migrations/security_004_first_last_name.sql
-- NEVER apply via Supabase. NEVER touch CORE_DATABASE_URL.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS is safe to run more than once.
-- Backfill:   COALESCE preserves any existing non-NULL value; the CASE
--             guard prevents setting last_name when display_name has no space.
-- WHERE:      OR last_name IS NULL ensures independent preservation of each
--             field — a populated last_name is never overwritten even when
--             first_name is NULL (and vice versa).

BEGIN;

-- 1. Add columns
ALTER TABLE user_invitations
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- 2. Backfill user_invitations
UPDATE user_invitations
SET
  first_name = COALESCE(
    first_name,
    NULLIF(TRIM(split_part(TRIM(display_name), ' ', 1)), '')
  ),
  last_name = COALESCE(
    last_name,
    CASE
      WHEN POSITION(' ' IN TRIM(display_name)) > 0
      THEN NULLIF(
        TRIM(substring(TRIM(display_name) FROM POSITION(' ' IN TRIM(display_name)) + 1)),
        ''
      )
      ELSE NULL
    END
  )
WHERE first_name IS NULL OR last_name IS NULL;

-- 3. Backfill app_users (identical logic)
UPDATE app_users
SET
  first_name = COALESCE(
    first_name,
    NULLIF(TRIM(split_part(TRIM(display_name), ' ', 1)), '')
  ),
  last_name = COALESCE(
    last_name,
    CASE
      WHEN POSITION(' ' IN TRIM(display_name)) > 0
      THEN NULLIF(
        TRIM(substring(TRIM(display_name) FROM POSITION(' ' IN TRIM(display_name)) + 1)),
        ''
      )
      ELSE NULL
    END
  )
WHERE first_name IS NULL OR last_name IS NULL;

COMMIT;
