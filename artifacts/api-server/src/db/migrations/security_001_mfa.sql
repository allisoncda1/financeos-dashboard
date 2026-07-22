-- MANUAL MIGRATION: security_001_mfa.sql
-- =============================================================================
-- DATABASE: DATABASE_URL — the Dashboard's writable operational PostgreSQL
-- database, provisioned by Replit (or overridden by a Replit Secret pointing
-- to your own Postgres instance).
--
-- PROOF OF OWNERSHIP:
--   lib/db/src/index.ts: "Writable operational database (Replit-provisioned,
--   DATABASE_URL). Holds Dashboard-owned tables: sessions, metric_snapshots, budgets."
--   lib/db/drizzle/migrations/0001_add_budgets.sql: "Runs against the Dashboard
--   operational database (DATABASE_URL)."
--   artifacts/api-server/src/app.ts: uses DATABASE_URL for connect-pg-simple
--   sessions — the same database this migration targets.
--   artifacts/api-server/src/auth/mfaRoutes.ts: uses DATABASE_URL for all MFA ops.
--
-- THIS IS NOT the FinanceOS Core financial database (CORE_DATABASE_URL). Core
-- contains financial tables (entities, financial_periods, sync_runs etc.) and is
-- read-only from the Dashboard. Target: DATABASE_URL only. Do not target CORE_DATABASE_URL.
--
-- HOW TO APPLY (choose ONE method):
--
--   Method A — Replit Shell (recommended):
--     In the Replit console, run:
--       psql $DATABASE_URL -f artifacts/api-server/src/db/migrations/security_001_mfa.sql
--     (Run PREFLIGHT SELECT first in a separate psql session to confirm idempotency.)
--
--   Method B — psql with explicit connection string:
--     psql "$(replit_secrets get DATABASE_URL)" \
--       -f artifacts/api-server/src/db/migrations/security_001_mfa.sql
--
--   Method C — Replit Database panel:
--     Open the Database tab in the Replit sidebar → SQL Editor → paste and run.
--
-- DO NOT apply this to the Core financial database (CORE_DATABASE_URL).
-- DO NOT run this via Drizzle's migrate command (it targets Core via DATABASE_URL
--   in the lib/db package, not this operational database for auth tables).
-- =============================================================================

-- PREFLIGHT: confirm tables do not yet exist.
-- Expected result: 0 rows. If you get 2 rows, migration already applied.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_mfa', 'mfa_audit_log');

-- ─── APPLY ───────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS user_mfa (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email              TEXT        NOT NULL UNIQUE,
  -- AES-256-GCM encrypted TOTP secret — format: "<hex-iv>:<hex-tag>:<hex-ct>"
  -- The plaintext is NEVER stored. Decryption requires TOTP_ENCRYPTION_KEY (Replit Secret).
  totp_secret_encrypted   TEXT,
  totp_enabled            BOOLEAN     NOT NULL DEFAULT false,
  -- SHA-256 hashes of single-use recovery codes (plaintext never stored).
  recovery_codes_hashed   TEXT[],
  -- Indices into recovery_codes_hashed that have been consumed.
  recovery_codes_used     INTEGER[]   DEFAULT '{}',
  enrolled_at             TIMESTAMPTZ,
  last_challenged_at      TIMESTAMPTZ,
  -- Replay protection: TOTP 30-second counter step of last accepted token.
  last_totp_step          BIGINT,
  failed_challenge_count  INTEGER     NOT NULL DEFAULT 0,
  -- If non-null and in the future, all challenge attempts are rejected.
  locked_until            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_email ON user_mfa(user_email);

-- Audit log for MFA lifecycle events. Retention: minimum 1 year.
CREATE TABLE IF NOT EXISTS mfa_audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email   TEXT        NOT NULL,
  -- event_type values: enroll_started, enrolled, challenged, success, failure,
  -- locked_out, recovery_used, recovery_reset, disabled, admin_reset_by:<email>
  event_type   TEXT        NOT NULL,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_audit_email   ON mfa_audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_mfa_audit_created ON mfa_audit_log(created_at);

COMMIT;

-- ─── VERIFICATION ────────────────────────────────────────────────────────────
-- Expected: 2 rows (user_mfa, mfa_audit_log)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_mfa', 'mfa_audit_log');

-- Expected: confirm last_totp_step column present
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_mfa'
  AND column_name IN ('totp_secret_encrypted', 'last_totp_step', 'locked_until');

-- ─── ROLLBACK (if needed before any data is written) ─────────────────────────
-- DROP TABLE IF EXISTS mfa_audit_log;
-- DROP TABLE IF EXISTS user_mfa;
