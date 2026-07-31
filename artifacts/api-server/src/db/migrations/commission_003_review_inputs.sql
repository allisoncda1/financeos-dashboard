-- Migration: commission_003_review_inputs
-- Target: COMMISSION_DATABASE_URL (Replit PostgreSQL) ONLY.
-- DO NOT apply via CORE_DATABASE_URL (Neon). DO NOT execute via CLI.
--
-- Verify before applying:
--   SELECT current_database(), current_user;
--   SELECT COUNT(*) FROM commission_run_lines;
--
-- Apply via SQL editor connected to COMMISSION_DATABASE_URL only.

BEGIN;

-- 1. Add review-input tracking columns to commission_run_lines
ALTER TABLE commission_run_lines
  ADD COLUMN IF NOT EXISTS expenses_explicitly_set BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_updated_by       TEXT,
  ADD COLUMN IF NOT EXISTS review_updated_at       TIMESTAMPTZ;

-- 2. Back-fill: mark rows where expenses_amount was already set
UPDATE commission_run_lines
SET expenses_explicitly_set = true
WHERE expenses_amount IS NOT NULL
  AND expenses_explicitly_set = false;

-- 3. Extend formula_type CHECK to include percentage_of_adjusted_gp
--    Drop both possible constraint names safely before re-adding.
ALTER TABLE commission_rules
  DROP CONSTRAINT IF EXISTS commission_rules_formula_type_check,
  DROP CONSTRAINT IF EXISTS commission_rules_formula_type_check_v2;

ALTER TABLE commission_rules
  ADD CONSTRAINT commission_rules_formula_type_check_v2
    CHECK (formula_type IN (
      'percentage_of_invoice',
      'percentage_of_amount_paid',
      'percentage_of_gross_profit',
      'fixed_amount',
      'manual',
      'no_commission_house',
      'percentage_of_adjusted_gp'
    ));

-- 4. Extend calculation_basis CHECK to include adjusted_gp
ALTER TABLE commission_rules
  DROP CONSTRAINT IF EXISTS commission_rules_calculation_basis_check,
  DROP CONSTRAINT IF EXISTS commission_rules_calculation_basis_check_v2;

ALTER TABLE commission_rules
  ADD CONSTRAINT commission_rules_calculation_basis_check_v2
    CHECK (calculation_basis IN (
      'invoice_amount', 'amount_paid', 'gross_profit',
      'fixed_amount', 'manual_amount', 'adjusted_gp'
    ) OR calculation_basis IS NULL);

COMMIT;
