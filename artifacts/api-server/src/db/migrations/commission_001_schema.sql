-- Migration: commission_001_schema
-- Creates all commission module tables for the FinanceOS Dashboard.
--
-- Target:  DATABASE_URL / heliumdb (Replit PostgreSQL) ONLY.
-- Apply:   psql "$DATABASE_URL" -f commission_001_schema.sql
-- NEVER apply via CORE_DATABASE_URL (Neon). NEVER touch QBO.
--
-- Idempotent: uses IF NOT EXISTS and ON CONFLICT DO NOTHING throughout.
-- Safe to run twice.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Representatives
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_representatives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  representative_type TEXT NOT NULL
                  CHECK (representative_type IN ('external_rep','internal_house')),
  payout_eligible BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. Customer aliases
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_customer_aliases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_name      TEXT NOT NULL,
  canonical_name  TEXT NOT NULL,
  core_customer_id UUID,
  entity_id       UUID NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (alias_name, entity_id)
);

-- ─────────────────────────────────────────────────────────────
-- 3. Attribution rules
--    match_type: exact_customer_id | customer_name_pattern
--    entity_default is intentionally NOT supported.
--    House must be attributed via an explicit client rule only.
--
--    Uniqueness design:
--      exact_customer_id rules: one rep per (entity, core_customer_id).
--        A customer ID cannot be split across two active reps.
--      customer_name_pattern rules: one rep per (entity, pattern).
--        A pattern cannot be split across two active reps.
--      representative_id is NOT in the key — if a customer moves from one
--        rep to another, create a new rule with effectiveTo on the old one.
--      Partial indexes rather than NULLS NOT DISTINCT table constraints
--        so that multiple different patterns per entity per rep are allowed.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_attribution_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID NOT NULL,
  core_customer_id  UUID,
  customer_name_pattern TEXT,
  match_type        TEXT NOT NULL
                    CHECK (match_type IN ('exact_customer_id','customer_name_pattern')),
  priority          INT NOT NULL DEFAULT 100,
  representative_id UUID NOT NULL REFERENCES commission_representatives(id),
  effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to      DATE,
  created_by        TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique indexes: one rep per entity per customer scope.
-- exact_customer_id: unique per (entity, core_customer_id) — prevents split attribution
CREATE UNIQUE INDEX IF NOT EXISTS uq_attr_exact_customer
  ON commission_attribution_rules (entity_id, core_customer_id)
  WHERE match_type = 'exact_customer_id' AND core_customer_id IS NOT NULL;

-- customer_name_pattern: unique per (entity, pattern) — prevents split attribution
CREATE UNIQUE INDEX IF NOT EXISTS uq_attr_name_pattern
  ON commission_attribution_rules (entity_id, customer_name_pattern)
  WHERE match_type = 'customer_name_pattern' AND customer_name_pattern IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_attr_entity ON commission_attribution_rules(entity_id);
CREATE INDEX IF NOT EXISTS idx_commission_attr_rep    ON commission_attribution_rules(representative_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Commission rules — versioned
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID NOT NULL,
  representative_id UUID NOT NULL REFERENCES commission_representatives(id),
  core_customer_id  UUID,
  customer_name_pattern TEXT,
  formula_type      TEXT NOT NULL
                    CHECK (formula_type IN (
                      'percentage_of_invoice',
                      'percentage_of_amount_paid',
                      'percentage_of_gross_profit',
                      'fixed_amount',
                      'manual',
                      'no_commission_house'
                    )),
  calculation_basis TEXT
                    CHECK (calculation_basis IN (
                      'invoice_amount','amount_paid','gross_profit',
                      'fixed_amount','manual_amount', NULL
                    )),
  commission_rate   NUMERIC(8,6),
  fixed_amount      NUMERIC(12,2),
  payable_trigger   TEXT NOT NULL DEFAULT 'invoice_paid'
                    CHECK (payable_trigger IN (
                      'invoice_issued','invoice_paid','payment_received','manual_approval'
                    )),
  rule_version      INT NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','superseded')),
  effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to      DATE,
  created_by        TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_entity_rep ON commission_rules(entity_id, representative_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_status     ON commission_rules(status);

-- Prevents concurrent MAX(version)+1 from producing duplicate versions for the same scope.
-- Scope = entity + rep + customer scope (NULL normalized to empty string for indexing).
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_rule_scope_version
  ON commission_rules (
    entity_id,
    representative_id,
    rule_version,
    COALESCE(core_customer_id::text, '00000000-0000-0000-0000-000000000000'),
    COALESCE(customer_name_pattern, '')
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Commission run lines
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_run_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           UUID NOT NULL,
  invoice_id          UUID NOT NULL,
  invoice_qbo_id      TEXT NOT NULL,
  invoice_doc_number  TEXT,
  invoice_date        DATE,
  customer_id         UUID,
  customer_name       TEXT,
  invoice_amount      NUMERIC(12,2),
  invoice_status      TEXT,
  representative_id   UUID REFERENCES commission_representatives(id),
  attribution_rule_id UUID REFERENCES commission_attribution_rules(id),
  attribution_match   TEXT,
  commission_rule_id  UUID REFERENCES commission_rules(id),
  formula_type        TEXT,
  calculation_basis   TEXT,
  commission_rate     NUMERIC(8,6),
  gross_profit        NUMERIC(12,2),
  expenses_amount     NUMERIC(12,2),
  commission_amount   NUMERIC(12,2),
  line_status         TEXT NOT NULL DEFAULT 'attributed'
                      CHECK (line_status IN (
                        'attributed','house_no_commission','needs_configuration',
                        'needs_review','calculated','awaiting_payment',
                        'ready_for_review','approved','locked','excluded'
                      )),
  payout_eligible     BOOLEAN NOT NULL DEFAULT false,
  exclusion_reason    TEXT,
  source_fingerprint  TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  recalculated_at     TIMESTAMPTZ,
  recalculated_by     TEXT,
  locked_at           TIMESTAMPTZ,
  locked_by           TEXT,
  approved_at         TIMESTAMPTZ,
  approved_by         TEXT
);
CREATE INDEX IF NOT EXISTS idx_commission_lines_entity    ON commission_run_lines(entity_id);
CREATE INDEX IF NOT EXISTS idx_commission_lines_rep       ON commission_run_lines(representative_id);
CREATE INDEX IF NOT EXISTS idx_commission_lines_invoice   ON commission_run_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_commission_lines_status    ON commission_run_lines(line_status);
CREATE INDEX IF NOT EXISTS idx_commission_lines_date      ON commission_run_lines(invoice_date);
CREATE INDEX IF NOT EXISTS idx_commission_lines_fp        ON commission_run_lines(source_fingerprint);

-- ─────────────────────────────────────────────────────────────
-- 6. Commission rule audit log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_rule_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID REFERENCES commission_rules(id),
  action          TEXT NOT NULL
                  CHECK (action IN ('created','superseded','deactivated','recalc_triggered')),
  performed_by    TEXT,
  reason          TEXT,
  affected_lines  INT,
  snapshot        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 7. Commission periods
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   UUID NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','under_review','approved','locked')),
  locked_at   TIMESTAMPTZ,
  locked_by   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_id, period_year, period_month)
);

-- ─────────────────────────────────────────────────────────────
-- 8. Seed: known representatives (idempotent)
-- ─────────────────────────────────────────────────────────────
INSERT INTO commission_representatives (slug, display_name, representative_type, payout_eligible, notes)
VALUES
  ('house',     'House',     'internal_house', false, 'Direct/house accounts — no external payout'),
  ('jason',     'Jason',     'external_rep',   true,  NULL),
  ('jerod',     'Jerod',     'external_rep',   true,  NULL),
  ('big_mouth', 'Big Mouth', 'external_rep',   true,  'Big Mouth entity — manages James CDJR and South Suburban accounts')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
