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
import { and, desc, eq, sql } from "drizzle-orm";
import { ENTITY_SLUGS } from "./types";
import {
  db,
  entitiesTable,
  entitySnapshotsTable,
  financialPeriodsTable,
  portfolioSnapshotsTable,
  syncRunsTable,
  validationResultsTable,
  invoicesTable,
  billsTable,
  accountsTable,
  transactionsTable,
  customersTable,
  alertsTable,
  cashFlowStatementsTable,
} from "@workspace/db";
import type {
  PortfolioSummary,
  ValidationSummary,
  DataFreshness,
  EntityMetrics,
  EntitySlug,
  FinancialsData,
  EntityHistoryData,
  PriorYearHistory,
  PriorYearBalanceSheetSummary,
  MonthlyPL,
  BalanceSheet,
  CustomersData,
  VendorsData,
  BankingData,
  AgingBucket,
  Customer,
  Vendor,
  BankAccount,
  BankTransaction,
  CashFlowStatement,
} from "./types";
import { computePipelineMetrics } from "./pipelineMetrics";

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

  // Per-entity × per-rule pass/fail from Core's stored rule_results, keyed by
  // the dashboard EntitySlug so the validation matrix can show real outcomes
  // instead of inferring all-pass from summary counts.
  const ruleMatrix: Record<string, Record<string, boolean>> = {};
  for (const r of latest) {
    const dashSlug = ENTITY_SLUGS.find(
      (s) => s.toLowerCase() === r.slug.toLowerCase(),
    );
    if (!dashSlug) continue;
    const perRule: Record<string, boolean> = {};
    if (Array.isArray(r.ruleResults)) {
      for (const rr of r.ruleResults as RuleResult[]) {
        if (rr && typeof rr === "object" && typeof rr.rule === "string" && typeof rr.passed === "boolean") {
          perRule[rr.rule] = rr.passed;
        }
      }
    }
    ruleMatrix[dashSlug] = perRule;
  }

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
    rule_matrix: ruleMatrix,
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
    .where(eq(syncRunsTable.syncType, "incremental"))
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(1);

  const recentRuns = await db
    .select({
      status: syncRunsTable.status,
      startedAt: syncRunsTable.startedAt,
      completedAt: syncRunsTable.completedAt,
    })
    .from(syncRunsTable)
    .where(and(
      eq(syncRunsTable.syncType, "incremental"),
      sql`${syncRunsTable.startedAt} >= now() - interval '30 days'`,
    ));

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

  const [historyRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(financialPeriodsTable);

  const pipelineMetrics = computePipelineMetrics(recentRuns);

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
    phase2_extraction: latestSync?.status === "success" ? "complete" : (latestSync?.status ?? "unknown"),
    model_build: snapshot ? "complete" : "unknown",
    drive_upload: "not_applicable",
    snapshot_archived: Boolean(snapshot),
    model_history_archived: (historyRow?.count ?? 0) > 0,
    latest_trigger: latestSync?.triggeredBy ?? null,
    avg_entity_sync_duration_seconds: pipelineMetrics.avgEntitySyncDurationSeconds,
    pipeline_uptime_30d_pct: pipelineMetrics.pipelineUptime30dPct,
    successful_runs_30d: pipelineMetrics.successfulRuns30d,
    total_runs_30d: pipelineMetrics.totalRuns30d,
  };
}

/**
 * jsonb numbers already arrive as JS numbers (unlike NUMERIC columns, which
 * Drizzle surfaces as strings). Coerce defensively and preserve negatives/zero
 * (e.g. Smile_More carries a negative cash/equity position). Never fabricate a
 * value — a missing field collapses to 0, mirroring the Drive `?? 0` behaviour.
 */
function toNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Shape of the nested `metrics` jsonb payload FinanceOS Core writes into
 * entity_snapshots. This is NOT the Dashboard's flat EntityMetrics — Core owns
 * a richer structure and we read (never recompute) the corresponding fields.
 */
type CoreFinancialPeriod = {
  revenue?: number;
  cogs?: number;
  gross_profit?: number;
  opex?: number;
  net_income?: number;
  net_margin_pct?: number;
  gross_margin_pct?: number;
};
type CoreMetricsPayload = {
  entity_name?: string;
  as_of?: string;
  financial_summary?: Record<string, CoreFinancialPeriod>;
  balance_sheet?: {
    current?: {
      cash_on_hand?: number;
      total_assets?: number;
      total_equity?: number;
      total_liabilities?: number;
    };
  };
  ar_ap_metrics?: {
    open_ap?: number;
    open_ar?: number;
    dpo_days?: number;
    dso_days?: number;
    ar_overdue_pct?: number;
    ap_overdue_pct?: number;
  };
  cash_metrics?: { cash_current?: number };
};

/**
 * Per-entity KPIs, read from the entity's current entity_snapshots row (Core is
 * the source of truth as of Sprint 6). Exactly one SQL query per entity — the
 * whole flat EntityMetrics is projected from a single nested `metrics` jsonb
 * payload, so there is no N+1. Every field is read directly from Core; nothing
 * is recomputed. `basis` is intentionally NOT sourced here (see getEntityMetrics
 * in dataSource.ts) because it is not part of the entity_snapshots payload.
 */
export async function getEntityMetricsFromNeon(slug: EntitySlug): Promise<EntityMetrics> {
  // Dashboard slugs (CarDealer_ai) are the lower-cased Core slugs (cardealer_ai).
  const coreSlug = slug.toLowerCase();

  const [row] = await db
    .select({
      metrics: entitySnapshotsTable.metrics,
      pipelineRun: entitySnapshotsTable.pipelineRun,
      displayName: entitiesTable.displayName,
      accountingBasis: entitiesTable.accountingBasis,
    })
    .from(entitySnapshotsTable)
    .innerJoin(entitiesTable, eq(entitiesTable.id, entitySnapshotsTable.entityId))
    .where(and(eq(entitiesTable.slug, coreSlug), eq(entitySnapshotsTable.isCurrent, true)))
    .orderBy(desc(entitySnapshotsTable.generatedAt))
    .limit(1);

  if (!row) {
    throw new Error(
      `Neon has no current entity_snapshot for "${slug}" (core slug "${coreSlug}")`,
    );
  }

  const m = (row.metrics ?? {}) as CoreMetricsPayload;
  const fs = m.financial_summary ?? {};
  // Pick the latest YTD bucket deterministically (e.g. "ytd_2026") without
  // hard-coding the year, so this keeps working as Core rolls forward. Prefer
  // strict `ytd_YYYY` keys sorted by year; fall back to any `ytd*` key.
  const strictYtdKeys = Object.keys(fs)
    .filter((k) => /^ytd_\d{4}$/.test(k))
    .sort();
  const ytdKey =
    strictYtdKeys.at(-1) ?? Object.keys(fs).find((k) => k.startsWith("ytd"));
  const ytd = (ytdKey ? fs[ytdKey] : undefined) ?? {};
  const bs = m.balance_sheet?.current ?? {};
  const arap = m.ar_ap_metrics ?? {};
  const cash = m.cash_metrics ?? {};

  return {
    entity: m.entity_name ?? row.displayName,
    slug,
    // `basis` is not in the metrics jsonb payload but IS an authoritative Core
    // field (entities.accounting_basis) — read it rather than fabricate.
    basis: row.accountingBasis === "Cash" ? "Cash" : "Accrual",
    as_of: m.as_of ?? row.pipelineRun.toISOString().slice(0, 10),
    pipeline_run: row.pipelineRun.toISOString(),
    revenue_ytd: toNum(ytd.revenue),
    cogs_ytd: toNum(ytd.cogs),
    gross_profit_ytd: toNum(ytd.gross_profit),
    gross_margin_pct: toNum(ytd.gross_margin_pct),
    opex_ytd: toNum(ytd.opex),
    net_income_ytd: toNum(ytd.net_income),
    net_margin_pct: toNum(ytd.net_margin_pct),
    total_assets: toNum(bs.total_assets),
    total_liabilities: toNum(bs.total_liabilities),
    total_equity: toNum(bs.total_equity),
    open_ar: toNum(arap.open_ar),
    open_ap: toNum(arap.open_ap),
    dso_days: toNum(arap.dso_days),
    dpo_days: toNum(arap.dpo_days),
    cash_on_hand: toNum(cash.cash_current ?? bs.cash_on_hand),
    ar_overdue_pct: toNum(arap.ar_overdue_pct),
    ap_overdue_pct: toNum(arap.ap_overdue_pct),
  };
}

// ---------------------------------------------------------------------------
// Sprint 7: financial history (getEntityFinancials / getEntityHistory) read
// from Core's financial_periods. Read-only, never recomputed — every P&L and
// balance-sheet figure comes straight from a financial_periods column. Each
// public function issues exactly ONE SQL query (all of an entity's periods) and
// partitions the rows in memory, so there is no N+1.
// ---------------------------------------------------------------------------

/** A `date` column surfaces as an ISO-ish string; guard against a Date too. */
function dateStr(v: string | Date | null | undefined): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return typeof v === "string" ? v : "";
}
/** Four-digit fiscal year from a period boundary (e.g. "2025-01-01" -> 2025). */
function yearOf(v: string | Date | null | undefined): number {
  return Number.parseInt(dateStr(v).slice(0, 4), 10);
}
/** Month label matching the Drive/mock `monthly_pl` shape ("2025-01"). */
function monthLabel(v: string | Date | null | undefined): string {
  return dateStr(v).slice(0, 7);
}

type PeriodRow = {
  periodType: string;
  periodStart: string;
  periodEnd: string;
  revenue: string | null;
  cogs: string | null;
  grossProfit: string | null;
  opex: string | null;
  netIncome: string | null;
  totalAssets: string | null;
  totalLiabilities: string | null;
  totalEquity: string | null;
  cashOnHand: string | null;
  accountsReceivable: string | null;
  accountsPayable: string | null;
  generatedAt: Date;
};

/**
 * ONE query: every financial_periods row for the entity (all period types),
 * joined to entities on the lower-cased slug. Callers partition by period_type
 * in memory so a single endpoint never fans out into per-period queries.
 */
async function fetchEntityPeriods(coreSlug: string): Promise<PeriodRow[]> {
  return db
    .select({
      periodType: financialPeriodsTable.periodType,
      periodStart: financialPeriodsTable.periodStart,
      periodEnd: financialPeriodsTable.periodEnd,
      revenue: financialPeriodsTable.revenue,
      cogs: financialPeriodsTable.cogs,
      grossProfit: financialPeriodsTable.grossProfit,
      opex: financialPeriodsTable.opex,
      netIncome: financialPeriodsTable.netIncome,
      totalAssets: financialPeriodsTable.totalAssets,
      totalLiabilities: financialPeriodsTable.totalLiabilities,
      totalEquity: financialPeriodsTable.totalEquity,
      cashOnHand: financialPeriodsTable.cashOnHand,
      accountsReceivable: financialPeriodsTable.accountsReceivable,
      accountsPayable: financialPeriodsTable.accountsPayable,
      generatedAt: financialPeriodsTable.generatedAt,
    })
    .from(financialPeriodsTable)
    .innerJoin(entitiesTable, eq(entitiesTable.id, financialPeriodsTable.entityId))
    .where(eq(entitiesTable.slug, coreSlug));
}

function toMonthlyPl(r: PeriodRow): MonthlyPL {
  return {
    month: monthLabel(r.periodStart),
    revenue: num(r.revenue),
    cogs: num(r.cogs),
    gross_profit: num(r.grossProfit),
    opex: num(r.opex),
    net_income: num(r.netIncome),
  };
}

/**
 * Parse and validate raw JSONB from the `sections` column into a typed
 * CashFlowStatement. Returns null if the shape is invalid or any field
 * violates the published-data contract.
 *
 * This is the authoritative contract between the Python writer
 * (financeos_core build_semantic_layer.py) and the TypeScript reader.
 * Every field constraint here corresponds to a validation rule on the write side.
 *
 * Rules enforced (published-data reader — all totals must be finite):
 * - as_of must be a string
 * - sections must be a non-empty array (at least one section)
 * - Each section: name=string, net_cash=finite number, lines=array
 * - Each line: label=string, amount=finite number (null NOT accepted),
 *   is_subtotal=boolean
 * - Missing optional lines are acceptable (they are simply absent from the array)
 * - net_cash_change must be a finite number (null/undefined/NaN/Inf all rejected:
 *   a published row always has a reconciled net change)
 * - cash_at_end must be a finite number (same reasoning as net_cash_change)
 */
export function parseCashFlowSectionsJson(raw: unknown): CashFlowStatement | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.as_of !== "string") return null;
  if (!Array.isArray(obj.sections) || obj.sections.length === 0) return null;

  // net_cash_change and cash_at_end must be finite numbers for published rows.
  // null, undefined, NaN, and Infinity are all invalid here.
  const netCashChange = obj.net_cash_change;
  if (!Number.isFinite(netCashChange)) return null;

  const cashAtEnd = obj.cash_at_end;
  if (!Number.isFinite(cashAtEnd)) return null;

  const sections: import("./types").CashFlowSection[] = [];
  for (const s of obj.sections) {
    if (!s || typeof s !== "object" || Array.isArray(s)) return null;
    const sec = s as Record<string, unknown>;
    if (typeof sec.name !== "string") return null;
    if (!Number.isFinite(sec.net_cash)) return null;
    if (!Array.isArray(sec.lines)) return null;

    const lines: import("./types").CashFlowLine[] = [];
    for (const l of sec.lines) {
      if (!l || typeof l !== "object" || Array.isArray(l)) return null;
      const line = l as Record<string, unknown>;
      if (typeof line.label !== "string") return null;
      // amount must be a finite number — null is not valid per TypeScript type
      if (!Number.isFinite(line.amount)) return null;
      if (typeof line.is_subtotal !== "boolean") return null;
      lines.push({
        label:       line.label,
        amount:      line.amount as number,
        is_subtotal: line.is_subtotal,
      });
    }
    sections.push({ name: sec.name, lines, net_cash: sec.net_cash as number });
  }

  return {
    as_of:           obj.as_of,
    sections,
    net_cash_change: netCashChange as number,
    cash_at_end:     cashAtEnd as number,
  };
}

/**
 * Latest Cash Flow statement for an entity, read from cash_flow_statements.
 * Returns null if no statement has been published for this entity yet,
 * or if the stored JSONB does not pass contract validation.
 *
 * Eligible rows must have:
 *   validation_status = 'passed'   — all 15 Python validation checks passed
 *   publication_status = 'published' — publication gate cleared
 * Invalid, blocked, skipped, or unpublished rows are never returned.
 *
 * The most recent eligible statement (by period_end DESC) is selected.
 */
export async function getCashFlowFromNeon(entityId: string): Promise<CashFlowStatement | null> {
  const rows = await db
    .select()
    .from(cashFlowStatementsTable)
    .where(
      and(
        eq(cashFlowStatementsTable.entityId, entityId),
        eq(cashFlowStatementsTable.validationStatus, "passed"),
        eq(cashFlowStatementsTable.publicationStatus, "published"),
      ),
    )
    .orderBy(desc(cashFlowStatementsTable.periodEnd))
    .limit(1);

  if (rows.length === 0) return null;

  return parseCashFlowSectionsJson(rows[0].sections);
}

/**
 * Current-year financials for an entity, read from financial_periods:
 *   - monthly_pl  : the current fiscal year's `monthly` rows (asc by period)
 *   - ytd_summary : the current `ytd` row (read directly, NOT re-summed)
 *   - balance_sheet: aggregate totals from the same `ytd` row
 *   - cash_flow   : latest published Cash Flow statement from cash_flow_statements
 */
export async function getEntityFinancialsFromNeon(
  slug: EntitySlug,
  asOf: string,
): Promise<FinancialsData> {
  const coreSlug = slug.toLowerCase();
  const [rows, entityRows] = await Promise.all([
    fetchEntityPeriods(coreSlug),
    db.select({ id: entitiesTable.id })
      .from(entitiesTable)
      .where(eq(entitiesTable.slug, coreSlug))
      .limit(1),
  ]);
  if (rows.length === 0) {
    throw new Error(`Neon has no financial_periods for "${slug}" (core slug "${coreSlug}")`);
  }
  const entityId = entityRows[0]?.id ?? null;

  // The authoritative current-period roll-up. Pick the latest ytd row by
  // period_end (Core may retain more than one over time).
  const ytdRow = rows
    .filter((r) => r.periodType === "ytd")
    .sort((a, b) => dateStr(a.periodEnd).localeCompare(dateStr(b.periodEnd)))
    .at(-1);
  if (!ytdRow) {
    throw new Error(`Neon has no YTD financial_period for "${slug}"`);
  }
  const currentYear = yearOf(ytdRow.periodStart);

  const monthly_pl = rows
    .filter((r) => r.periodType === "monthly" && yearOf(r.periodStart) === currentYear)
    .sort((a, b) => dateStr(a.periodStart).localeCompare(dateStr(b.periodStart)))
    .map(toMonthlyPl);

  const ytd_summary = {
    revenue: num(ytdRow.revenue),
    cogs: num(ytdRow.cogs),
    gross_profit: num(ytdRow.grossProfit),
    opex: num(ytdRow.opex),
    net_income: num(ytdRow.netIncome),
  };

  // financial_periods carries only balance-sheet TOTALS plus cash/AR/AP; the
  // line-item breakdown (prepaid, equipment, accrued, deferred, notes payable,
  // paid-in capital, retained earnings) is not modeled, so those stay 0 while
  // every total is read straight from Core.
  const balance_sheet: BalanceSheet = {
    as_of: asOf,
    assets: {
      cash: num(ytdRow.cashOnHand),
      accounts_receivable: num(ytdRow.accountsReceivable),
      prepaid_expenses: 0,
      equipment_net: 0,
      total: num(ytdRow.totalAssets),
    },
    liabilities: {
      accounts_payable: num(ytdRow.accountsPayable),
      accrued_liabilities: 0,
      deferred_revenue: 0,
      notes_payable: 0,
      total: num(ytdRow.totalLiabilities),
    },
    equity: {
      paid_in_capital: 0,
      retained_earnings: 0,
      total: num(ytdRow.totalEquity),
    },
  };

  const cash_flow = entityId ? await getCashFlowFromNeon(entityId) : null;

  return {
    entity_slug: slug,
    as_of: asOf,
    monthly_pl,
    ytd_summary,
    balance_sheet,
    cash_flow,
  };
}

/**
 * Prior-fiscal-year history for an entity, read from financial_periods. Each
 * completed prior year is represented by an `annual` row (its summary + balance
 * sheet come directly from that row — never recomputed); its `monthly` rows
 * populate monthly_pl. Years >= the current fiscal year are excluded so this
 * mirrors the Drive path (prior years only). No prior annual rows -> empty list.
 */
export async function getEntityHistoryFromNeon(slug: EntitySlug): Promise<EntityHistoryData> {
  const coreSlug = slug.toLowerCase();
  const rows = await fetchEntityPeriods(coreSlug);

  const ytdYears = rows.filter((r) => r.periodType === "ytd").map((r) => yearOf(r.periodStart));
  const monthlyYears = rows
    .filter((r) => r.periodType === "monthly")
    .map((r) => yearOf(r.periodStart));
  const currentYear = ytdYears.length
    ? Math.max(...ytdYears)
    : monthlyYears.length
      ? Math.max(...monthlyYears)
      : new Date().getFullYear();

  const prior_years: PriorYearHistory[] = rows
    .filter((r) => r.periodType === "annual" && yearOf(r.periodStart) < currentYear)
    .sort((a, b) => yearOf(a.periodStart) - yearOf(b.periodStart))
    .map((annual) => {
      const fiscalYear = yearOf(annual.periodStart);
      const monthly_pl = rows
        .filter((r) => r.periodType === "monthly" && yearOf(r.periodStart) === fiscalYear)
        .sort((a, b) => dateStr(a.periodStart).localeCompare(dateStr(b.periodStart)))
        .map(toMonthlyPl);
      const summary = {
        revenue: num(annual.revenue),
        cogs: num(annual.cogs),
        gross_profit: num(annual.grossProfit),
        opex: num(annual.opex),
        net_income: num(annual.netIncome),
      };
      const balance_sheet: PriorYearBalanceSheetSummary = {
        as_of: dateStr(annual.periodEnd),
        cash: num(annual.cashOnHand),
        total_assets: num(annual.totalAssets),
        total_liabilities: num(annual.totalLiabilities),
        total_equity: num(annual.totalEquity),
      };
      return { fiscal_year: fiscalYear, monthly_pl, summary, balance_sheet };
    });

  return { entity_slug: slug, prior_years };
}

// ---------------------------------------------------------------------------
// Sprint 8: customers (AR), vendors (AP) and banking read from Core's base
// tables (invoices / bills / accounts / transactions) plus the KPI columns of
// financial_periods. Read-only, never recomputed:
//   - Headline KPIs (open_ar, open_ap, total_cash) and the DSO/AP trend series
//     are read straight from financial_periods columns Core already produces.
//   - Presentation lists that Core does NOT publish (aging buckets, top
//     customer/vendor lists, per-account balances, transaction summaries) are
//     the only derived values, grouped in memory from the base rows.
// Anything Core does not model (last payment date, per-account reconciliation
// metadata, signed transaction direction) is reported as empty/unsigned rather
// than fabricated. Each function issues a small fixed number of queries (no
// N+1). If Core has no financial_periods for the entity the function throws so
// the caller can fall through to the Drive path.
// ---------------------------------------------------------------------------

/** Integer column (`days_overdue`) surfaces as number|null — coerce to number. */
function int(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** The five fixed aging buckets, in the exact order and labels the frontend
 * AgingTable / entity pages expect (they index buckets positionally, treating
 * index >= 2 as "overdue"). Never reorder or rename. */
const AGING_BUCKETS: { label: string; days: string }[] = [
  { label: "Current", days: "0" },
  { label: "1–30 days", days: "1-30" },
  { label: "31–60 days", days: "31-60" },
  { label: "61–90 days", days: "61-90" },
  { label: "90+ days", days: "90+" },
];

/** Map a Core `days_overdue` (negative = not yet due) to a fixed bucket index. */
function agingIndex(daysOverdue: number): number {
  if (daysOverdue <= 0) return 0;
  if (daysOverdue <= 30) return 1;
  if (daysOverdue <= 60) return 2;
  if (daysOverdue <= 90) return 3;
  return 4;
}

/** Bucket open AR/AP rows into the five fixed aging buckets (always all five,
 * zero-filled), matching the mock/Drive presentation shape. */
function buildAging(rows: { balance: number; daysOverdue: number }[]): AgingBucket[] {
  const buckets = AGING_BUCKETS.map((b) => ({ label: b.label, days: b.days, amount: 0, count: 0 }));
  for (const r of rows) {
    if (r.balance === 0) continue;
    const b = buckets[agingIndex(r.daysOverdue)];
    if (b) {
      b.amount += r.balance;
      b.count += 1;
    }
  }
  return buckets;
}

/** Latest YTD financial_periods row (Core's authoritative current roll-up). */
function latestYtd<T extends { periodType: string; periodEnd: string }>(rows: T[]): T | undefined {
  return rows
    .filter((r) => r.periodType === "ytd")
    .sort((a, b) => dateStr(a.periodEnd).localeCompare(dateStr(b.periodEnd)))
    .at(-1);
}

/** Trailing 12 monthly values of a KPI column (chronological), read straight
 * from financial_periods — Core produces these, we never recompute them. */
function trailingMonthly(
  rows: { periodType: string; periodStart: string }[],
  pick: (r: KpiPeriodRow) => number,
): number[] {
  return (rows as KpiPeriodRow[])
    .filter((r) => r.periodType === "monthly")
    .sort((a, b) => dateStr(a.periodStart).localeCompare(dateStr(b.periodStart)))
    .map(pick)
    .slice(-12);
}

type KpiPeriodRow = {
  periodType: string;
  periodStart: string;
  periodEnd: string;
  openAr: string | null;
  openAp: string | null;
  dsoDays: string | null;
  cashOnHand: string | null;
};

/** ONE query: the AR/AP/cash KPI columns of every financial_periods row for the
 * entity. Callers partition by period_type in memory (no N+1). */
async function fetchEntityKpiPeriods(coreSlug: string): Promise<KpiPeriodRow[]> {
  return db
    .select({
      periodType: financialPeriodsTable.periodType,
      periodStart: financialPeriodsTable.periodStart,
      periodEnd: financialPeriodsTable.periodEnd,
      openAr: financialPeriodsTable.openAr,
      openAp: financialPeriodsTable.openAp,
      dsoDays: financialPeriodsTable.dsoDays,
      cashOnHand: financialPeriodsTable.cashOnHand,
    })
    .from(financialPeriodsTable)
    .innerJoin(entitiesTable, eq(entitiesTable.id, financialPeriodsTable.entityId))
    .where(eq(entitiesTable.slug, coreSlug));
}

/**
 * Customers / AR view for an entity, read from Core.
 *   - open_ar    : the current YTD `open_ar` KPI (read, not recomputed)
 *   - top_customers : Core's authoritative per-customer `customers.balance`
 *                     (summed across nonzero rows this reconciles to open_ar;
 *                     invoice-level sums do NOT, because Core nets credits and
 *                     excludes not-yet-due invoices from a customer's balance)
 *   - aging      : each customer's full balance placed in the fixed bucket for
 *                  their worst open-invoice days_overdue (derived presentation;
 *                  Core publishes no per-customer aging breakdown). This keeps
 *                  the aging total tied to the same authoritative balances.
 *   - dso_history: trailing 12 monthly `dso_days` values from Core
 * dso_days per customer = worst days_overdue across their open invoices; status
 * mirrors the Drive path (>60 late, >0 overdue, else current). Core has no
 * payments table, so `last_payment_date` is reported empty.
 */
export async function getEntityCustomersFromNeon(
  slug: EntitySlug,
  asOf: string,
): Promise<CustomersData> {
  const coreSlug = slug.toLowerCase();
  const [periods, customerRows, openInvoices] = await Promise.all([
    fetchEntityKpiPeriods(coreSlug),
    db
      .select({
        id: customersTable.id,
        displayName: customersTable.displayName,
        balance: customersTable.balance,
      })
      .from(customersTable)
      .innerJoin(entitiesTable, eq(entitiesTable.id, customersTable.entityId))
      .where(eq(entitiesTable.slug, coreSlug)),
    // Open invoices supply only the days_overdue signal (joined by customer_id);
    // their balances are NOT summed for AR — customers.balance is authoritative.
    db
      .select({
        customerId: invoicesTable.customerId,
        balance: invoicesTable.balance,
        daysOverdue: invoicesTable.daysOverdue,
      })
      .from(invoicesTable)
      .innerJoin(entitiesTable, eq(entitiesTable.id, invoicesTable.entityId))
      .where(and(eq(entitiesTable.slug, coreSlug), eq(invoicesTable.isDeleted, false))),
  ]);
  if (periods.length === 0) {
    throw new Error(`Neon has no financial_periods for "${slug}" (core slug "${coreSlug}")`);
  }

  // Worst (max) days_overdue per customer across their OPEN (nonzero) invoices.
  const worstDaysByCustomer = new Map<string, number>();
  for (const r of openInvoices) {
    if (!r.customerId || num(r.balance) === 0) continue;
    const d = int(r.daysOverdue);
    const prev = worstDaysByCustomer.get(r.customerId);
    if (prev === undefined || d > prev) worstDaysByCustomer.set(r.customerId, d);
  }

  const customers = customerRows
    .map((c) => ({
      name: (c.displayName ?? "").trim() || "Unknown",
      balance: num(c.balance),
      // No matching open invoice → no overdue signal → treat as current.
      worstDays: worstDaysByCustomer.get(c.id) ?? 0,
    }))
    .filter((c) => c.balance !== 0);

  // Aging: bucket each customer's full authoritative balance by their worst
  // days_overdue, so the aging total tracks the same balances behind open_ar.
  const aging = buildAging(
    customers.map((c) => ({ balance: c.balance, daysOverdue: c.worstDays })),
  );

  const top_customers: Customer[] = customers
    .map((c): Customer => ({
      name: c.name,
      balance: c.balance,
      last_payment_date: "",
      dso_days: Math.max(0, c.worstDays),
      status: c.worstDays > 60 ? "late" : c.worstDays > 0 ? "overdue" : "current",
    }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  const ytd = latestYtd(periods);
  if (!ytd) {
    throw new Error(`Neon has no YTD financial_periods for "${slug}" (core slug "${coreSlug}")`);
  }
  const open_ar = num(ytd.openAr);
  const dso_history = trailingMonthly(periods, (r) => num(r.dsoDays));

  const ar_overdue = aging
    .filter((b) => b.label !== "Current")
    .reduce((sum, b) => sum + b.amount, 0);
  const ar_overdue_pct = open_ar > 0 ? (ar_overdue / open_ar) * 100 : 0;

  return {
    entity_slug: slug,
    as_of: asOf,
    open_ar,
    ar_overdue,
    ar_overdue_pct,
    aging,
    aging_source: "invoices",
    top_customers,
    dso_history,
  };
}

/**
 * Vendors / AP view for an entity, read from Core.
 *   - open_ap    : the current YTD `open_ap` KPI (read, not recomputed)
 *   - aging      : five fixed buckets derived from OPEN bills by days_overdue
 *   - top_vendors: per-vendor roll-up of open-bill balances (derived)
 *   - ap_history : trailing 12 monthly `open_ap` values from Core
 */
export async function getEntityVendorsFromNeon(
  slug: EntitySlug,
  asOf: string,
): Promise<VendorsData> {
  const coreSlug = slug.toLowerCase();
  const [periods, openBills] = await Promise.all([
    fetchEntityKpiPeriods(coreSlug),
    db
      .select({
        vendorName: billsTable.vendorName,
        balance: billsTable.balance,
        daysOverdue: billsTable.daysOverdue,
        dueDate: billsTable.dueDate,
      })
      .from(billsTable)
      .innerJoin(entitiesTable, eq(entitiesTable.id, billsTable.entityId))
      .where(and(eq(entitiesTable.slug, coreSlug), eq(billsTable.isDeleted, false))),
  ]);
  if (periods.length === 0) {
    throw new Error(`Neon has no financial_periods for "${slug}" (core slug "${coreSlug}")`);
  }

  const open = openBills
    .map((r) => ({
      name: (r.vendorName ?? "").trim() || "Unknown",
      balance: num(r.balance),
      daysOverdue: int(r.daysOverdue),
      dueDate: dateStr(r.dueDate),
    }))
    .filter((r) => r.balance !== 0);

  const aging = buildAging(open);

  const byVendor = new Map<string, { balance: number; maxDays: number; dueDate: string }>();
  for (const r of open) {
    const v = byVendor.get(r.name) ?? { balance: 0, maxDays: Number.NEGATIVE_INFINITY, dueDate: r.dueDate };
    v.balance += r.balance;
    v.maxDays = Math.max(v.maxDays, r.daysOverdue);
    // Keep the earliest upcoming due date for display.
    if (r.dueDate && (!v.dueDate || r.dueDate < v.dueDate)) v.dueDate = r.dueDate;
    byVendor.set(r.name, v);
  }
  const top_vendors: Vendor[] = [...byVendor.entries()]
    .map(([name, v]): Vendor => ({
      name,
      balance: v.balance,
      due_date: v.dueDate,
      status: v.maxDays > 0 ? "overdue" : "current",
    }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);

  const ytd = latestYtd(periods);
  if (!ytd) {
    throw new Error(`Neon has no YTD financial_periods for "${slug}" (core slug "${coreSlug}")`);
  }
  const open_ap = num(ytd.openAp);
  const ap_history = trailingMonthly(periods, (r) => num(r.openAp));

  return { entity_slug: slug, as_of: asOf, open_ap, aging, top_vendors, ap_history };
}

/** Extract a 4-digit account suffix from a QBO account name, e.g.
 * "Mercury Checking (7627) - 1" -> "7627" and "Chase 000000957561878" ->
 * "1878". Uses the LAST four digits of the longest digit run (the account
 * number) so long embedded numbers don't yield their leading zeros. Empty when
 * the name has no 4+ digit run. */
function parseLastFour(name: string): string {
  const groups = name.match(/\d{4,}/g);
  if (!groups || groups.length === 0) return "";
  const longest = groups.reduce((a, b) => (b.length >= a.length ? b : a));
  return longest.slice(-4);
}

/** Derive a human institution label from a QBO account name by stripping any
 * account-number runs ("(7627)", "000000957561878") and a trailing "- N"
 * duplicate marker: "Mercury Checking (7627) - 1" -> "Mercury Checking",
 * "Chase 000000957561878" -> "Chase". Falls back to the trimmed name if
 * stripping leaves nothing. */
function parseInstitution(name: string): string {
  const stripped = name
    .replace(/\(\s*\d{3,}\s*\)/g, "")
    .replace(/\s*-\s*\d+\s*$/g, "")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || name.trim();
}

/**
 * Banking view for an entity, read from Core.
 *   - total_cash : the current YTD `cash_on_hand` KPI (read, not recomputed)
 *   - accounts   : rows from `accounts` where account_type = 'Bank' (derived
 *                  presentation of per-account balances)
 *   - transactions : the 50 most-recent `transactions` rows (derived summary)
 * Core does not model per-account reconciliation metadata, so `reconciled`
 * mirrors the Drive path's `is_active` proxy and `color`/`last_reconciled` are
 * reported empty. `transactions.amount` is Core's stored unsigned magnitude.
 */
export async function getEntityBankingFromNeon(
  slug: EntitySlug,
  asOf: string,
): Promise<BankingData> {
  const coreSlug = slug.toLowerCase();
  const [periods, bankAccounts, recentTxns, txnStats] = await Promise.all([
    fetchEntityKpiPeriods(coreSlug),
    db
      .select({
        id: accountsTable.id,
        name: accountsTable.name,
        accountType: accountsTable.accountType,
        accountSubtype: accountsTable.accountSubtype,
        currentBalance: accountsTable.currentBalance,
        isActive: accountsTable.isActive,
      })
      .from(accountsTable)
      .innerJoin(entitiesTable, eq(entitiesTable.id, accountsTable.entityId))
      .where(and(eq(entitiesTable.slug, coreSlug), eq(accountsTable.accountType, "Bank"))),
    db
      .select({
        id: transactionsTable.id,
        accountId: transactionsTable.accountId,
        transactionDate: transactionsTable.transactionDate,
        transactionType: transactionsTable.transactionType,
        amount: transactionsTable.amount,
        accountName: transactionsTable.accountName,
        memo: transactionsTable.memo,
        category: transactionsTable.category,
        isReconciled: transactionsTable.isReconciled,
      })
      .from(transactionsTable)
      .innerJoin(entitiesTable, eq(entitiesTable.id, transactionsTable.entityId))
      .where(and(eq(entitiesTable.slug, coreSlug), eq(transactionsTable.isDeleted, false)))
      .orderBy(desc(transactionsTable.transactionDate))
      .limit(50),
    // Per-account activity summary across ALL (non-deleted) transactions, not
    // just the 50 most-recent shown above. Used by the frontend to hide dead /
    // placeholder accounts and collapse inactive ones. Read-only aggregate.
    db
      .select({
        accountId: transactionsTable.accountId,
        count: sql<number>`count(*)::int`,
        lastDate: sql<string | null>`max(${transactionsTable.transactionDate})`,
      })
      .from(transactionsTable)
      .innerJoin(entitiesTable, eq(entitiesTable.id, transactionsTable.entityId))
      .where(and(eq(entitiesTable.slug, coreSlug), eq(transactionsTable.isDeleted, false)))
      .groupBy(transactionsTable.accountId),
  ]);
  const ytd = latestYtd(periods);
  if (!ytd) {
    throw new Error(`Neon has no YTD financial_periods for "${slug}" (core slug "${coreSlug}")`);
  }

  const statsByAccount = new Map<string, { count: number; lastDate: string | null }>();
  for (const s of txnStats) {
    if (s.accountId) {
      statsByAccount.set(s.accountId, { count: Number(s.count) || 0, lastDate: s.lastDate });
    }
  }

  const accounts: BankAccount[] = bankAccounts.map((a): BankAccount => {
    const name = (a.name ?? "").trim();
    const stat = statsByAccount.get(a.id);
    return {
      id: a.id,
      name,
      institution: parseInstitution(name),
      account_type: (a.accountSubtype ?? a.accountType ?? "").trim(),
      last_four: parseLastFour(name),
      balance: num(a.currentBalance),
      // Core does not publish an account brand colour or reconciliation date.
      color: "",
      reconciled: Boolean(a.isActive),
      last_reconciled: "",
      transaction_count: stat?.count ?? 0,
      last_transaction_date: stat?.lastDate ? dateStr(stat.lastDate) : "",
    };
  });

  const transactions: BankTransaction[] = recentTxns.map((t): BankTransaction => ({
    id: t.id,
    account_id: t.accountId ?? "",
    date: dateStr(t.transactionDate),
    description: (t.memo ?? "").trim() || (t.accountName ?? "").trim() || (t.transactionType ?? "").trim(),
    // Core stores an unsigned magnitude; direction lives in transaction_type.
    amount: num(t.amount),
    category: (t.category ?? t.transactionType ?? "").trim(),
    reconciled: Boolean(t.isReconciled),
  }));

  const total_cash = num(ytd.cashOnHand);

  // Core does not track transaction-level reconciliation, so reconciliation
  // status mirrors the Drive path: derived from the account `is_active` proxy.
  const unreconciled_count = accounts.filter((a) => !a.reconciled).length;
  const reconciliation_status: BankingData["reconciliation_status"] =
    unreconciled_count === 0 ? "clean" : unreconciled_count > 2 ? "needs_review" : "pending";

  return {
    entity_slug: slug,
    as_of: asOf,
    total_cash,
    reconciliation_status,
    unreconciled_count,
    accounts,
    transactions,
  };
}

// ─── Alerts (Sprint 10) ─────────────────────────────────────────────────────
// Read business alerts from FinanceOS Core's `alerts` table. The Dashboard
// NEVER calculates alerts — it only projects Core's rows into the existing Alert
// shape the frontend already renders (Operations Inbox / AI). Read-only; no
// Drive/mock fallback (Core is the sole source of truth for alerts).

type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
type AlertCategory =
  | "receivables"
  | "payables"
  | "cash"
  | "revenue"
  | "validation"
  | "portfolio";
type AlertStatus = "open" | "acknowledged" | "resolved";

export type CoreAlert = {
  id: string;
  ruleId: string;
  entity: string;
  entitySlug: string | null;
  scope: "entity" | "portfolio";
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  recommendedAction: string;
  createdAt: string;
  status: AlertStatus;
};

// Core `alert_type` → the frontend's fixed AlertCategory enum. Unknown types
// fall back by prefix, then to "validation", so a new Core rule never breaks
// the typed UI (categories drive Operations Inbox type/href mapping).
const ALERT_CATEGORY_BY_TYPE: Record<string, AlertCategory> = {
  cash_negative: "cash",
  ar_overdue_critical: "receivables",
  dso_elevated: "receivables",
  ap_overdue_high: "payables",
  revenue_decline_mom: "revenue",
  net_loss_annual: "revenue",
  negative_assets: "validation",
  negative_equity: "validation",
};

function alertCategory(alertType: string): AlertCategory {
  const known = ALERT_CATEGORY_BY_TYPE[alertType];
  if (known) return known;
  if (alertType.startsWith("ar_") || alertType.startsWith("dso")) return "receivables";
  if (alertType.startsWith("ap_")) return "payables";
  if (alertType.startsWith("cash")) return "cash";
  if (alertType.startsWith("revenue") || alertType.startsWith("net_")) return "revenue";
  return "validation";
}

const SEVERITY_SET = new Set<AlertSeverity>(["critical", "high", "medium", "low", "info"]);
function alertSeverity(s: string): AlertSeverity {
  return SEVERITY_SET.has(s as AlertSeverity) ? (s as AlertSeverity) : "medium";
}

const STATUS_SET = new Set<AlertStatus>(["open", "acknowledged", "resolved"]);
function alertStatus(s: string): AlertStatus {
  return STATUS_SET.has(s as AlertStatus) ? (s as AlertStatus) : "open";
}

// Core has no `recommendation` column; provide a stable, category-based label
// for the Operations Inbox action button. This is presentation formatting, not
// alert calculation.
const ACTION_BY_CATEGORY: Record<AlertCategory, string> = {
  receivables: "Review AR aging",
  payables: "Review vendor bills",
  cash: "Review cash position",
  revenue: "Review revenue trend",
  validation: "Review financials",
  portfolio: "Review portfolio",
};

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/**
 * All alerts from Core, projected into the frontend Alert shape and sorted by
 * severity (critical → info). `entity` is Core's display_name (which matches the
 * Dashboard's ENTITY_CONFIG names), so the frontend name→slug mapping resolves.
 */
export async function getAlertsFromNeon(): Promise<CoreAlert[]> {
  const rows = await db
    .select({
      id: alertsTable.id,
      entityId: alertsTable.entityId,
      entitySlug: entitiesTable.slug,
      displayName: entitiesTable.displayName,
      alertType: alertsTable.alertType,
      severity: alertsTable.severity,
      status: alertsTable.status,
      title: alertsTable.title,
      message: alertsTable.message,
      firstSeenAt: alertsTable.firstSeenAt,
    })
    .from(alertsTable)
    .leftJoin(entitiesTable, eq(entitiesTable.id, alertsTable.entityId));

  const mapped: CoreAlert[] = rows.map((r) => {
    const category = alertCategory(r.alertType);
    const scope: CoreAlert["scope"] = r.entityId ? "entity" : "portfolio";
    return {
      id: r.id,
      ruleId: r.alertType,
      entity: r.displayName ?? "Portfolio",
      entitySlug: r.entitySlug ?? null,
      scope,
      severity: alertSeverity(r.severity),
      category,
      title: r.title,
      description: r.message,
      recommendedAction: ACTION_BY_CATEGORY[category],
      createdAt:
        r.firstSeenAt instanceof Date ? r.firstSeenAt.toISOString() : String(r.firstSeenAt),
      status: alertStatus(r.status),
    };
  });

  mapped.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return mapped;
}
