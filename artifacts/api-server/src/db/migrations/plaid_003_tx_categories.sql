-- plaid_003_tx_categories.sql
--
-- FinanceOS categorization metadata for bank transactions.
--
-- INVARIANTS:
--   - Never modifies bank_transactions (Plaid source data).
--   - Scoped by entity_slug, consistent with bank_transactions.entity_slug.
--   - One FinanceOS category per (plaid_transaction_id, entity_slug).
--   - coa_* fields are denormalized from Core DB (read-only; no cross-DB FK).
--   - reconciliation_status is intentionally absent; categorized ≠ reconciled.
--
-- Apply to: DATABASE_URL (heliumdb) only.

CREATE TABLE IF NOT EXISTS bank_transaction_categories (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_transaction_id TEXT        NOT NULL,
  entity_slug          TEXT        NOT NULL,
  coa_account_id       TEXT        NOT NULL,
  coa_account_name     TEXT,
  coa_account_type     TEXT,
  categorized_by       TEXT        NOT NULL,
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bank_transaction_categories_uniq
    UNIQUE (plaid_transaction_id, entity_slug)
);

CREATE INDEX IF NOT EXISTS idx_btc_entity_slug
  ON bank_transaction_categories (entity_slug);

CREATE INDEX IF NOT EXISTS idx_btc_plaid_transaction_id
  ON bank_transaction_categories (plaid_transaction_id);

CREATE INDEX IF NOT EXISTS idx_btc_entity_coa
  ON bank_transaction_categories (entity_slug, coa_account_id);
