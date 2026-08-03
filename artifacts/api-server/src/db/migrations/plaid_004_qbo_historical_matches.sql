-- plaid_004_qbo_historical_matches.sql
--
-- Historical Plaid-to-QBO matching and exact QBO allocation lines.
-- Apply to DATABASE_URL only.
--
-- This migration:
--   - does not modify Plaid source transactions;
--   - does not modify QuickBooks/Core data;
--   - does not create reconciliation records;
--   - preserves QBO account and class names exactly;
--   - supports split transactions;
--   - keeps manual categorization authoritative.

CREATE TABLE IF NOT EXISTS bank_transaction_qbo_matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_transaction_id  TEXT NOT NULL,
  entity_slug           TEXT NOT NULL,
  qbo_id                 TEXT NOT NULL,
  qbo_object_type        TEXT NOT NULL,
  match_method           TEXT NOT NULL,
  date_delta_days        INTEGER NOT NULL,
  confidence             NUMERIC(5,4) NOT NULL,
  review_status          TEXT NOT NULL DEFAULT 'matched',
  source                 TEXT NOT NULL DEFAULT 'qbo_history',
  imported_by            TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bank_transaction_qbo_matches_unique
    UNIQUE (plaid_transaction_id, entity_slug),

  CONSTRAINT bank_transaction_qbo_matches_review_status_check
    CHECK (
      review_status IN (
        'matched',
        'needs_review',
        'approved',
        'rejected'
      )
    ),

  CONSTRAINT bank_transaction_qbo_matches_confidence_check
    CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE IF NOT EXISTS bank_transaction_qbo_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID NOT NULL
                    REFERENCES bank_transaction_qbo_matches(id)
                    ON DELETE CASCADE,
  line_index        INTEGER NOT NULL,
  coa_account_id    TEXT,
  coa_account_name  TEXT,
  coa_account_type  TEXT,
  qbo_class_id      TEXT,
  qbo_class_name    TEXT,
  line_amount       NUMERIC,
  memo              TEXT,
  raw_line          JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bank_transaction_qbo_lines_unique
    UNIQUE (match_id, line_index),

  CONSTRAINT bank_transaction_qbo_lines_index_check
    CHECK (line_index >= 0)
);

CREATE INDEX IF NOT EXISTS idx_btqm_entity_status
  ON bank_transaction_qbo_matches (entity_slug, review_status);

CREATE INDEX IF NOT EXISTS idx_btqm_qbo_object
  ON bank_transaction_qbo_matches (
    entity_slug,
    qbo_object_type,
    qbo_id
  );

CREATE INDEX IF NOT EXISTS idx_btql_match_id
  ON bank_transaction_qbo_lines (match_id);

CREATE INDEX IF NOT EXISTS idx_btql_account
  ON bank_transaction_qbo_lines (coa_account_id);

CREATE INDEX IF NOT EXISTS idx_btql_class
  ON bank_transaction_qbo_lines (qbo_class_id);
