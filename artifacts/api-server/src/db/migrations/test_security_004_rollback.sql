-- PostgreSQL rollback-only semantic test for security_004_first_last_name.sql
-- Run from Replit shell BEFORE applying the migration:
--   psql "$DATABASE_URL" -f artifacts/api-server/src/db/migrations/test_security_004_rollback.sql
--
-- Expected output: 9 rows, all result = 'PASS', no FAIL rows.
-- This test never writes to any production table — it uses a temp table
-- inside a transaction that ends with ROLLBACK.
--
-- Never use Supabase. Never access CORE_DATABASE_URL.

BEGIN;

CREATE TEMP TABLE _mig_test (
  id          SERIAL,
  label       TEXT,
  fn_before   TEXT,
  ln_before   TEXT,
  display_name TEXT,
  exp_first   TEXT,
  exp_last    TEXT
) ON COMMIT DROP;

INSERT INTO _mig_test (label, fn_before, ln_before, display_name, exp_first, exp_last)
VALUES
  ('single word',         NULL,      NULL,    'Allison',          'Allison', NULL),
  ('two words',           NULL,      NULL,    'Allison Fabbri',   'Allison', 'Fabbri'),
  ('three words',         NULL,      NULL,    'Mary Jane Watson', 'Mary',    'Jane Watson'),
  ('leading/trailing',    NULL,      NULL,    '  Jane  Smith  ', 'Jane',    'Smith'),
  ('blank string',        NULL,      NULL,    '',                 NULL,      NULL),
  ('whitespace only',     NULL,      NULL,    '   ',              NULL,      NULL),
  ('first set last null', 'Already', NULL,    'Already Pop',      'Already', 'Pop'),
  ('first null last set', NULL,      'Set',   'Null First',       'Null',    'Set'),
  ('both set',            'Both',    'Set',   'Both Set',         'Both',    'Set');

SELECT
  label,
  COALESCE(
    fn_before,
    NULLIF(TRIM(split_part(TRIM(display_name), ' ', 1)), '')
  )                                                                     AS got_first,
  COALESCE(
    ln_before,
    CASE
      WHEN POSITION(' ' IN TRIM(display_name)) > 0
      THEN NULLIF(
        TRIM(substring(TRIM(display_name) FROM POSITION(' ' IN TRIM(display_name)) + 1)),
        ''
      )
      ELSE NULL
    END
  )                                                                     AS got_last,
  exp_first,
  exp_last,
  CASE
    -- Result must match expected
    WHEN COALESCE(fn_before, NULLIF(TRIM(split_part(TRIM(display_name), ' ', 1)), ''))
         IS NOT DISTINCT FROM exp_first
     AND COALESCE(ln_before,
           CASE WHEN POSITION(' ' IN TRIM(display_name)) > 0
                THEN NULLIF(TRIM(substring(TRIM(display_name) FROM POSITION(' ' IN TRIM(display_name)) + 1)), '')
                ELSE NULL END)
         IS NOT DISTINCT FROM exp_last
    -- Pre-existing first_name must not be overwritten
     AND (fn_before IS NULL
          OR COALESCE(fn_before, NULLIF(TRIM(split_part(TRIM(display_name), ' ', 1)), '')) = fn_before)
    -- Pre-existing last_name must not be overwritten
     AND (ln_before IS NULL
          OR COALESCE(ln_before,
               CASE WHEN POSITION(' ' IN TRIM(display_name)) > 0
                    THEN NULLIF(TRIM(substring(TRIM(display_name) FROM POSITION(' ' IN TRIM(display_name)) + 1)), '')
                    ELSE NULL END)
             = ln_before)
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM _mig_test
ORDER BY id;

ROLLBACK;
