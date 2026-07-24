-- ============================================================
-- plaid_001_bank_integration.sql
-- DATABASE_URL ONLY — never CORE_DATABASE_URL
--
-- Migration: Plaid bank integration — Phase 1
-- Creates four tables:
--   plaid_items          — one row per connected bank institution
--   plaid_accounts       — one row per bank account within an item
--   bank_transactions    — Plaid-synced transactions
--   plaid_webhook_events — raw webhook payloads for audit/replay
--
-- PREFLIGHT CHECK:
--   Run this on DATABASE_URL (heliumdb), NOT CORE_DATABASE_URL.
--   Verify you are connected to the operational database:
--     SELECT current_database();
--   Expected result: heliumdb (or the Replit DB name), NOT "neon" / "core".
--
-- APPLY:
--   Paste into Supabase SQL Editor (or psql -d $DATABASE_URL -f this file).
--   All statements are CREATE TABLE IF NOT EXISTS — safe to run again.
--   There are NO DROP statements in this file.
--
-- ROLLBACK (manual, irreversible — coordinate with team before running):
--   DROP TABLE IF EXISTS plaid_webhook_events;
--   DROP TABLE IF EXISTS bank_transactions;
--   DROP TABLE IF EXISTS plaid_accounts;
--   DROP TABLE IF EXISTS plaid_items;
--
-- VERIFICATION (run after applying):
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('plaid_items','plaid_accounts','bank_transactions','plaid_webhook_events')
--   ORDER BY table_name;
--   Expected: 4 rows.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- plaid_items
-- One row per bank institution connected via Plaid Link.
-- access_token_encrypted + iv + tag = AES-256-GCM ciphertext.
-- NEVER store plaintext access_token in this or any table.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plaid_items (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_slug               TEXT        NOT NULL,
  plaid_item_id             TEXT        NOT NULL UNIQUE,
  institution_id            TEXT,
  institution_name          TEXT,
  -- AES-256-GCM encrypted access token — three fields required together:
  access_token_encrypted    TEXT        NOT NULL,  -- hex-encoded ciphertext
  access_token_iv           TEXT        NOT NULL,  -- hex-encoded 12-byte IV
  access_token_tag          TEXT        NOT NULL,  -- hex-encoded 16-byte auth tag
  transactions_cursor       TEXT,                  -- Plaid /transactions/sync cursor; NULL = full sync required
  status                    TEXT        NOT NULL DEFAULT 'active',  -- active | error | needs_update | disconnected
  last_successful_sync_at   TIMESTAMPTZ,
  created_by                TEXT,                  -- user email of the person who connected
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_entity_slug
  ON plaid_items (entity_slug);

CREATE INDEX IF NOT EXISTS idx_plaid_items_status
  ON plaid_items (status);

-- ────────────────────────────────────────────────────────────
-- plaid_accounts
-- One row per bank account (checking, savings, credit, etc.)
-- returned by Plaid accountsGet for a connected item.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_item_id       TEXT        NOT NULL REFERENCES plaid_items(plaid_item_id) ON DELETE CASCADE,
  plaid_account_id    TEXT        NOT NULL UNIQUE,
  entity_slug         TEXT        NOT NULL,
  name                TEXT,
  official_name       TEXT,
  type                TEXT,       -- depository | credit | loan | investment | other
  subtype             TEXT,       -- checking | savings | credit card | etc.
  mask                TEXT,       -- last 4 digits, display only
  current_balance     NUMERIC,
  available_balance   NUMERIC,
  iso_currency_code   TEXT        NOT NULL DEFAULT 'USD',
  status              TEXT        NOT NULL DEFAULT 'active',  -- active | closed | error
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_entity_slug
  ON plaid_accounts (entity_slug);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_plaid_item_id
  ON plaid_accounts (plaid_item_id);

-- ────────────────────────────────────────────────────────────
-- bank_transactions
-- Plaid-synced bank transactions. source='plaid' always for
-- this table; future imports may use source='manual'.
-- plaid_transaction_id is the deduplication key.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_transactions (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_transaction_id        TEXT        NOT NULL UNIQUE,
  plaid_account_id            TEXT        NOT NULL,
  plaid_item_id               TEXT        NOT NULL,
  entity_slug                 TEXT        NOT NULL,
  date                        DATE        NOT NULL,
  authorized_date             DATE,
  name                        TEXT,
  merchant_name               TEXT,
  amount                      NUMERIC     NOT NULL,  -- positive = debit from account perspective
  iso_currency_code           TEXT        NOT NULL DEFAULT 'USD',
  pending                     BOOLEAN     NOT NULL DEFAULT FALSE,
  category                    JSONB,                 -- Plaid legacy category array
  personal_finance_category   JSONB,                 -- Plaid PFC object {primary, detailed, confidence_level}
  payment_channel             TEXT,                  -- online | in store | other
  raw                         JSONB,                 -- full Plaid transaction object for reference
  source                      TEXT        NOT NULL DEFAULT 'plaid',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_entity_slug
  ON bank_transactions (entity_slug);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_plaid_account_id
  ON bank_transactions (plaid_account_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_plaid_item_id
  ON bank_transactions (plaid_item_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_date
  ON bank_transactions (date DESC);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_pending
  ON bank_transactions (pending)
  WHERE pending = TRUE;

-- ────────────────────────────────────────────────────────────
-- plaid_webhook_events
-- Every incoming Plaid webhook is stored here before processing.
-- Enables audit trail and replay of failed syncs.
-- plaid_verification_present=false is not an error — webhook
-- verification is best-effort in sandbox.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plaid_webhook_events (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type                TEXT        NOT NULL,
  webhook_code                TEXT        NOT NULL,
  plaid_item_id               TEXT,
  payload                     JSONB       NOT NULL,
  plaid_verification_present  BOOLEAN     NOT NULL DEFAULT FALSE,
  processed_at                TIMESTAMPTZ,
  status                      TEXT        NOT NULL DEFAULT 'received',  -- received | processed | failed | skipped
  error_message               TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plaid_webhook_events_plaid_item_id
  ON plaid_webhook_events (plaid_item_id);

CREATE INDEX IF NOT EXISTS idx_plaid_webhook_events_status
  ON plaid_webhook_events (status)
  WHERE status IN ('received', 'failed');

CREATE INDEX IF NOT EXISTS idx_plaid_webhook_events_created_at
  ON plaid_webhook_events (created_at DESC);

-- ============================================================
-- VERIFICATION QUERY — run after applying:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'plaid_items', 'plaid_accounts',
--     'bank_transactions', 'plaid_webhook_events'
--   )
-- ORDER BY table_name;
-- ============================================================
