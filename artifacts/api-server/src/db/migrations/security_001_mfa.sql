-- MANUAL MIGRATION: security_001_mfa.sql
-- =============================================================================
-- DATABASE: The Dashboard OPERATIONAL database (DATABASE_URL / connect-pg-simple
-- session store). This is NOT the Core financial data database (CORE_DATABASE_URL).
-- Both are hosted on Neon but are separate databases with separate connection strings.
--
-- HOW TO APPLY:
--   1. Open the Neon console → select the PROJECT that contains your Dashboard
--      operational database (the one referenced by DATABASE_URL in Replit Secrets).
--   2. Open the SQL Editor for that database.
--   3. Run the PREFLIGHT query first. If it returns a row, this migration is
--      already applied — do NOT run it again.
--   4. Run the BEGIN … COMMIT block.
--   5. Run the VERIFICATION queries.
--
-- DO NOT apply this to the Core financial database.
-- DO NOT apply this automatically or via migration runners.
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
