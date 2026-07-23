-- =============================================================================
-- Migration: security_003_user_invitations.sql
-- Target DB:  DATABASE_URL  (operational PostgreSQL — NOT CORE_DATABASE_URL)
-- Purpose:    Invite-only user access — app_users, user_invitations, user_audit_log
--
-- Preflight check:
--   SELECT current_database(), current_user;
--   -- must NOT be the Neon Core database (financeos_core / financeos_dashboard role)
--
-- Apply via Supabase SQL Editor or psql pointed at DATABASE_URL:
--   psql $DATABASE_URL -f security_003_user_invitations.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- app_users: DB-resident users created via invitation (not env-var accounts)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  role            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,         -- bcrypt $2b$ only; no plaintext ever stored
  status          TEXT NOT NULL DEFAULT 'active',  -- active | disabled
  mfa_required    BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_complete    BOOLEAN NOT NULL DEFAULT FALSE,   -- set true after first successful TOTP enrollment
  invited_by      TEXT NOT NULL,         -- email of the inviting user
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);

COMMENT ON TABLE  app_users IS 'Invited users with DB-stored credentials. Env-var admin is separate.';
COMMENT ON COLUMN app_users.password_hash IS 'bcrypt hash, cost ≥12. Plaintext passwords MUST NOT be stored here.';
COMMENT ON COLUMN app_users.mfa_complete  IS 'Flipped to true when the user completes first-time TOTP enrollment.';

-- ---------------------------------------------------------------------------
-- user_invitations: pending invites; token_hash is SHA-256 of the raw token
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,    -- SHA-256 hex; raw token is never stored
  invited_by    TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  user_invitations IS 'Pending (and historical) invitations. token_hash = SHA-256(raw_token).';
COMMENT ON COLUMN user_invitations.token_hash IS 'SHA-256 hex digest of the raw invite token; raw token is never persisted.';

CREATE INDEX IF NOT EXISTS idx_user_invitations_token_hash ON user_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email      ON user_invitations (email);

-- ---------------------------------------------------------------------------
-- user_audit_log: immutable event log for invite and user lifecycle events
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email   TEXT NOT NULL,
  action        TEXT NOT NULL,   -- invite_created | invite_accepted | invite_revoked
                                 -- user_disabled  | role_changed
  target_email  TEXT NOT NULL,
  details       JSONB,           -- non-secret context (role, invitation id, etc.)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_audit_log_target_email ON user_audit_log (target_email);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_actor_email  ON user_audit_log (actor_email);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_action       ON user_audit_log (action);

COMMIT;
