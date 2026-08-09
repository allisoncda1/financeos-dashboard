-- =============================================================================
-- Migration: security_004_password_reset.sql
-- Target DB:  DATABASE_URL  (operational PostgreSQL — NOT CORE_DATABASE_URL)
-- Purpose:    Forgot-password flow — single-use, expiring reset tokens.
--
-- Apply via:
--   psql $DATABASE_URL -f security_004_password_reset.sql
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 hex of the raw token; raw token is never stored
  expires_at  TIMESTAMPTZ NOT NULL,   -- 1 hour after creation
  used_at     TIMESTAMPTZ,            -- set on first successful reset; single-use
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens (email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens (expires_at);

COMMENT ON TABLE password_reset_tokens IS 'Single-use password reset tokens for app_users. Raw tokens are never stored.';

COMMIT;
