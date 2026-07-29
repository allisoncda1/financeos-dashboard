-- Migration: commission_002_attribution_seed
-- Seeds known attribution rules from the Excel audit (Nov 2025 – Jun 2026).
--
-- Target:  DATABASE_URL / heliumdb ONLY. Apply AFTER commission_001_schema.sql.
--
-- IMPORTANT:
--   - No entity_default rules. House is attributed by explicit client rule only.
--   - No commission rates seeded — rates not confirmed.
--   - Idempotent: safe to run twice (ON CONFLICT DO NOTHING).
--
-- Entity UUIDs (FinanceOS Core, confirmed):
--   cardealer_ai  = b86bb66e-df81-4d32-8629-3012635ba16a
--   t3_marketing  = c2cf72b0-d77d-42de-a588-98092d9441df
--   topmrktr      = 28775e76-4e8f-49cd-84e8-d2de4b4491a9
--   smile_more    = 0bea3469-8fb5-460d-8bd9-7471e242a8c8
--
-- Double-execution test: running this file twice produces the same row count.
-- Verify with: SELECT COUNT(*) FROM commission_attribution_rules;
-- Expected after first run: 17 rows. Second run: 17 rows (unchanged).

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Car Dealer AI (b86bb66e-df81-4d32-8629-3012635ba16a)
-- ─────────────────────────────────────────────────────────────

-- Jerod: Metro Honda
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Metro Honda', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jerod on Metro Honda (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'jerod'
ON CONFLICT DO NOTHING;

-- Jerod: Honda of Toms River
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Honda of Toms River', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jerod on Honda of Toms River (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'jerod'
ON CONFLICT DO NOTHING;

-- Jason: Big Mouth Advertising (May 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Big Mouth Advertising', 'customer_name_pattern', 10,
       id, '2026-05-01', 'Confirmed: Jason on Big Mouth Advertising (CarDealer.ai, May 2026+)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Mazda of Columbia (Feb 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Mazda%Columbia', 'customer_name_pattern', 10,
       id, '2026-02-01', 'Confirmed: Jason on Mazda of Columbia (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Big Mouth: James CDJR Cedar Lake (May 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'James%Chrysler%Cedar Lake', 'customer_name_pattern', 10,
       id, '2026-05-01', 'Confirmed: Big Mouth on James CDJR Cedar Lake (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

-- Big Mouth: James CDJR Hampshire (May 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'James%Chrysler%Hampshire', 'customer_name_pattern', 10,
       id, '2026-05-01', 'Confirmed: Big Mouth on James CDJR Hampshire (CarDealer.ai)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- T3 Marketing (c2cf72b0-d77d-42de-a588-98092d9441df)
-- ─────────────────────────────────────────────────────────────

-- Big Mouth: James CDJR (Apr 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'James CDJR%', 'customer_name_pattern', 10,
       id, '2026-04-01', 'Confirmed: Big Mouth on James CDJR accounts (T3 Marketing)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

-- Big Mouth: South Suburban Mitsubishi (Apr 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'South Suburban Mitsubishi', 'customer_name_pattern', 10,
       id, '2026-04-01', 'Confirmed: Big Mouth on South Suburban Mitsubishi (T3 Marketing)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

-- Jason: Cargill Chevrolet (Jun 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'Cargill Chevrolet', 'customer_name_pattern', 10,
       id, '2026-06-01', 'Confirmed: Jason on Cargill Chevrolet (T3 Marketing, Jun 2026)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Mazda of Columbia (Dec 2025+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'Mazda%Columbia', 'customer_name_pattern', 10,
       id, '2025-12-01', 'Confirmed: Jason on Mazda of Columbia (T3 Marketing, Dec 2025)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Top Mktr (28775e76-4e8f-49cd-84e8-d2de4b4491a9)
-- ─────────────────────────────────────────────────────────────

-- Jason: Foray Insure (all months)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Foray%', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jason on Foray Insure (Top Mktr, all months)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Incarnation Specialties (all months)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Incarnation Specialist%', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jason on Incarnation Specialties (Top Mktr, all months)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: TAG Reserve Spirits (all months)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'TAG Reserve%', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jason on TAG Reserve Spirits (Top Mktr, all months)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Precision Roofing (Apr 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Precision Roofing', 'customer_name_pattern', 10,
       id, '2026-04-01', 'Confirmed: Jason on Precision Roofing (Top Mktr, Apr 2026+)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Castle Hyundai (Nov 2025+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Castle Hyundai%', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jason on Castle Hyundai (Top Mktr, Nov 2025+)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Mazda of Columbia (Dec 2025+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Mazda%Columbia', 'customer_name_pattern', 10,
       id, '2025-12-01', 'Confirmed: Jason on Mazda of Columbia (Top Mktr, Dec 2025+)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Smile More (0bea3469-8fb5-460d-8bd9-7471e242a8c8)
-- ─────────────────────────────────────────────────────────────
-- NOTE: No confirmed attribution rules from Excel audit for Smile More.
-- All Smile More invoices observed were house accounts but specific
-- customer names were not confirmed. Add explicit rules via UI once confirmed.
-- Invoices without a rule will appear as needs_review until rules are set.

COMMIT;
