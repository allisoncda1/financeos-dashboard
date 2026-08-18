-- commission_role_provisioning.sql
--
-- NON-EXECUTED DOCUMENT — read-only reference for the DBA / account owner.
--
-- This file contains the SQL that must be run by a superuser or the
-- database owner on the shared FinanceOS Neon/PostgreSQL production database
-- (project: financeos, branch: production, database: neondb) before the
-- Commission module can connect via COMMISSION_DATABASE_URL.
--
-- Prerequisites (ORDER MATTERS — migrations create objects, this file only
-- grants access to objects that already exist):
--   • commission_001_schema.sql, commission_002_attribution_seed.sql,
--     commission_003_review_inputs.sql, and commission_004_documents_expenses.sql
--     must ALL already be applied — this file grants access to eleven
--     commission_* tables total (seven from 001 + four added by 004:
--     commission_documents, commission_document_lines,
--     commission_expense_allocations, commission_document_events).
--   • Do not run Step 5b before commission_004 has been applied — GRANT on a
--     table that doesn't exist yet fails outright.
--   • The sequences referenced in Step 6 must already exist (created by 001;
--     004's four new tables use gen_random_uuid() primary keys, not
--     sequences, so no new sequence grants are needed for them).
--   • This file does NOT create any objects — it only grants privileges.
--
-- Hard constraints this role must satisfy:
--   • No WRITE to public.entities or public.invoices (Core read-only).
--   • No CREATE TABLE, CREATE SCHEMA, CREATE SEQUENCE, ALTER, DROP, or TRUNCATE
--     — this role is runtime DML only, never DDL.
--   • No SUPERUSER, CREATEROLE, or CREATEDB.
--   • No ownership of any object.
--   • COMMISSION_DATABASE_URL carries this role's credentials.
--   • The connection string is never logged, committed to git, or stored in any table.
--
-- Privilege matrix for the four commission_004 tables — derived from the
-- ACTUAL SQL statements in db/commissionDocuments.ts, not granted by default.
-- Re-derive this table from the code (grep for `FROM`/`INTO`/`UPDATE`/`DELETE
-- FROM <table>`) whenever new operations are added, rather than assuming
-- every table needs full DML:
--
--   table                              | SELECT | INSERT | UPDATE | DELETE
--   -----------------------------------+--------+--------+--------+--------
--   commission_documents               |   ✓    |   ✓    |   ✓    |   ✗ (*)
--   commission_document_lines          |   ✓    |   ✓    |   ✓    |   ✓
--   commission_expense_allocations     |   ✓    |   ✓    |   ✓    |   ✗
--   commission_document_events         |   ✓    |   ✓    |   ✗    |   ✗
--
--   commission_document_lines DELETE: replaceDocumentLines() deletes all of a
--     document's lines and re-inserts the freshly-extracted set in the same
--     transaction (idempotent re-extraction) — a genuine runtime DELETE.
--   commission_expense_allocations has no UPDATE... wait, it DOES: supersedeAllocation()
--     sets superseded_at — allocations are otherwise immutable (never UPDATEd
--     in place beyond that one soft-delete-style field) and never DELETEd; a
--     prior allocation is superseded, never removed, preserving full history.
--   commission_document_events is a pure append-only audit log: INSERT +
--     SELECT only, never UPDATEd or DELETEd.
--   (*) commission_documents: db/commissionDocuments.ts exports
--     deleteCommissionDocumentRow(), a hard-delete intended as a compensating
--     action for a storage/DB-row race. As of this writing it is imported
--     into routes/commissionDocuments.ts but never actually invoked by any
--     call path (verified: `grep -rn "deleteCommissionDocumentRow("` finds
--     no call sites, only the export, the import, and a test mock) — so no
--     real runtime operation currently requires DELETE on this table. DELETE
--     is deliberately NOT granted here, per least privilege. If/when that
--     function is wired into a real call path, add
--     `GRANT DELETE ON TABLE public.commission_documents TO commission_writer;`
--     at that time — do not grant it speculatively now.
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


-- Step 2b — Close a default-privilege gap: PostgreSQL grants CREATE ON
-- DATABASE to PUBLIC by default on every database (this is what allows
-- CREATE SCHEMA <name> — a separate privilege from CREATE on the public
-- SCHEMA, which is NOT granted to PUBLIC by default since PG15). Without
-- this REVOKE, commission_writer would silently inherit the ability to
-- create new schemas via PUBLIC, contradicting "no DDL for the runtime
-- role" even though nothing was ever explicitly GRANTed to it. This is
-- standard baseline hardening for any production database, not specific
-- to Commission — safe to run even if other roles exist, since none of
-- them should be relying on the PUBLIC default to create schemas either.
REVOKE CREATE ON DATABASE neondb FROM PUBLIC;


-- Step 3 — Grant USAGE on the public schema only (CREATE on it is not
-- granted — and is not granted to PUBLIC by default since PG15 either —
-- so commission_writer can use existing objects in `public` but never
-- create new ones there).
GRANT USAGE ON SCHEMA public TO commission_writer;


-- Step 4 — Source tables: SELECT only (no INSERT, UPDATE, DELETE, TRUNCATE).
GRANT SELECT ON TABLE public.entities TO commission_writer;
GRANT SELECT ON TABLE public.invoices TO commission_writer;


-- Step 5 — Commission tables (commission_001_schema.sql): full DML (no DDL,
-- no TRUNCATE, no ownership).
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


-- Step 5b — Commission Documents tables (commission_004_documents_expenses.sql).
-- REQUIRES commission_004_documents_expenses.sql to already be applied — see
-- the privilege matrix above for why each grant is exactly what it is, no more.
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.commission_documents           TO commission_writer;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_document_lines      TO commission_writer;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.commission_expense_allocations TO commission_writer;
GRANT SELECT, INSERT
  ON TABLE public.commission_document_events     TO commission_writer;


-- Step 6 — Sequences: USAGE and SELECT so nextval() and currval() work.
--   (Sequence names follow the Neon/Drizzle default: <table>_<column>_seq)
--   Adjust names if the sequences were created with custom names.
--   None of commission_004's four tables use a sequence (all use
--   gen_random_uuid() primary keys) — nothing to add here for them.
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
-- -- Should succeed (SELECT, original seven tables):
-- SELECT id FROM public.entities   LIMIT 1;
-- SELECT id FROM public.invoices   LIMIT 1;
-- SELECT id FROM public.commission_periods LIMIT 1;
--
-- -- Should succeed (SELECT, the four commission_004 tables):
-- SELECT id FROM public.commission_documents           LIMIT 1;
-- SELECT id FROM public.commission_document_lines      LIMIT 1;
-- SELECT id FROM public.commission_expense_allocations LIMIT 1;
-- SELECT id FROM public.commission_document_events     LIMIT 1;
--
-- -- Should succeed (INSERT/UPDATE probes against commission_004 tables —
-- -- roll back immediately, this is a permission check, not real data):
-- BEGIN;
--   INSERT INTO public.commission_documents
--     (entity_id, file_name, file_size, sha256, storage_key, storage_provider, created_by)
--     VALUES (gen_random_uuid(), 'grant-check.pdf', 1, 'grant-check', 'grant-check', 'replit-object-storage', 'grant-check');
--   UPDATE public.commission_documents SET updated_at = now() WHERE file_name = 'grant-check.pdf';
-- ROLLBACK;
--
-- -- Should fail with permission denied (INSERT on Core tables):
-- -- INSERT INTO public.entities (id) VALUES (gen_random_uuid());   -- must be rejected
-- -- INSERT INTO public.invoices (id, entity_id) VALUES (gen_random_uuid(), gen_random_uuid()); -- must be rejected
--
-- -- Should fail with permission denied (DELETE not granted on these tables):
-- -- DELETE FROM public.commission_documents WHERE false;               -- must be rejected
-- -- DELETE FROM public.commission_expense_allocations WHERE false;     -- must be rejected
-- -- UPDATE public.commission_document_events SET reason = reason WHERE false; -- must be rejected (no UPDATE granted)
--
-- -- Should fail with permission denied (this role has no DDL, anywhere):
-- -- CREATE TABLE public.commission_writer_probe (id int);   -- must be rejected
-- -- ALTER TABLE public.commission_documents ADD COLUMN probe int; -- must be rejected
-- -- DROP TABLE public.commission_documents;                 -- must be rejected
-- -- CREATE SEQUENCE public.commission_writer_probe_seq;     -- must be rejected
-- -- CREATE SCHEMA commission_writer_probe;                  -- must be rejected ONLY IF Step 2b's
-- --                                                             REVOKE CREATE ON DATABASE ran — this
-- --                                                             is the one check that silently
-- --                                                             passes for the wrong reason (a
-- --                                                             leftover PUBLIC default) if Step 2b
-- --                                                             was skipped, so don't skip it.
--
-- RESET ROLE;
