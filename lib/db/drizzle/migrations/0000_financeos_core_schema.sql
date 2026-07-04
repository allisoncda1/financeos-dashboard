-- FinanceOS Core Database — Initial Schema
-- Migration: 0000_financeos_core_schema
-- Generated: 2026-07-04
-- Architecture: CORE_DATABASE_ARCHITECTURE.md v1.0

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entities" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"             TEXT NOT NULL UNIQUE,
  "display_name"     TEXT NOT NULL,
  "short_name"       TEXT,
  "qbo_realm_id"     TEXT NOT NULL UNIQUE,
  "accounting_basis" TEXT NOT NULL DEFAULT 'Cash',
  "currency"         TEXT NOT NULL DEFAULT 'USD',
  "time_zone"        TEXT NOT NULL DEFAULT 'America/Panama',
  "status"           TEXT NOT NULL DEFAULT 'active',
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_runs" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"            UUID NOT NULL REFERENCES "entities"("id"),
  "sync_type"            TEXT NOT NULL,
  "object_types"         TEXT[] NOT NULL,
  "started_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at"         TIMESTAMPTZ,
  "status"               TEXT NOT NULL DEFAULT 'running',
  "records_fetched"      INTEGER DEFAULT 0,
  "records_inserted"     INTEGER DEFAULT 0,
  "records_updated"      INTEGER DEFAULT 0,
  "records_skipped"      INTEGER DEFAULT 0,
  "error_message"        TEXT,
  "qbo_rate_limit_hits"  INTEGER DEFAULT 0,
  "triggered_by"         TEXT NOT NULL DEFAULT 'scheduler'
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sync_runs_entity_status" ON "sync_runs"("entity_id", "status");
CREATE INDEX IF NOT EXISTS "idx_sync_runs_started_at" ON "sync_runs"("started_at" DESC);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_state" (
  "entity_id"          UUID NOT NULL REFERENCES "entities"("id"),
  "object_type"        TEXT NOT NULL,
  "last_sync_at"       TIMESTAMPTZ,
  "last_modified_time" TIMESTAMPTZ,
  "total_records"      INTEGER DEFAULT 0,
  PRIMARY KEY ("entity_id", "object_type")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sync_state_entity" ON "sync_state"("entity_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qbo_raw" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"      UUID NOT NULL REFERENCES "entities"("id"),
  "object_type"    TEXT NOT NULL,
  "qbo_id"         TEXT NOT NULL,
  "qbo_sync_token" TEXT,
  "payload"        JSONB NOT NULL,
  "synced_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "sync_run_id"    UUID REFERENCES "sync_runs"("id"),
  "is_deleted"     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("entity_id", "object_type", "qbo_id")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_qbo_raw_entity_type" ON "qbo_raw"("entity_id", "object_type");
CREATE INDEX IF NOT EXISTS "idx_qbo_raw_synced_at" ON "qbo_raw"("synced_at" DESC);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"            UUID NOT NULL REFERENCES "entities"("id"),
  "qbo_id"               TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "fully_qualified_name" TEXT,
  "account_type"         TEXT NOT NULL,
  "account_subtype"      TEXT,
  "classification"       TEXT,
  "current_balance"      NUMERIC(18,2) DEFAULT 0,
  "currency"             TEXT DEFAULT 'USD',
  "is_active"            BOOLEAN DEFAULT true,
  "is_sub_account"       BOOLEAN DEFAULT false,
  "parent_qbo_id"        TEXT,
  "synced_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("entity_id", "qbo_id")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_accounts_entity" ON "accounts"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_accounts_type" ON "accounts"("entity_id", "account_type");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"    UUID NOT NULL REFERENCES "entities"("id"),
  "qbo_id"       TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "email"        TEXT,
  "phone"        TEXT,
  "balance"      NUMERIC(18,2) DEFAULT 0,
  "currency"     TEXT DEFAULT 'USD',
  "is_active"    BOOLEAN DEFAULT true,
  "synced_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("entity_id", "qbo_id")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_customers_entity" ON "customers"("entity_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"    UUID NOT NULL REFERENCES "entities"("id"),
  "qbo_id"       TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "email"        TEXT,
  "balance"      NUMERIC(18,2) DEFAULT 0,
  "currency"     TEXT DEFAULT 'USD',
  "is_active"    BOOLEAN DEFAULT true,
  "synced_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("entity_id", "qbo_id")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vendors_entity" ON "vendors"("entity_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"     UUID NOT NULL REFERENCES "entities"("id"),
  "qbo_id"        TEXT NOT NULL,
  "customer_id"   UUID REFERENCES "customers"("id"),
  "customer_name" TEXT,
  "invoice_date"  DATE NOT NULL,
  "due_date"      DATE,
  "amount"        NUMERIC(18,2) NOT NULL DEFAULT 0,
  "balance"       NUMERIC(18,2) NOT NULL DEFAULT 0,
  "status"        TEXT,
  "days_overdue"  INTEGER DEFAULT 0,
  "currency"      TEXT DEFAULT 'USD',
  "memo"          TEXT,
  "is_deleted"    BOOLEAN DEFAULT false,
  "synced_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("entity_id", "qbo_id")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_invoices_entity_date" ON "invoices"("entity_id", "invoice_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_invoices_status" ON "invoices"("entity_id", "status");
CREATE INDEX IF NOT EXISTS "idx_invoices_customer" ON "invoices"("customer_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bills" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"   UUID NOT NULL REFERENCES "entities"("id"),
  "qbo_id"      TEXT NOT NULL,
  "vendor_id"   UUID REFERENCES "vendors"("id"),
  "vendor_name" TEXT,
  "bill_date"   DATE NOT NULL,
  "due_date"    DATE,
  "amount"      NUMERIC(18,2) NOT NULL DEFAULT 0,
  "balance"     NUMERIC(18,2) NOT NULL DEFAULT 0,
  "status"      TEXT,
  "days_overdue" INTEGER DEFAULT 0,
  "currency"    TEXT DEFAULT 'USD',
  "memo"        TEXT,
  "is_deleted"  BOOLEAN DEFAULT false,
  "synced_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("entity_id", "qbo_id")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bills_entity_date" ON "bills"("entity_id", "bill_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_bills_status" ON "bills"("entity_id", "status");
CREATE INDEX IF NOT EXISTS "idx_bills_vendor" ON "bills"("vendor_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"        UUID NOT NULL REFERENCES "entities"("id"),
  "qbo_id"           TEXT NOT NULL,
  "transaction_type" TEXT NOT NULL,
  "transaction_date" DATE NOT NULL,
  "amount"           NUMERIC(18,2) NOT NULL,
  "account_id"       UUID REFERENCES "accounts"("id"),
  "account_name"     TEXT,
  "entity_ref"       TEXT,
  "memo"             TEXT,
  "category"         TEXT,
  "currency"         TEXT DEFAULT 'USD',
  "is_reconciled"    BOOLEAN DEFAULT false,
  "is_deleted"       BOOLEAN DEFAULT false,
  "synced_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("entity_id", "transaction_type", "qbo_id")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_entity_date" ON "transactions"("entity_id", "transaction_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_transactions_type" ON "transactions"("entity_id", "transaction_type");
CREATE INDEX IF NOT EXISTS "idx_transactions_account" ON "transactions"("account_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_periods" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"           UUID NOT NULL REFERENCES "entities"("id"),
  "period_type"         TEXT NOT NULL,
  "period_start"        DATE NOT NULL,
  "period_end"          DATE NOT NULL,
  "revenue"             NUMERIC(18,2) DEFAULT 0,
  "cogs"                NUMERIC(18,2) DEFAULT 0,
  "gross_profit"        NUMERIC(18,2) DEFAULT 0,
  "opex"                NUMERIC(18,2) DEFAULT 0,
  "net_income"          NUMERIC(18,2) DEFAULT 0,
  "gross_margin_pct"    NUMERIC(8,4) DEFAULT 0,
  "net_margin_pct"      NUMERIC(8,4) DEFAULT 0,
  "total_assets"        NUMERIC(18,2) DEFAULT 0,
  "total_liabilities"   NUMERIC(18,2) DEFAULT 0,
  "total_equity"        NUMERIC(18,2) DEFAULT 0,
  "cash_on_hand"        NUMERIC(18,2) DEFAULT 0,
  "accounts_receivable" NUMERIC(18,2) DEFAULT 0,
  "accounts_payable"    NUMERIC(18,2) DEFAULT 0,
  "open_ar"             NUMERIC(18,2) DEFAULT 0,
  "open_ap"             NUMERIC(18,2) DEFAULT 0,
  "dso_days"            NUMERIC(8,2) DEFAULT 0,
  "dpo_days"            NUMERIC(8,2) DEFAULT 0,
  "ar_overdue_pct"      NUMERIC(8,4) DEFAULT 0,
  "ap_overdue_pct"      NUMERIC(8,4) DEFAULT 0,
  "computed_from"       TEXT DEFAULT 'qbo_report',
  "generated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("entity_id", "period_type", "period_start")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_financial_periods_entity" ON "financial_periods"("entity_id", "period_type", "period_start" DESC);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entity_snapshots" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"     UUID NOT NULL REFERENCES "entities"("id"),
  "as_of"         DATE NOT NULL,
  "pipeline_run"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "metrics"       JSONB NOT NULL,
  "anomalies"     JSONB NOT NULL DEFAULT '[]'::jsonb,
  "financials"    JSONB,
  "customers_data" JSONB,
  "vendors_data"  JSONB,
  "banking_data"  JSONB,
  "is_current"    BOOLEAN NOT NULL DEFAULT true,
  "generated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--> statement-breakpoint
-- Partial unique index: only one current snapshot per entity
CREATE UNIQUE INDEX IF NOT EXISTS "idx_entity_snapshots_current"
  ON "entity_snapshots"("entity_id")
  WHERE is_current = true;
CREATE INDEX IF NOT EXISTS "idx_entity_snapshots_entity_date" ON "entity_snapshots"("entity_id", "as_of" DESC);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portfolio_snapshots" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "as_of"        DATE NOT NULL,
  "pipeline_run" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "entity_ids"   UUID[] NOT NULL,
  "metrics"      JSONB NOT NULL,
  "is_current"   BOOLEAN NOT NULL DEFAULT true,
  "generated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_portfolio_snapshots_date" ON "portfolio_snapshots"("as_of" DESC);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "validation_results" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"    UUID REFERENCES "entities"("id"),
  "sync_run_id"  UUID REFERENCES "sync_runs"("id"),
  "run_date"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "total_checks" INTEGER NOT NULL DEFAULT 0,
  "passed"       INTEGER NOT NULL DEFAULT 0,
  "failed"       INTEGER NOT NULL DEFAULT 0,
  "all_passed"   BOOLEAN NOT NULL DEFAULT false,
  "rule_results" JSONB NOT NULL DEFAULT '[]'::jsonb
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_validation_results_entity" ON "validation_results"("entity_id", "run_date" DESC);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_snapshots" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "template"     TEXT NOT NULL,
  "entity_ids"   UUID[] NOT NULL,
  "period_start" DATE,
  "period_end"   DATE,
  "format"       TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "content"      JSONB,
  "drive_file_id" TEXT,
  "drive_url"    TEXT,
  "generated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "generated_by" TEXT DEFAULT 'system'
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_report_snapshots_template" ON "report_snapshots"("template", "generated_at" DESC);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_id"  UUID REFERENCES "entities"("id"),
  "action"     TEXT NOT NULL,
  "actor"      TEXT NOT NULL DEFAULT 'system',
  "details"    JSONB DEFAULT '{}'::jsonb,
  "ip_address" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_entity" ON "audit_log"("entity_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_log_action" ON "audit_log"("action", "created_at" DESC);
