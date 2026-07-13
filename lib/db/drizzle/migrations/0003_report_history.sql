-- RC-015: Report History
-- Creates the Dashboard-owned report_history table in DATABASE_URL
-- (the writable Replit operational database — NOT FinanceOS Core).
-- This table is written by the api-server each time a report is generated
-- and read back by GET /api/reports/history.
-- Migration is additive: no existing tables, columns, or indexes are touched.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_history" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "template"         TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "period"           TEXT NOT NULL,
  "entity_slugs"     TEXT[] NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'completed'
                       CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  "format"           TEXT NOT NULL
                       CHECK (format IN ('json', 'pdf', 'excel', 'html')),
  "source"           TEXT,
  "data_freshness"   TEXT,
  "entity_count"     INTEGER,
  "confidence_score" INTEGER,
  "requested_by"     TEXT,
  "error_message"    TEXT,
  "completed_at"     TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_report_history_created"
  ON "report_history" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_report_history_template"
  ON "report_history" ("template", "created_at" DESC);
