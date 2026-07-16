/**
 * Operational schema — DATABASE_URL only.
 *
 * This file is the sole schema source for drizzle.ops.config.ts and
 * `pnpm --filter db push:ops`. It must contain ONLY tables that belong
 * to the Dashboard's writable Replit operational database.
 *
 * ✅ Included: session, metric_snapshots, budgets, report_history
 * ❌ Excluded: ALL FinanceOS Core tables (entities, financial_periods,
 *             entity_snapshots, portfolio_snapshots, qbo_raw, accounts,
 *             invoices, bills, transactions, customers, vendors,
 *             validation_results, sync_runs, alerts, etc.)
 *
 * If you add a new Dashboard-owned table, add its export here AND to
 * lib/db/src/schema/index.ts. Never export Core tables from this file.
 */

export { sessionTable, metricSnapshotsTable } from "./runtimeTables";
export { budgets }                             from "./budget";
export { reportHistory }                       from "./reportHistory";

// Re-export types so API-server code can import them from this entry point.
export type { MetricSnapshotRow }                    from "./runtimeTables";
export type { Budget, InsertBudget }                 from "./budget";
export type { ReportHistoryRow, InsertReportHistory } from "./reportHistory";
