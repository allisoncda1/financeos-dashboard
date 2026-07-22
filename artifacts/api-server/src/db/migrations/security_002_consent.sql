-- MANUAL MIGRATION: security_002_consent.sql
-- =============================================================================
-- DATABASE: DATABASE_URL — same Replit-provisioned operational database as
-- security_001_mfa.sql. See that file's header for full database ownership proof.
-- Apply via: psql $DATABASE_URL -f security_002_consent.sql  (in Replit Shell)
-- Prerequisite: security_001_mfa.sql must be applied first.
-- NOT CORE_DATABASE_URL. These tables do not belong in the financial database.
-- =============================================================================
-- PREFLIGHT: expected 0 rows if migration not yet applied.
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema='public' AND table_name IN
--   ('plaid_consent_records','plaid_connections','data_deletion_requests');

BEGIN;

-- Consent records: explicit user consent before Plaid Link is displayed
CREATE TABLE IF NOT EXISTS plaid_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  entity_id UUID NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ,
  policy_version TEXT NOT NULL,          -- e.g. "privacy-v1.0"
  consent_text_hash TEXT NOT NULL,       -- SHA-256 of the consent text shown
  scope_requested TEXT[] NOT NULL,       -- e.g. ['transactions','identity']
  plaid_products TEXT[] NOT NULL,        -- e.g. ['auth','transactions']
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_consent_entity ON plaid_consent_records(entity_id);
CREATE INDEX IF NOT EXISTS idx_consent_user ON plaid_consent_records(user_email);

-- Plaid bank connections (access token encrypted, never plaintext)
CREATE TABLE IF NOT EXISTS plaid_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  institution_name TEXT,
  institution_id TEXT,
  access_token_encrypted TEXT NOT NULL,  -- AES-256-GCM encrypted Plaid access token
  item_id TEXT NOT NULL UNIQUE,
  consent_record_id UUID REFERENCES plaid_consent_records(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',  -- active | disconnected | error
  last_synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plaid_conn_entity ON plaid_connections(entity_id);

-- Deletion request log (GDPR/CCPA-style, for financial data subjects)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by TEXT NOT NULL,            -- user_email of requester
  entity_id UUID,
  request_type TEXT NOT NULL,            -- 'plaid_disconnect' | 'full_deletion' | 'data_export'
  status TEXT NOT NULL DEFAULT 'pending', -- pending | in_progress | completed | on_hold
  legal_hold BOOLEAN NOT NULL DEFAULT false,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

COMMIT;

-- ROLLBACK:
-- DROP TABLE IF EXISTS data_deletion_requests;
-- DROP TABLE IF EXISTS plaid_connections;
-- DROP TABLE IF EXISTS plaid_consent_records;

-- VERIFICATION:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('plaid_consent_records','plaid_connections','data_deletion_requests');
-- Expected: 3 rows
