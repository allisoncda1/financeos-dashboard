/**
 * Schema isolation tests — SI-01 through SI-06.
 *
 * Verifies that:
 *   1. ops.ts exports ONLY Dashboard-owned operational tables.
 *   2. reportHistory.ts declares the two required CHECK constraints.
 *   3. reportHistory.ts declares the two required indexes.
 *   4. Core (Neon) tables are absent from the operational schema.
 *   5. Existing operational tables (session, metric_snapshots, budgets) still export.
 *   6. scripts/post-merge.sh contains no database push command.
 *
 * These tests are read-only introspection: no DB connections are opened.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getTableConfig } from "drizzle-orm/pg-core";

// Operational schema exports (must contain exactly these tables and no Core tables)
import * as opsSchema from "@workspace/db/schema/ops";

// Individual table imports for detailed inspection
import { reportHistory } from "@workspace/db/schema/reportHistory";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Returns the set of SQL table names exported from the ops schema module. */
function opsTableNames(): Set<string> {
  const names = new Set<string>();
  for (const value of Object.values(opsSchema)) {
    try {
      // Drizzle table objects expose getTableConfig without throwing.
      const cfg = getTableConfig(value as Parameters<typeof getTableConfig>[0]);
      if (cfg?.name) names.add(cfg.name);
    } catch {
      // Not a table — skip (e.g. re-exported type aliases are no-ops at runtime).
    }
  }
  return names;
}

// ──────────────────────────────────────────────────────────────────────────────
// SI-01: Operational-only tables are present in ops schema
// ──────────────────────────────────────────────────────────────────────────────
describe("SI-01: ops schema includes all operational tables", () => {
  it("includes report_history", () => {
    expect(opsTableNames()).toContain("report_history");
  });

  it("includes budgets", () => {
    expect(opsTableNames()).toContain("budgets");
  });

  it("includes session (runtime)", () => {
    const names = opsTableNames();
    // session table may be named "session" or "sessions" — accept either.
    const hasSession = names.has("session") || names.has("sessions");
    expect(hasSession).toBe(true);
  });

  it("includes metric_snapshots", () => {
    const names = opsTableNames();
    const hasMetrics =
      names.has("metric_snapshots") || names.has("metricSnapshots");
    expect(hasMetrics).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SI-02: Core (Neon) tables are absent from ops schema
// ──────────────────────────────────────────────────────────────────────────────
describe("SI-02: ops schema excludes Core (Neon) tables", () => {
  const CORE_TABLES = [
    "entities",
    "financial_periods",
    "entity_snapshots",
    "portfolio_snapshots",
    "qbo_raw",
    "accounts",
    "invoices",
    "bills",
    "transactions",
    "customers",
    "vendors",
    "validation_results",
    "sync_runs",
    "alerts",
    "report_snapshots",
    "audit_log",
    "sync_state",
    "payment_allocations",
  ];

  const names = opsTableNames();

  for (const coreTable of CORE_TABLES) {
    it(`does not include Core table "${coreTable}"`, () => {
      expect(names).not.toContain(coreTable);
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// SI-03: reportHistory CHECK constraints are defined in TypeScript schema
// ──────────────────────────────────────────────────────────────────────────────
describe("SI-03: reportHistory CHECK constraints", () => {
  const cfg = getTableConfig(reportHistory);
  const checkNames = cfg.checks.map((c) => c.name);

  it("defines chk_report_history_status", () => {
    expect(checkNames).toContain("chk_report_history_status");
  });

  it("defines chk_report_history_format", () => {
    expect(checkNames).toContain("chk_report_history_format");
  });

  it("status CHECK references the four allowed values", () => {
    const statusCheck = cfg.checks.find(
      (c) => c.name === "chk_report_history_status",
    );
    expect(statusCheck).toBeDefined();
    // drizzle 0.45 SQL objects store fragments in queryChunks; join them to get the full expression.
    const text = (statusCheck!.value.queryChunks as { value?: string[] }[])
      .flatMap((chunk) => chunk.value ?? [])
      .join("");
    expect(text).toContain("queued");
    expect(text).toContain("processing");
    expect(text).toContain("completed");
    expect(text).toContain("failed");
  });

  it("format CHECK references the four allowed values", () => {
    const formatCheck = cfg.checks.find(
      (c) => c.name === "chk_report_history_format",
    );
    expect(formatCheck).toBeDefined();
    const text = (formatCheck!.value.queryChunks as { value?: string[] }[])
      .flatMap((chunk) => chunk.value ?? [])
      .join("");
    expect(text).toContain("json");
    expect(text).toContain("pdf");
    expect(text).toContain("excel");
    expect(text).toContain("html");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SI-04: reportHistory indexes are defined
// ──────────────────────────────────────────────────────────────────────────────
describe("SI-04: reportHistory indexes", () => {
  const cfg = getTableConfig(reportHistory);
  const indexNames = cfg.indexes.map((i) => i.config.name);

  it("defines idx_report_history_created", () => {
    expect(indexNames).toContain("idx_report_history_created");
  });

  it("defines idx_report_history_template", () => {
    expect(indexNames).toContain("idx_report_history_template");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SI-05: ops schema re-exports required TypeScript types (runtime no-op check)
// ──────────────────────────────────────────────────────────────────────────────
describe("SI-05: ops schema exports required runtime values", () => {
  it("exports reportHistory table object", () => {
    expect(opsSchema).toHaveProperty("reportHistory");
    expect(typeof opsSchema.reportHistory).toBe("object");
  });

  it("exports budgets table object", () => {
    expect(opsSchema).toHaveProperty("budgets");
    expect(typeof opsSchema.budgets).toBe("object");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SI-06: post-merge.sh must not run any database push command automatically
// ──────────────────────────────────────────────────────────────────────────────
describe("SI-06: scripts/post-merge.sh contains no automatic database push", () => {
  const scriptPath = resolve(__dirname, "../../../../../scripts/post-merge.sh");
  const script = readFileSync(scriptPath, "utf-8");

  it("does not contain 'drizzle-kit push'", () => {
    // Any active drizzle-kit push invocation (not commented out) would risk
    // applying an unreviewed schema diff to the operational database on merge.
    const activeLines = script
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(activeLines).not.toContain("drizzle-kit push");
  });

  it("does not contain 'push:ops' as an active command", () => {
    const activeLines = script
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");
    expect(activeLines).not.toContain("push:ops");
  });

  it("still installs dependencies", () => {
    expect(script).toContain("pnpm install --frozen-lockfile");
  });
});
