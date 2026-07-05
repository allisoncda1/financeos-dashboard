/**
 * Neon (Postgres) read source for FinanceOS Core's published data.
 *
 * Sprint 5 scope: portfolio summary, validation summary, and pipeline
 * freshness are read from Core's Neon tables (financial_periods,
 * portfolio_snapshots, validation_results, sync_runs, entity_snapshots)
 * instead of Google Drive. Each function returns the EXACT same typed shape
 * the Drive path produced (PortfolioSummary / ValidationSummary /
 * DataFreshness) so nothing downstream (routes, AI, rules, reports, frontend)
 * needs to change. All reads are read-only; this module never writes.
 */
import { desc, eq } from "drizzle-orm";
import {
  db,
  entitiesTable,
  entitySnapshotsTable,
  financialPeriodsTable,
  portfolioSnapshotsTable,
  syncRunsTable,
  validationResultsTable,
} from "@workspace/db";
import type { PortfolioSummary, ValidationSummary, DataFreshness } from "./types";

/** Canonical display order, mirroring the Drive/mock `entities` array. */
const SLUG_ORDER = ["cardealer_ai", "t3_marketing", "topmrktr", "smile_more"];

function slugRank(slug: string): number {
  const i = SLUG_ORDER.indexOf(slug);
  return i === -1 ? SLUG_ORDER.length : i;
}

/** Postgres NUMERIC surfaces as string via Drizzle — parse safely to number. */
function num(v: string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Portfolio KPIs, aggregated from the four current-year YTD financial_periods
 * rows (one per entity). This mirrors how the Drive path aggregated per-entity
 * financials into a flat PortfolioSummary, and gives every documented field
 * (cogs/gross_profit/opex/net_income/cash_on_hand/…) directly from Core.
 */
export async function getPortfolioSummaryFromNeon(): Promise<PortfolioSummary> {
  const [snapshot] = await db
    .select()
    .from(portfolioSnapshotsTable)
    .where(eq(portfolioSnapshotsTable.isCurrent, true))
    .orderBy(desc(portfolioSnapshotsTable.generatedAt))
    .limit(1);

  const allYtdRows = await db
    .select({
      slug: entitiesTable.slug,
      displayName: entitiesTable.displayName,
      periodEnd: financialPeriodsTable.periodEnd,
      generatedAt: financialPeriodsTable.generatedAt,
      revenue: financialPeriodsTable.revenue,
      cogs: financialPeriodsTable.cogs,
      grossProfit: financialPeriodsTable.grossProfit,
      opex: financialPeriodsTable.opex,
      netIncome: financialPeriodsTable.netIncome,
      cashOnHand: financialPeriodsTable.cashOnHand,
      openAr: financialPeriodsTable.openAr,
      openAp: financialPeriodsTable.openAp,
    })
    .from(financialPeriodsTable)
    .innerJoin(entitiesTable, eq(entitiesTable.id, financialPeriodsTable.entityId))
    .where(eq(financialPeriodsTable.periodType, "ytd"));

  if (allYtdRows.length === 0) {
    throw new Error("Neon has no YTD financial_periods to build a portfolio summary");
  }

  // Core may retain more than one YTD row per entity over time; keep only the
  // most recent one per entity (by period_end, tie-broken by generated_at) so
  // portfolio KPIs reflect the current snapshot and never double-count history.
  const latestByEntity = new Map<string, (typeof allYtdRows)[number]>();
  for (const r of allYtdRows) {
    const prev = latestByEntity.get(r.slug);
    if (
      !prev ||
      r.periodEnd > prev.periodEnd ||
      (r.periodEnd === prev.periodEnd && r.generatedAt > prev.generatedAt)
    ) {
      latestByEntity.set(r.slug, r);
    }
  }
  const ytdRows = [...latestByEntity.values()];

  const revenue = ytdRows.reduce((s, r) => s + num(r.revenue), 0);
  const cogs = ytdRows.reduce((s, r) => s + num(r.cogs), 0);
  const grossProfit = ytdRows.reduce((s, r) => s + num(r.grossProfit), 0);
  const opex = ytdRows.reduce((s, r) => s + num(r.opex), 0);
  const netIncome = ytdRows.reduce((s, r) => s + num(r.netIncome), 0);
  const cashOnHand = ytdRows.reduce((s, r) => s + num(r.cashOnHand), 0);
  const openAr = ytdRows.reduce((s, r) => s + num(r.openAr), 0);
  const openAp = ytdRows.reduce((s, r) => s + num(r.openAp), 0);

  const netMarginPct = revenue !== 0 ? Number(((netIncome / revenue) * 100).toFixed(1)) : 0;

  const cashRunwayMonths = (() => {
    if (!Number.isFinite(cashOnHand) || cashOnHand <= 0) return null;
    if (!Number.isFinite(opex) || opex <= 0) return null;
    const monthsElapsed = new Date().getMonth() + 1;
    const monthlyOpex = opex / monthsElapsed;
    if (!Number.isFinite(monthlyOpex) || monthlyOpex <= 0) return null;
    return cashOnHand / monthlyOpex;
  })();

  const entities = [...ytdRows]
    .sort((a, b) => slugRank(a.slug) - slugRank(b.slug))
    .map((r) => r.displayName);

  return {
    as_of: snapshot ? snapshot.asOf : new Date().toISOString().slice(0, 10),
    pipeline_run: snapshot ? snapshot.pipelineRun.toISOString() : new Date().toISOString(),
    entities,
    entity_count: ytdRows.length,
    portfolio_revenue_ytd: revenue,
    portfolio_cogs_ytd: cogs,
    portfolio_gross_profit_ytd: grossProfit,
    portfolio_opex_ytd: opex,
    portfolio_net_income_ytd: netIncome,
    portfolio_net_margin_pct: netMarginPct,
    portfolio_open_ar: openAr,
    portfolio_open_ap: openAp,
    portfolio_cash_on_hand: cashOnHand,
    cash_runway_months: cashRunwayMonths,
  };
}

type RuleResult = { rule?: unknown; passed?: unknown; detail?: unknown };

/**
 * Validation summary, aggregated from the latest per-entity validation_results
 * row per entity (the entity_id = NULL portfolio roll-up row is excluded via
 * the inner join, avoiding double counting).
 */
export async function getValidationSummaryFromNeon(): Promise<ValidationSummary> {
  const rows = await db
    .select({
      slug: entitiesTable.slug,
      displayName: entitiesTable.displayName,
      runDate: validationResultsTable.runDate,
      totalChecks: validationResultsTable.totalChecks,
      passed: validationResultsTable.passed,
      failed: validationResultsTable.failed,
      ruleResults: validationResultsTable.ruleResults,
    })
    .from(validationResultsTable)
    .innerJoin(entitiesTable, eq(entitiesTable.id, validationResultsTable.entityId));

  if (rows.length === 0) {
    throw new Error("Neon has no per-entity validation_results");
  }

  const latestByEntity = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const prev = latestByEntity.get(r.slug);
    if (!prev || r.runDate > prev.runDate) latestByEntity.set(r.slug, r);
  }
  const latest = [...latestByEntity.values()];

  const totalChecks = latest.reduce((s, r) => s + r.totalChecks, 0);
  const passed = latest.reduce((s, r) => s + r.passed, 0);
  const failed = latest.reduce((s, r) => s + r.failed, 0);
  const runDate = latest.reduce(
    (max, r) => (r.runDate > max ? r.runDate : max),
    latest[0]!.runDate,
  );

  const ruleSet = new Set<string>();
  for (const r of latest) {
    if (Array.isArray(r.ruleResults)) {
      for (const rr of r.ruleResults as RuleResult[]) {
        if (rr && typeof rr === "object" && typeof rr.rule === "string") {
          ruleSet.add(rr.rule);
        }
      }
    }
  }
  const rulesChecked = [...ruleSet];

  const entities = [...latest]
    .sort((a, b) => slugRank(a.slug) - slugRank(b.slug))
    .map((r) => r.displayName);

  const runDateIso = runDate.toISOString().slice(0, 10);

  return {
    run_date: runDateIso,
    as_of: runDateIso,
    total_checks: totalChecks,
    passed,
    failed,
    all_passed: failed === 0,
    entities,
    rules_checked: rulesChecked,
    rule_count: rulesChecked.length,
    entity_count: latest.length,
  };
}

/**
 * Pipeline freshness/health, derived from the most recent sync_runs and the
 * current portfolio_snapshots row. Replaces Drive's audit/data_freshness.json.
 * The status-string fields (phase2_extraction/model_build/drive_upload) are
 * kept as "complete" to preserve the exact DataFreshness shape the UI renders.
 */
export async function getDataFreshnessFromNeon(): Promise<DataFreshness> {
  const [latestSync] = await db
    .select()
    .from(syncRunsTable)
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(1);

  const [snapshot] = await db
    .select()
    .from(portfolioSnapshotsTable)
    .where(eq(portfolioSnapshotsTable.isCurrent, true))
    .orderBy(desc(portfolioSnapshotsTable.generatedAt))
    .limit(1);

  const builtRows = await db
    .select({ entityId: entitySnapshotsTable.entityId })
    .from(entitySnapshotsTable)
    .where(eq(entitySnapshotsTable.isCurrent, true));
  const entitiesBuilt = new Set(builtRows.map((r) => r.entityId)).size;

  if (!latestSync && !snapshot) {
    throw new Error("Neon has no sync_runs or portfolio_snapshots for freshness");
  }

  const pipelineRun =
    snapshot?.pipelineRun ??
    latestSync?.completedAt ??
    latestSync?.startedAt ??
    new Date();

  return {
    pipeline_run: pipelineRun.toISOString(),
    data_as_of: snapshot ? snapshot.asOf : new Date().toISOString().slice(0, 10),
    entities_built: entitiesBuilt,
    qbo_connection: latestSync?.status === "success" ? "healthy" : (latestSync?.status ?? "unknown"),
    phase2_extraction: "complete",
    model_build: "complete",
    drive_upload: "complete",
    snapshot_archived: Boolean(snapshot),
    model_history_archived: true,
  };
}
