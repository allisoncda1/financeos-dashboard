-- Migration: commission_002_attribution_seed
-- Seeds known attribution rules from the Excel audit (Nov 2025 – Jun 2026).
--
-- Target:  DATABASE_URL / heliumdb ONLY. Apply AFTER commission_001_schema.sql.
--
-- IMPORTANT:
--   - No entity_default rules. House is attributed by explicit client rule only.
--   - No commission rates seeded — rates not confirmed.
--   - Idempotent: safe to run twice (ON CONFLICT DO NOTHING on the partial unique indexes
--     that enforce one rep per entity per customer scope).
--   - Single-sighting candidates (Mazda of Columbia, Cargill Chevrolet, Castle Hyundai,
--     Precision Roofing) are NOT seeded as active rules; they will appear as needs_review
--     until confirmed via the rule UI.
--
-- Entity UUIDs (FinanceOS Core, confirmed):
--   cardealer_ai  = b86bb66e-df81-4d32-8629-3012635ba16a
--   t3_marketing  = c2cf72b0-d77d-42de-a588-98092d9441df
--   topmrktr      = 28775e76-4e8f-49cd-84e8-d2de4b4491a9
--   smile_more    = 0bea3469-8fb5-460d-8bd9-7471e242a8c8
--
-- Customer ID resolution: core_customer_id is NOT available without a QBO customer join.
-- All rules use customer_name_pattern (match_type = 'customer_name_pattern').
-- Exact UUIDs can be added via UI once the customer join is available.
--
-- Double-execution test: running this file twice produces the same row count.
-- Verify with: SELECT COUNT(*) FROM commission_attribution_rules;
-- Expected after first run: 31 rows. Second run: 31 rows (unchanged).
-- Note: idempotence is theoretical — SQL not yet executed on a temp DB (PostgreSQL unavailable
-- in this environment). Verify before applying to any real database.

BEGIN;

-- ═════════════════════════════════════════════════════════════
-- CAR DEALER AI (b86bb66e-df81-4d32-8629-3012635ba16a)
-- ═════════════════════════════════════════════════════════════

-- ── External rep rules (confirmed multi-month) ────────────────

-- Jerod: Metro Honda
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Metro Honda', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jerod on Metro Honda (CarDealer.ai, recurring)'
FROM commission_representatives WHERE slug = 'jerod'
ON CONFLICT DO NOTHING;

-- Jerod: Honda of Toms River
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Honda of Toms River', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jerod on Honda of Toms River (CarDealer.ai, recurring)'
FROM commission_representatives WHERE slug = 'jerod'
ON CONFLICT DO NOTHING;

-- Jason: Big Mouth Advertising (May 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Big Mouth Advertising', 'customer_name_pattern', 10,
       id, '2026-05-01', 'Confirmed: Jason on Big Mouth Advertising (CarDealer.ai, May 2026+)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- NOTE: James CDJR Cedar Lake and James CDJR Hampshire removed from active seed.
-- These appeared only in May 2026 (single sighting for Big Mouth / CarDealer.ai).
-- They require explicit business confirmation before being activated as attribution rules.
-- Add via the Rule Builder UI once confirmed.

-- ── House rules (CarDealer AI — confirmed recurring house accounts) ───

-- Mike Terry Chevrolet (explicit alias — avoids broad prefix pattern)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Mike Terry Chevrolet', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Mike Terry Chevrolet (CarDealer.ai) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Mike Terry Chevy GMC
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Mike Terry Chevy GMC', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Mike Terry Chevy GMC (CarDealer.ai) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Mike Terry Ford
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Mike Terry Ford', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Mike Terry Ford (CarDealer.ai) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Mike Terry Hyundai of Silsbee
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Mike Terry Hyundai of Silsbee', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Mike Terry Hyundai of Silsbee (CarDealer.ai) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- T3 Marketing (house client of CarDealer.ai — intercompany)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'T3 Marketing', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: T3 Marketing intercompany — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Mercedes-Benz of South Orlando
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Mercedes-Benz of South Orlando', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Mercedes-Benz of South Orlando — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- World Wide BDC
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'World Wide BDC', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: World Wide BDC — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Drive More Sales
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Drive More Sales', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Drive More Sales — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Malcolm Cunningham Chevrolet Alpharetta
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'Malcolm Cunningham Chevrolet Alpharetta', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Malcolm Cunningham Chevrolet Alpharetta — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- McCloskey Motors, Inc
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'b86bb66e-df81-4d32-8629-3012635ba16a', 'McCloskey Motors%', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: McCloskey Motors, Inc — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- T3 MARKETING (c2cf72b0-d77d-42de-a588-98092d9441df)
-- ═════════════════════════════════════════════════════════════

-- ── External rep rules (confirmed multi-month) ────────────────

-- Big Mouth: James CDJR accounts (Apr 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'James CDJR%', 'customer_name_pattern', 10,
       id, '2026-04-01', 'Confirmed: Big Mouth on James CDJR accounts (T3 Marketing, Apr 2026+)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

-- Big Mouth: South Suburban Mitsubishi (Apr 2026+)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'South Suburban Mitsubishi', 'customer_name_pattern', 10,
       id, '2026-04-01', 'Confirmed: Big Mouth on South Suburban Mitsubishi (T3 Marketing, Apr 2026+)'
FROM commission_representatives WHERE slug = 'big_mouth'
ON CONFLICT DO NOTHING;

-- ── House rules (T3 Marketing — confirmed recurring house accounts) ───

-- Barberino Nissan
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'Barberino Nissan', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Barberino Nissan (T3 Marketing) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Goose Creek Mitsubishi
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'Goose Creek Mitsubishi', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Goose Creek Mitsubishi (T3 Marketing) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Royal Mitsubishi
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'Royal Mitsubishi', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Royal Mitsubishi (T3 Marketing) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- TopMrktr LLC (intercompany)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'TopMrktr%', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: TopMrktr LLC intercompany (T3 Marketing) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Augusta Mitsubishi
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'Augusta Mitsubishi', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Augusta Mitsubishi (T3 Marketing) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Smile More Business Solutions (Carlos) — intercompany
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT 'c2cf72b0-d77d-42de-a588-98092d9441df', 'Smile More%', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Smile More Business Solutions (T3 Marketing) — intercompany, no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- TOP MKTR (28775e76-4e8f-49cd-84e8-d2de4b4491a9)
-- ═════════════════════════════════════════════════════════════

-- ── External rep rules (confirmed multi-month) ────────────────

-- Jason: Foray Insure (all months — recurring)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Foray%', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jason on Foray Insure (Top Mktr, all months, recurring)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: Incarnation Specialties (all months — recurring)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Incarnation Specialist%', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jason on Incarnation Specialties (Top Mktr, all months, recurring)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- Jason: TAG Reserve Spirits (all months — recurring)
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'TAG Reserve%', 'customer_name_pattern', 10,
       id, '2025-11-01', 'Confirmed: Jason on TAG Reserve Spirits (Top Mktr, all months, recurring)'
FROM commission_representatives WHERE slug = 'jason'
ON CONFLICT DO NOTHING;

-- ── House rules (Top Mktr — confirmed recurring house accounts) ───

-- Bay Community Health
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Bay Community Health', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Bay Community Health (Top Mktr) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- MHS Crane
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'MHS Crane', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: MHS Crane (Top Mktr) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Chrysalis Law Partners LLC
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Chrysalis Law Partners%', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Chrysalis Law Partners LLC (Top Mktr) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Roofing Recovery
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Roofing Recovery', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Roofing Recovery (Top Mktr) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Home Office USA
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Home Office USA', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Home Office USA (Top Mktr) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Slim CD
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Slim CD', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Slim CD (Top Mktr) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- Gentle Beginnings
INSERT INTO commission_attribution_rules
  (entity_id, customer_name_pattern, match_type, priority, representative_id, effective_from, notes)
SELECT '28775e76-4e8f-49cd-84e8-d2de4b4491a9', 'Gentle Beginnings', 'customer_name_pattern', 5,
       id, '2025-11-01', 'House: Gentle Beginnings (Top Mktr) — no commission'
FROM commission_representatives WHERE slug = 'house'
ON CONFLICT DO NOTHING;

-- ═════════════════════════════════════════════════════════════
-- SMILE MORE (0bea3469-8fb5-460d-8bd9-7471e242a8c8)
-- ═════════════════════════════════════════════════════════════
-- NOTE: No confirmed attribution rules from Excel audit for Smile More.
-- No single-sighting candidates seeded as active rules.
-- All Smile More invoices → needs_review until rules are confirmed via UI.

-- ═════════════════════════════════════════════════════════════
-- SINGLE-SIGHTING CANDIDATES — NOT SEEDED (require business confirmation)
-- ═════════════════════════════════════════════════════════════
-- The following were seen in the Excel audit but only in a single month.
-- They will produce needs_review until explicitly added via the rule UI:
--
--   Mazda of Columbia  (CarDealer.ai Feb 2026, T3 Dec 2025, Top Mktr Dec 2025)
--     → Pattern "Mazda%Columbia" appears in 3 entities — requires disambiguation
--       before seeding. May be same client invoiced across entities.
--   Cargill Chevrolet  (T3, Jun 2026 only)
--   Castle Hyundai     (Top Mktr, single period)
--   Precision Roofing  (Top Mktr, Apr 2026 single period)

COMMIT;
