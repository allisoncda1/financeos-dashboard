-- Budget V1: monthly and annual budget targets per entity
-- Run via Supabase SQL Editor (not CLI)

CREATE TABLE IF NOT EXISTS budgets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id        UUID NOT NULL REFERENCES entities(id),
  period_type      TEXT NOT NULL,        -- 'month' | 'annual'
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,

  revenue_target   NUMERIC(18, 2),
  cogs_target      NUMERIC(18, 2),
  opex_target      NUMERIC(18, 2),
  net_income_target NUMERIC(18, 2),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_budgets_entity_type_start
    UNIQUE (entity_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_budgets_entity
  ON budgets (entity_id, period_type, period_start);
