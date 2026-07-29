-- Migration: commission_001_schema
-- Creates all commission module tables for the FinanceOS Dashboard.
--
-- Target:  DATABASE_URL / heliumdb (Replit PostgreSQL) ONLY.
-- Apply:   psql "$DATABASE_URL" -f artifacts/api-server/src/db/migrations/commission_001_schema.sql
-- NEVER apply via CORE_DATABASE_URL (Neon). NEVER touch QBO.
--
-- Idempotent: uses IF NOT EXISTS throughout.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Representatives
--    The canonical list of commission recipients + House.
--    representative_type: external_rep | internal_house
--    payout_eligible:     false for House, true for external reps
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_representatives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,      -- jason | jerod | big_mouth | house
  display_name    TEXT NOT NULL,             -- Jason | Jerod | Big Mouth | House
  representative_type TEXT NOT NULL          -- external_rep | internal_house
                  CHECK (representative_type IN ('external_rep','internal_house')),
  payout_eligible BOOLEAN NOT NULL DEFAULT false,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 2. Customer aliases
--    Maps Excel / QBO client name variants to a canonical
--    customer_id (from Neon Core) and a canonical_name.
--    Resolution: exact match → fuzzy → needs_review.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_customer_aliases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_name      TEXT NOT NULL,             -- raw name as seen in source data
  canonical_name  TEXT NOT NULL,             -- normalised display name
  core_customer_id UUID,                     -- entity-scoped UUID from Neon Core customers table (nullable until resolved)
  entity_id       UUID NOT NULL,             -- which FinanceOS entity this alias belongs to
  source          TEXT NOT NULL DEFAULT 'manual', -- manual | excel_import | neon_sync
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (alias_name, entity_id)
);

-- ─────────────────────────────────────────────────────────────
-- 3. Attribution rules
--    entity_id + customer fingerprint → representative
--    match_type: exact_customer_id | customer_name_pattern | entity_default
--    priority: lower number = higher priority
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_attribution_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID NOT NULL,
  -- match criteria (at least one must be set)
  core_customer_id  UUID,                    -- preferred: match by resolved customer UUID
  customer_name_pattern TEXT,                -- fallback: ILIKE match against customer_name
  match_type        TEXT NOT NULL            -- exact_customer_id | customer_name_pattern | entity_default
                    CHECK (match_type IN ('exact_customer_id','customer_name_pattern','entity_default')),
  priority          INT NOT NULL DEFAULT 100,
  representative_id UUID NOT NULL REFERENCES commission_representatives(id),
  effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to      DATE,                    -- null = no expiry
  created_by        TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_attr_entity ON commission_attribution_rules(entity_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Commission rules
--    Per-rule calculation configuration, versioned.
--    One rule per (entity, representative, customer scope, period).
--    formula_type: percentage_of_invoice | percentage_of_amount_paid |
--                  percentage_of_gross_profit | fixed_amount | manual |
--                  no_commission_house
--    calculation_basis: invoice_amount | amount_paid | gross_profit |
--                       fixed_amount | manual_amount
--    payable_trigger:   invoice_issued | invoice_paid | payment_received |
--                       manual_approval
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID NOT NULL,
  representative_id UUID NOT NULL REFERENCES commission_representatives(id),
  -- optional scope narrowing (null = applies to all customers of this rep in this entity)
  core_customer_id  UUID,
  customer_name_pattern TEXT,
  -- formula
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
  commission_rate   NUMERIC(8,6),            -- e.g. 0.200000 = 20%; null for manual/fixed
  fixed_amount      NUMERIC(12,2),           -- for fixed_amount formula only
  payable_trigger   TEXT NOT NULL DEFAULT 'invoice_paid'
                    CHECK (payable_trigger IN (
                      'invoice_issued','invoice_paid','payment_received','manual_approval'
                    )),
  -- versioning
  rule_version      INT NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','superseded')),
  effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to      DATE,
  -- audit
  created_by        TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_rules_entity_rep ON commission_rules(entity_id, representative_id);

-- ─────────────────────────────────────────────────────────────
-- 5. Commission run lines
--    One row per (invoice, attribution_rule) pair.
--    Idempotent: source_fingerprint prevents duplicates.
--    source_fingerprint = sha256(entity_id || ':' || invoice_qbo_id)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_run_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- source provenance
  entity_id           UUID NOT NULL,
  invoice_id          UUID NOT NULL,          -- Neon Core invoices.id
  invoice_qbo_id      TEXT NOT NULL,          -- QBO invoice ID
  invoice_doc_number  TEXT,
  invoice_date        DATE,
  customer_id         UUID,                   -- Neon Core customers.id (nullable until resolved)
  customer_name       TEXT,
  invoice_amount      NUMERIC(12,2),
  invoice_status      TEXT,                   -- Open | Paid | Overdue | Draft
  -- attribution
  representative_id   UUID REFERENCES commission_representatives(id),
  attribution_rule_id UUID REFERENCES commission_attribution_rules(id),
  attribution_match   TEXT,                   -- exact_customer_id | customer_name_pattern | entity_default | no_match
  -- commission calculation
  commission_rule_id  UUID REFERENCES commission_rules(id),
  formula_type        TEXT,
  calculation_basis   TEXT,
  commission_rate     NUMERIC(8,6),
  gross_profit        NUMERIC(12,2),          -- null if not available
  expenses_amount     NUMERIC(12,2),          -- null if not available
  commission_amount   NUMERIC(12,2),          -- null until calculated
  -- status
  line_status         TEXT NOT NULL DEFAULT 'attributed'
                      CHECK (line_status IN (
                        'attributed',
                        'house_no_commission',
                        'needs_configuration',
                        'needs_review',
                        'calculated',
                        'awaiting_payment',
                        'ready_for_review',
                        'approved',
                        'locked',
                        'excluded'
                      )),
  payout_eligible     BOOLEAN NOT NULL DEFAULT false,
  exclusion_reason    TEXT,                   -- internal_house_account | missing_commission_formula | missing_gross_profit | etc.
  -- idempotency
  source_fingerprint  TEXT NOT NULL UNIQUE,   -- prevents duplicate import
  -- audit
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

-- ─────────────────────────────────────────────────────────────
-- 6. Commission rule audit log
--    Records every rule activation / deactivation / recalc.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_rule_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID REFERENCES commission_rules(id),
  action          TEXT NOT NULL,             -- created | activated | deactivated | superseded | recalc_triggered
  performed_by    TEXT,
  reason          TEXT,
  affected_lines  INT,
  snapshot        JSONB,                     -- full rule snapshot at time of action
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 7. Commission periods
--    Month-level locks. A locked period cannot be recalculated.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   UUID NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','under_review','locked')),
  locked_at   TIMESTAMPTZ,
  locked_by   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_id, period_year, period_month)
);

-- ─────────────────────────────────────────────────────────────
-- 8. Seed: known representatives
-- ─────────────────────────────────────────────────────────────
INSERT INTO commission_representatives (slug, display_name, representative_type, payout_eligible, notes)
VALUES
  ('house',     'House',     'internal_house', false, 'Direct/house accounts — no external payout'),
  ('jason',     'Jason',     'external_rep',   true,  NULL),
  ('jerod',     'Jerod',     'external_rep',   true,  NULL),
  ('big_mouth', 'Big Mouth', 'external_rep',   true,  'Big Mouth entity — manages James CDJR and South Suburban accounts')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
