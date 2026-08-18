-- Migration: commission_004_documents_expenses
-- Adds Commission Documents (vendor PDF upload/extraction) and expense
-- allocations.
--
-- Target: COMMISSION_DATABASE_URL ONLY. Apply AFTER commission_001/002/003.
-- Idempotent: IF NOT EXISTS / ON CONFLICT DO NOTHING throughout. Safe to run twice.
--
-- Verify before applying:
--   SELECT current_database(), current_user;
--   SELECT COUNT(*) FROM commission_run_lines;
--
-- NOTE: an earlier draft of this migration also added a `lead_source` column
-- to commission_attribution_rules/commission_rules (for a future Jerod-
-- specific rate-by-source rule). Removed from this migration — nothing in
-- this vertical slice reads or writes it, and an unused column/CHECK widens
-- the migration's blast radius for no benefit. Reintroduce it, scoped and
-- tested, when the Jerod lead-source rate work is actually implemented.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Commission documents (uploaded vendor PDFs)
--
-- Lease/retry model (no external queue platform):
--   - A document starts 'uploaded'. To process it, a worker atomically
--     claims it: UPDATE ... SET status='processing', processing_started_at=now(),
--     lease_expires_at=now()+lease_duration, attempts=attempts+1
--     WHERE id=$1 AND (status='uploaded' OR (status='processing' AND lease_expires_at < now()))
--   - Postgres row-level locking makes this UPDATE's WHERE re-evaluation
--     atomic against concurrent claims: only one transaction's UPDATE can
--     ever affect the row for a given claim attempt — see
--     db/commissionDocuments.ts::claimDocumentForProcessing.
--   - A crash mid-processing leaves the document in 'processing' with a
--     lease_expires_at in the past once the lease duration elapses — it
--     becomes claimable again, never permanently stuck.
--   - next_retry_at and attempts drive bounded, backed-off retry.
--   - last_error is always sanitized before being written here (see
--     services/documentProcessing.ts's sanitizeError()).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id             UUID NOT NULL,
  file_name             TEXT NOT NULL,
  content_type          TEXT NOT NULL DEFAULT 'application/pdf',
  file_size             INT NOT NULL CHECK (file_size > 0),
  sha256                TEXT NOT NULL,
  storage_key           TEXT NOT NULL,
  storage_provider      TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'uploaded'
                        CHECK (status IN (
                          'uploaded','processing','needs_review',
                          'ready_to_apply','applied','failed','archived'
                        )),
  vendor_name           TEXT,
  document_number       TEXT,
  document_date         DATE,
  period_year           INT,
  period_month          INT CHECK (period_month BETWEEN 1 AND 12),
  document_total        NUMERIC(12,2) CHECK (document_total IS NULL OR document_total >= 0),
  -- Lease/retry state
  attempts              INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  processing_started_at TIMESTAMPTZ,
  lease_expires_at      TIMESTAMPTZ,
  next_retry_at         TIMESTAMPTZ,
  last_error            TEXT,
  idempotency_key       TEXT,
  applied_at            TIMESTAMPTZ,
  applied_by            TEXT,
  archived_at           TIMESTAMPTZ,
  archived_by           TEXT,
  reopened_at           TIMESTAMPTZ,
  reopened_by           TEXT,
  reopen_reason         TEXT,
  created_by            TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedup by entity: the same PDF (identical bytes) cannot be uploaded twice
-- for the same entity. A different entity uploading identical bytes is a
-- separate, independent document (isolation, not dedup, across entities).
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_documents_entity_sha256
  ON commission_documents (entity_id, sha256);

CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_documents_idempotency
  ON commission_documents (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commission_documents_entity        ON commission_documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_commission_documents_status        ON commission_documents(status);
CREATE INDEX IF NOT EXISTS idx_commission_documents_entity_status ON commission_documents(entity_id, status);
CREATE INDEX IF NOT EXISTS idx_commission_documents_period        ON commission_documents(entity_id, period_year, period_month);
-- Speeds up the claim query's WHERE (status='processing' AND lease_expires_at < now()).
CREATE INDEX IF NOT EXISTS idx_commission_documents_lease
  ON commission_documents (lease_expires_at)
  WHERE status = 'processing';

-- ─────────────────────────────────────────────────────────────
-- 2. Commission document lines (one row per line item extracted from a PDF)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_document_lines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID NOT NULL REFERENCES commission_documents(id) ON DELETE RESTRICT,
  line_index            INT NOT NULL CHECK (line_index >= 0),
  raw_text              TEXT,
  extracted_client_name TEXT,
  extracted_amount      NUMERIC(12,2) CHECK (extracted_amount IS NULL OR extracted_amount >= 0),
  extracted_description TEXT,
  proof_page            INT CHECK (proof_page IS NULL OR proof_page > 0),
  status                TEXT NOT NULL DEFAULT 'unmatched'
                        CHECK (status IN ('unmatched','suggested','confirmed','ignored')),
  suggested_invoice_id  UUID,
  suggested_confidence  NUMERIC(4,3) CHECK (suggested_confidence IS NULL OR (suggested_confidence >= 0 AND suggested_confidence <= 1)),
  confirmed_invoice_id  UUID REFERENCES commission_run_lines(id) ON DELETE RESTRICT,
  confirmed_by          TEXT,
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, line_index)
);

CREATE INDEX IF NOT EXISTS idx_commission_document_lines_document ON commission_document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_commission_document_lines_status   ON commission_document_lines(status);

-- ─────────────────────────────────────────────────────────────
-- 3. Commission expense allocations (a document line's amount split
--    across one or more commission_run_lines)
--
-- Multi-row-sum enforcement note: a CHECK constraint can only see the
-- single row being written — it CANNOT verify "the sum of all active
-- allocations for this document line does not exceed the source amount"
-- because that requires reading other rows. That invariant is enforced by
-- application code (db/commissionDocuments.ts::createAllocations) inside a
-- transaction that:
--   1. SELECT ... FOR UPDATE locks the source commission_document_lines row
--   2. re-reads the sum of active allocations under that lock
--   3. atomically rejects the insert if the new total would exceed the
--      source amount (unless an audited override is provided)
-- A CHECK constraint here would give false confidence — it is deliberately
-- not attempted.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_expense_allocations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_line_id       UUID NOT NULL REFERENCES commission_document_lines(id) ON DELETE RESTRICT,
  commission_run_line_id UUID NOT NULL REFERENCES commission_run_lines(id) ON DELETE RESTRICT,
  allocation_method      TEXT NOT NULL
                         CHECK (allocation_method IN (
                           'fixed_amount','percentage_of_expense','full_expense','prorata_revenue'
                         )),
  allocated_amount       NUMERIC(12,2) NOT NULL CHECK (allocated_amount > 0),
  override_authorized_by TEXT,
  override_reason        TEXT,
  reason                 TEXT NOT NULL CHECK (btrim(reason) <> ''),
  created_by             TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at          TIMESTAMPTZ,
  superseded_by          TEXT,
  CHECK (
    (override_authorized_by IS NULL AND override_reason IS NULL) OR
    (override_authorized_by IS NOT NULL AND override_reason IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_commission_expense_alloc_doc_line ON commission_expense_allocations(document_line_id);
CREATE INDEX IF NOT EXISTS idx_commission_expense_alloc_run_line ON commission_expense_allocations(commission_run_line_id);

-- Active (non-superseded) allocations only — used both by the application
-- to sum "confirmed_allocated_expenses" per commission_run_line, and by
-- createAllocations' own over-allocation check.
CREATE INDEX IF NOT EXISTS idx_commission_expense_alloc_active
  ON commission_expense_allocations(document_line_id)
  WHERE superseded_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. Commission document events (audit trail — every state transition)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_document_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES commission_documents(id) ON DELETE RESTRICT,
  event_type      TEXT NOT NULL
                  CHECK (event_type IN (
                    'uploaded','extraction_claimed','extraction_started','extraction_succeeded',
                    'extraction_failed','extraction_retried','extraction_abandoned_resumed',
                    'line_matched','line_confirmed','line_ignored','allocation_created',
                    'allocation_superseded','applied','archived','reopened'
                  )),
  performed_by    TEXT,
  before_snapshot JSONB,
  after_snapshot  JSONB,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_document_events_document ON commission_document_events(document_id);

COMMIT;
