-- MANUAL MIGRATION: security_001_mfa.sql
-- DO NOT APPLY AUTOMATICALLY. Run via Neon SQL Editor after approval.
-- Preflight: SELECT COUNT(*) FROM information_schema.columns WHERE table_name='user_mfa' LIMIT 1;
-- Expected: 0 rows (table does not yet exist)

BEGIN;

CREATE TABLE IF NOT EXISTS user_mfa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE,
  totp_secret_encrypted TEXT,           -- AES-256-GCM encrypted TOTP secret
  totp_enabled BOOLEAN NOT NULL DEFAULT false,
  recovery_codes_hashed TEXT[],         -- SHA-256 hashes of recovery codes
  recovery_codes_used INTEGER[] DEFAULT '{}',
  enrolled_at TIMESTAMPTZ,
  last_challenged_at TIMESTAMPTZ,
  failed_challenge_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_email ON user_mfa(user_email);

-- Audit log for MFA events
CREATE TABLE IF NOT EXISTS mfa_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'enrolled','challenged','success','failure','reset','recovery_used'
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_audit_email ON mfa_audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_mfa_audit_created ON mfa_audit_log(created_at);

COMMIT;

-- ROLLBACK (if needed):
-- DROP TABLE IF EXISTS mfa_audit_log;
-- DROP TABLE IF EXISTS user_mfa;

-- VERIFICATION:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('user_mfa','mfa_audit_log');
-- Expected: 2 rows
