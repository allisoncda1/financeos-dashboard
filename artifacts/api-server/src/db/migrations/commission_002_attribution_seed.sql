-- Migration: commission_002_attribution_seed
-- Seeds known attribution rules derived from the Excel audit (Nov 2025 – Jun 2026).
-- All rules use customer_name_pattern matching because core_customer_id resolution
-- requires a live Neon query that cannot run inside a migration.
--
-- Target:  DATABASE_URL / heliumdb (Replit PostgreSQL) ONLY.
-- Apply AFTER commission_001_schema.sql.
-- Apply:   psql "$DATABASE_URL" -f artifacts/api-server/src/db/migrations/commission_002_attribution_seed.sql
--
-- IMPORTANT: These patterns are sourced from the Commission Sheet (3).xlsx audit.
-- No commission rates are seeded here — rates are not confirmed.
-- All commission_rules are intentionally absent from this file.
-- Commission calculations will show needs_configuration until rules are added via UI.
--
-- Entity UUIDs (FinanceOS Core, confirmed):
--   cardealer_ai  = b86bb66e-df81-4d32-8629-3012635ba16a
--   t3_marketing  = c2cf72b0-d77d-42de-a588-98092d9441df
--   topmrktr      = 28775e76-4e8f-49cd-84e8-d2de4b4491a9
--   smile_more    = 0bea3469-8fb5-460d-8bd9-7471e242a8c8

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Car Dealer AI (b86bb66e-df81-4d32-8629-3012635ba16a)
-- ─────────────────────────────────────────────────────────────

-- Jerod: Metro Honda + Honda of Toms River (confirmed Nov 2025 – Jun 2026)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'b86bb66e-df81-4d32-8629-3012635ba16a',
  'Metro Honda',
  'customer_name_pattern',
  10,
  id,
  '2025-11-01',
  'Confirmed from Excel audit: Jerod on all Metro Honda invoices (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'jerod'
ON CONFLICT DO NOTHING;

INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'b86bb66e-df81-4d32-8629-3012635ba16a',
  'Honda of Toms River',
  'customer_name_pattern',
  10,
  id,
  '2025-11-01',
  'Confirmed from Excel audit: Jerod on all Honda of Toms River invoices (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'jerod'
ON CONFLICT DO NOTHING;

-- Jason: Big Mouth Advertising (CarDealer.ai client — Jason as rep confirmed May–Jun 2026)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'b86bb66e-df81-4d32-8629-3012635ba16a',
  'Big Mouth Advertising',
  'customer_name_pattern',
  10,
  id,
  '2026-05-01',
  'Confirmed from Excel audit: Jason on Big Mouth Advertising invoices (CarDealer.ai, May–Jun 2026)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Mazda Of Columbia (CarDealer.ai, Feb 2026)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'b86bb66e-df81-4d32-8629-3012635ba16a',
  'Mazda%Columbia',
  'customer_name_pattern',
  10,
  id,
  '2026-02-01',
  'Confirmed from Excel audit: Jason on Mazda of Columbia (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Big Mouth: James CDJR accounts (CarDealer.ai, May 2026)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'b86bb66e-df81-4d32-8629-3012635ba16a',
  'James%Chrysler%Cedar Lake',
  'customer_name_pattern',
  10,
  id,
  '2026-05-01',
  'Confirmed from Excel audit: Big Mouth on James CDJR Cedar Lake (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'b86bb66e-df81-4d32-8629-3012635ba16a',
  'James%Chrysler%Hampshire',
  'customer_name_pattern',
  10,
  id,
  '2026-05-01',
  'Confirmed from Excel audit: Big Mouth on James CDJR Hampshire (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

-- House: entity default for CarDealer.ai (lowest priority)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'b86bb66e-df81-4d32-8629-3012635ba16a',
  NULL,
  'entity_default',
  9999,
  id,
  '2025-11-01',
  'Fallback House attribution for all unmatched CarDealer.ai invoices'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- T3 Marketing (c2cf72b0-d77d-42de-a588-98092d9441df)
-- ─────────────────────────────────────────────────────────────

-- Big Mouth: James CDJR (T3 Marketing, Apr 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'c2cf72b0-d77d-42de-a588-98092d9441df',
  'James CDJR%',
  'customer_name_pattern',
  10,
  id,
  '2026-04-01',
  'Confirmed from Excel audit: Big Mouth on James CDJR accounts (T3 Marketing)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

-- Big Mouth: South Suburban Mitsubishi (T3 Marketing, Apr 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'c2cf72b0-d77d-42de-a588-98092d9441df',
  'South Suburban Mitsubishi',
  'customer_name_pattern',
  10,
  id,
  '2026-04-01',
  'Confirmed from Excel audit: Big Mouth on South Suburban Mitsubishi (T3 Marketing)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

-- Jason: Cargill Chevrolet (T3 Marketing, Jun 2026)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'c2cf72b0-d77d-42de-a588-98092d9441df',
  'Cargill Chevrolet',
  'customer_name_pattern',
  10,
  id,
  '2026-06-01',
  'Confirmed from Excel audit: Jason on Cargill Chevrolet (T3 Marketing, Jun 2026)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Mazda of Columbia (T3 Marketing, Dec 2025 confirmed from 2025 sheet)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'c2cf72b0-d77d-42de-a588-98092d9441df',
  'Mazda%Columbia',
  'customer_name_pattern',
  10,
  id,
  '2025-12-01',
  'Confirmed from Excel audit: Jason on Mazda of Columbia (T3 Marketing, Dec 2025)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- House: entity default for T3 Marketing
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  'c2cf72b0-d77d-42de-a588-98092d9441df',
  NULL,
  'entity_default',
  9999,
  id,
  '2025-11-01',
  'Fallback House attribution for all unmatched T3 Marketing invoices'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Top Mktr (28775e76-4e8f-49cd-84e8-d2de4b4491a9)
-- ─────────────────────────────────────────────────────────────

-- Jason: Foray Insure (all months confirmed)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  '28775e76-4e8f-49cd-84e8-d2de4b4491a9',
  'Foray%',
  'customer_name_pattern',
  10,
  id,
  '2025-11-01',
  'Confirmed from Excel audit: Jason on Foray Insure (Top Mktr, consistent all months)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Incarnation Specialties (all months confirmed)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  '28775e76-4e8f-49cd-84e8-d2de4b4491a9',
  'Incarnation Specialist%',
  'customer_name_pattern',
  10,
  id,
  '2025-11-01',
  'Confirmed from Excel audit: Jason on Incarnation Specialties (Top Mktr, consistent all months)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: TAG Reserve Spirits (all months confirmed)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  '28775e76-4e8f-49cd-84e8-d2de4b4491a9',
  'TAG Reserve%',
  'customer_name_pattern',
  10,
  id,
  '2025-11-01',
  'Confirmed from Excel audit: Jason on TAG Reserve Spirits (Top Mktr, consistent all months)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Precision Roofing (Top Mktr, Apr 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  '28775e76-4e8f-49cd-84e8-d2de4b4491a9',
  'Precision Roofing',
  'customer_name_pattern',
  10,
  id,
  '2026-04-01',
  'Confirmed from Excel audit: Jason on Precision Roofing (Top Mktr, Apr 2026+)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Castle Hyundai of Oak Lawn (Top Mktr, Nov 2025)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  '28775e76-4e8f-49cd-84e8-d2de4b4491a9',
  'Castle Hyundai%',
  'customer_name_pattern',
  10,
  id,
  '2025-11-01',
  'Confirmed from Excel audit: Jason on Castle Hyundai (Top Mktr, Nov 2025)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Mazda of Columbia (Top Mktr, Dec 2025)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  '28775e76-4e8f-49cd-84e8-d2de4b4491a9',
  'Mazda%Columbia',
  'customer_name_pattern',
  10,
  id,
  '2025-12-01',
  'Confirmed from Excel audit: Jason on Mazda of Columbia (Top Mktr, Dec 2025)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- House: entity default for Top Mktr
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  '28775e76-4e8f-49cd-84e8-d2de4b4491a9',
  NULL,
  'entity_default',
  9999,
  id,
  '2025-11-01',
  'Fallback House attribution for all unmatched Top Mktr invoices'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Smile More (0bea3469-8fb5-460d-8bd9-7471e242a8c8)
-- ─────────────────────────────────────────────────────────────
-- House: entity default (no non-House invoices observed in Excel)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT
  '0bea3469-8fb5-460d-8bd9-7471e242a8c8',
  NULL,
  'entity_default',
  9999,
  id,
  '2025-11-01',
  'Fallback House attribution for all Smile More invoices'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

COMMIT;
