-- commission_role_provisioning.sql
--
-- NON-EXECUTED DOCUMENT — read-only reference for the DBA / account owner.
--
-- This file contains the SQL that must be run ONCE by a superuser or the
-- database owner on the shared FinanceOS Neon/PostgreSQL production database
-- (project: financeos, branch: production, database: neondb) before the
-- Commission module can connect via COMMISSION_DATABASE_URL.
--
-- Prerequisites:
--   • The seven commission_* tables must already exist (commission_001_schema.sql applied).
--   • The sequences for those tables must already exist.
--   • This file does NOT create any objects — it only grants privileges.
--
-- Hard constraints this role must satisfy:
--   • No WRITE to public.entities or public.invoices (Core read-only).
--   • No CREATE TABLE, CREATE SCHEMA, CREATE SEQUENCE, or ALTER.
--   • No SUPERUSER, CREATEROLE, or CREATEDB.
--   • No ownership of any object.
--   • COMMISSION_DATABASE_URL carries this role's credentials.
--   • The connection string is never logged, committed to git, or stored in any table.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1 — Create the role (run as superuser or database owner).
-- Choose a strong, randomly generated password; store it in Neon secrets only.
-- Replace <STRONG_RANDOM_PASSWORD> with the actual value at provisioning time.
--
-- CREATE ROLE commission_writer
--   WITH LOGIN
--        NOSUPERUSER
--        NOCREATEDB
--        NOCREATEROLE
--        NOINHERIT
--   PASSWORD '<STRONG_RANDOM_PASSWORD>';


-- Step 2 — Grant CONNECT on the target database.
GRANT CONNECT ON DATABASE neondb TO commission_writer;


-- Step 3 — Grant USAGE on the public schema only.
GRANT USAGE ON SCHEMA public TO commission_writer;


-- Step 4 — Source tables: SELECT only (no INSERT, UPDATE, DELETE, TRUNCATE).
GRANT SELECT ON TABLE public.entities TO commission_writer;
GRANT SELECT ON TABLE public.invoices TO commission_writer;


-- Step 5 — Commission tables: full DML (no DDL, no TRUNCATE, no ownership).
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_periods          TO commission_writer;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_representatives  TO commission_writer;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_attribution_rules TO commission_writer;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_rules            TO commission_writer;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_rule_audit       TO commission_writer;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_run_lines        TO commission_writer;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_customer_aliases TO commission_writer;


-- Step 6 — Sequences: USAGE and SELECT so nextval() and currval() work.
--   (Sequence names follow the Neon/Drizzle default: <table>_<column>_seq)
--   Adjust names if the sequences were created with custom names.
GRANT USAGE, SELECT
  ON SEQUENCE public.commission_representatives_id_seq   TO commission_writer;
GRANT USAGE, SELECT
  ON SEQUENCE public.commission_attribution_rules_id_seq TO commission_writer;
GRANT USAGE, SELECT
  ON SEQUENCE public.commission_rules_id_seq             TO commission_writer;
GRANT USAGE, SELECT
  ON SEQUENCE public.commission_rule_audit_id_seq        TO commission_writer;
GRANT USAGE, SELECT
  ON SEQUENCE public.commission_customer_aliases_id_seq  TO commission_writer;


-- Step 7 — Verification queries (run as the new role to confirm access).
--
-- SET ROLE commission_writer;
--
-- -- Should succeed (SELECT):
-- SELECT id FROM public.entities   LIMIT 1;
-- SELECT id FROM public.invoices   LIMIT 1;
-- SELECT id FROM public.commission_periods LIMIT 1;
--
-- -- Should fail with permission denied (INSERT on Core tables):
-- -- INSERT INTO public.entities (id) VALUES (gen_random_uuid());   -- must be rejected
-- -- INSERT INTO public.invoices (id, entity_id) VALUES (gen_random_uuid(), gen_random_uuid()); -- must be rejected
--
-- RESET ROLE;
