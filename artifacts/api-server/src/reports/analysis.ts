/**
 * Report Analysis Generator.
 *
 * Produces deterministic, traceable FinanceOS Analysis statements from a
 * BuiltReport. Every statement carries full provenance so the preview editor
 * can surface "Why am I seeing this?" information to the user.
 *
 * STRICT RULES:
 * - Never invent an operational cause. If the cause is unknown: say so.
 * - Never convert null to 0. Null metrics are omitted or flagged explicitly.
 * - Negative values remain negative (parentheses in display, minus sign in prose).
 * - Only compare periods when both values are non-null.
 * - Only produce causal statements when the cause came from Management Commentary.
 */

import type { BuiltReport } from "./builder.js";
import { createHash } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnalysisProvenance = {
  metric: string;
  currentValue: number | null;
  currentLabel: string;
  comparisonValue: number | null;
  comparisonLabel: string;
  formula: string;
  reportingPeriod: string;
  comparisonPeriod: string | null;
  entitySlugs: string[];
  sourceTable: string;
  generatedAt: string;
};

export type AnalysisStatement = {
  id: string;
  sectionKey: string;
  commentaryType: "financeos_analysis";
  content: string;
  provenance: AnalysisProvenance;
  sortOrder: number;
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCurrency(n: number | null): string {
  if (n === null || n === undefined) return "N/A";
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  return n < 0 ? `(${formatted})` : formatted;
}

function formatPct(n: number | null): string {
  if (n === null || n === undefined) return "N/A";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function calcPctChange(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function directionWord(pct: number): string {
  return pct >= 0 ? "increased" : "declined";
}

function generateId(sectionKey: string, metric: string, entitySlug: string): string {
  const raw = `${sectionKey}:${metric}:${entitySlug}:${Date.now()}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

// ─── Per-section generators ───────────────────────────────────────────────────

function analyzeEntityRevenue(
  slug: string,
  metrics: Record<string, unknown> | null,
  financials: Record<string, unknown> | null,
  period: string,
  sortBase: number,
): AnalysisStatement[] {
  const statements: AnalysisStatement[] = [];
  if (!metrics && !financials) return statements;

  const now = new Date().toISOString();

  // Revenue
  const revenue = (metrics as any)?.revenue ?? (financials as any)?.revenue ?? null;
  const revenueGrowth = (metrics as any)?.revenue_growth_pct ?? null;
  const priorRevenue =
    revenue !== null && revenueGrowth !== null && revenueGrowth !== 0
      ? revenue / (1 + revenueGrowth / 100)
      : null;

  if (revenue !== null) {
    const pct = calcPctChange(revenue, priorRevenue);
    const content =
      pct !== null
        ? `Revenue was ${formatCurrency(revenue)}, ${directionWord(pct)} ${Math.abs(pct).toFixed(1)}% from the prior period (${formatCurrency(priorRevenue)}).`
        : `Revenue was ${formatCurrency(revenue)} for the reporting period. No prior period comparison is available.`;

    statements.push({
      id: generateId("entity_performance", "revenue", slug),
      sectionKey: "entity_performance",
      commentaryType: "financeos_analysis",
      content,
      provenance: {
        metric: "revenue",
        currentValue: revenue,
        currentLabel: formatCurrency(revenue),
        comparisonValue: priorRevenue,
        comparisonLabel: formatCurrency(priorRevenue),
        formula: pct !== null ? "(current − prior) / |prior| × 100" : "N/A",
        reportingPeriod: period,
        comparisonPeriod: "prior period",
        entitySlugs: [slug],
        sourceTable: "entity_metrics / financial_periods",
        generatedAt: now,
      },
      sortOrder: sortBase,
    });
  }

  // Net income
  const netIncome = (metrics as any)?.net_income ?? (financials as any)?.net_income ?? null;
  const netMargin = (metrics as any)?.net_margin_pct ?? null;

  if (netIncome !== null) {
    const marginText = netMargin !== null ? ` (${netMargin.toFixed(1)}% net margin)` : "";
    const positive = netIncome >= 0;
    const content = positive
      ? `Net income was ${formatCurrency(netIncome)}${marginText}.`
      : `Net income was a loss of ${formatCurrency(Math.abs(netIncome))}${marginText}. The underlying operational cause is not available in FinanceOS.`;

    statements.push({
      id: generateId("entity_performance", "net_income", slug),
      sectionKey: "entity_performance",
      commentaryType: "financeos_analysis",
      content,
      provenance: {
        metric: "net_income",
        currentValue: netIncome,
        currentLabel: formatCurrency(netIncome),
        comparisonValue: null,
        comparisonLabel: "N/A",
        formula: "Revenue − Total Expenses",
        reportingPeriod: period,
        comparisonPeriod: null,
        entitySlugs: [slug],
        sourceTable: "entity_metrics / financial_periods",
        generatedAt: now,
      },
      sortOrder: sortBase + 1,
    });
  }

  // Cash position
  const cashOnHand = (metrics as any)?.cash_on_hand ?? null;
  if (cashOnHand !== null) {
    const content =
      cashOnHand < 0
        ? `Cash position is ${formatCurrency(cashOnHand)}, indicating a negative balance. The underlying cause is not available in FinanceOS.`
        : `Cash on hand is ${formatCurrency(cashOnHand)}.`;

    statements.push({
      id: generateId("cash_and_liquidity", "cash_on_hand", slug),
      sectionKey: "cash_and_liquidity",
      commentaryType: "financeos_analysis",
      content,
      provenance: {
        metric: "cash_on_hand",
        currentValue: cashOnHand,
        currentLabel: formatCurrency(cashOnHand),
        comparisonValue: null,
        comparisonLabel: "N/A",
        formula: "Sum of bank account balances",
        reportingPeriod: period,
        comparisonPeriod: null,
        entitySlugs: [slug],
        sourceTable: "entity_metrics",
        generatedAt: now,
      },
      sortOrder: sortBase + 2,
    });
  }

  // AR
  const arOpen = (metrics as any)?.open_ar ?? null;
  if (arOpen !== null) {
    const content = `Open accounts receivable balance is ${formatCurrency(arOpen)}.`;
    statements.push({
      id: generateId("financial_performance", "open_ar", slug),
      sectionKey: "financial_performance",
      commentaryType: "financeos_analysis",
      content,
      provenance: {
        metric: "open_ar",
        currentValue: arOpen,
        currentLabel: formatCurrency(arOpen),
        comparisonValue: null,
        comparisonLabel: "N/A",
        formula: "Sum of outstanding invoice balances",
        reportingPeriod: period,
        comparisonPeriod: null,
        entitySlugs: [slug],
        sourceTable: "invoices",
        generatedAt: now,
      },
      sortOrder: sortBase + 3,
    });
  }

  return statements;
}

function analyzePortfolioKpis(
  portfolio: Record<string, unknown> | null,
  period: string,
): AnalysisStatement[] {
  const statements: AnalysisStatement[] = [];
  if (!portfolio) return statements;

  const now = new Date().toISOString();

  const totalRevenue = (portfolio as any)?.total_revenue ?? null;
  const totalNetIncome = (portfolio as any)?.total_net_income ?? null;
  const entityCount = (portfolio as any)?.entity_count ?? null;

  if (totalRevenue !== null && entityCount !== null) {
    statements.push({
      id: generateId("portfolio_summary", "total_revenue", "portfolio"),
      sectionKey: "portfolio_summary",
      commentaryType: "financeos_analysis",
      content: `Portfolio total revenue for ${period} is ${formatCurrency(totalRevenue)} across ${entityCount} active ${entityCount === 1 ? "entity" : "entities"}.`,
      provenance: {
        metric: "total_revenue",
        currentValue: totalRevenue,
        currentLabel: formatCurrency(totalRevenue),
        comparisonValue: null,
        comparisonLabel: "N/A",
        formula: "Sum of entity revenues",
        reportingPeriod: period,
        comparisonPeriod: null,
        entitySlugs: ["portfolio"],
        sourceTable: "portfolio_snapshots",
        generatedAt: now,
      },
      sortOrder: 0,
    });
  }

  if (totalNetIncome !== null) {
    const positive = totalNetIncome >= 0;
    const content = positive
      ? `Portfolio net income is ${formatCurrency(totalNetIncome)}.`
      : `Portfolio net income is a loss of ${formatCurrency(Math.abs(totalNetIncome))}. Individual entity breakdowns are available in the entity sections.`;

    statements.push({
      id: generateId("portfolio_summary", "total_net_income", "portfolio"),
      sectionKey: "portfolio_summary",
      commentaryType: "financeos_analysis",
      content,
      provenance: {
        metric: "total_net_income",
        currentValue: totalNetIncome,
        currentLabel: formatCurrency(totalNetIncome),
        comparisonValue: null,
        comparisonLabel: "N/A",
        formula: "Sum of entity net incomes",
        reportingPeriod: period,
        comparisonPeriod: null,
        entitySlugs: ["portfolio"],
        sourceTable: "portfolio_snapshots",
        generatedAt: now,
      },
      sortOrder: 1,
    });
  }

  return statements;
}

function analyzeValidation(
  validation: Record<string, unknown> | null,
  period: string,
): AnalysisStatement[] {
  const statements: AnalysisStatement[] = [];
  if (!validation) return statements;

  const now = new Date().toISOString();
  const summary = (validation as any)?.summary ?? null;
  const allPassed = (summary as any)?.all_passed ?? null;

  if (allPassed === true) {
    statements.push({
      id: generateId("close_status", "validation_all_passed", "portfolio"),
      sectionKey: "close_status",
      commentaryType: "financeos_analysis",
      content: "All data validation checks passed for this reporting period.",
      provenance: {
        metric: "validation_all_passed",
        currentValue: 1,
        currentLabel: "true",
        comparisonValue: null,
        comparisonLabel: "N/A",
        formula: "All validation rules returned PASS",
        reportingPeriod: period,
        comparisonPeriod: null,
        entitySlugs: ["portfolio"],
        sourceTable: "validation_results",
        generatedAt: now,
      },
      sortOrder: 0,
    });
  } else if (allPassed === false) {
    const failCount = (summary as any)?.failed_count ?? null;
    const content = failCount !== null
      ? `${failCount} validation ${failCount === 1 ? "check" : "checks"} did not pass for this reporting period. Review the Validation section for details.`
      : "One or more validation checks did not pass for this reporting period.";

    statements.push({
      id: generateId("close_status", "validation_failed", "portfolio"),
      sectionKey: "close_status",
      commentaryType: "financeos_analysis",
      content,
      provenance: {
        metric: "validation_all_passed",
        currentValue: 0,
        currentLabel: "false",
        comparisonValue: null,
        comparisonLabel: "N/A",
        formula: "One or more validation rules returned FAIL",
        reportingPeriod: period,
        comparisonPeriod: null,
        entitySlugs: ["portfolio"],
        sourceTable: "validation_results",
        generatedAt: now,
      },
      sortOrder: 0,
    });
  }

  return statements;
}

function analyzeAlerts(
  alerts: unknown[],
  period: string,
  entitySlugs: string[],
): AnalysisStatement[] {
  const statements: AnalysisStatement[] = [];
  const now = new Date().toISOString();

  if (!alerts || alerts.length === 0) {
    statements.push({
      id: generateId("alerts_summary", "no_alerts", "portfolio"),
      sectionKey: "alerts_summary",
      commentaryType: "financeos_analysis",
      content: "No active alerts or exceptions were identified for this reporting period.",
      provenance: {
        metric: "alert_count",
        currentValue: 0,
        currentLabel: "0",
        comparisonValue: null,
        comparisonLabel: "N/A",
        formula: "COUNT(alerts WHERE status = active)",
        reportingPeriod: period,
        comparisonPeriod: null,
        entitySlugs,
        sourceTable: "alerts",
        generatedAt: now,
      },
      sortOrder: 0,
    });
  } else {
    const criticalAlerts = (alerts as any[]).filter((a) => a.severity === "critical" || a.level === "critical");
    const count = alerts.length;
    const critCount = criticalAlerts.length;

    const content = critCount > 0
      ? `${count} active ${count === 1 ? "alert" : "alerts"} identified for this period, including ${critCount} critical. Review the Exceptions section for details.`
      : `${count} active ${count === 1 ? "alert" : "alerts"} identified for this period. No critical alerts. Review the Exceptions section for details.`;

    statements.push({
      id: generateId("alerts_summary", "active_alerts", "portfolio"),
      sectionKey: "alerts_summary",
      commentaryType: "financeos_analysis",
      content,
      provenance: {
        metric: "alert_count",
        currentValue: count,
        currentLabel: String(count),
        comparisonValue: null,
        comparisonLabel: "N/A",
        formula: "COUNT(alerts WHERE status = active)",
        reportingPeriod: period,
        comparisonPeriod: null,
        entitySlugs,
        sourceTable: "alerts",
        generatedAt: now,
      },
      sortOrder: 0,
    });
  }

  return statements;
}

// ─── Data fingerprint ─────────────────────────────────────────────────────────

/**
 * Generates a SHA-256 fingerprint of the key financial values in a BuiltReport.
 * If the live data changes after a draft is approved, the new fingerprint will
 * differ from the stored one, triggering the stale-draft guard.
 */
export function buildDataFingerprint(report: BuiltReport): string {
  const financials = report.sections["financials"] as Record<string, unknown> | null;
  const portfolio = (report.sections["portfolio_kpis"] as any)?.portfolio ?? null;
  const validation = report.sections["validation"] as Record<string, unknown> | null;

  const fingerData = {
    period: report.period,
    template: report.template.id,
    entities: report.request.entities,
    financials_hash: financials ? JSON.stringify(financials) : null,
    portfolio_hash: portfolio ? JSON.stringify({
      total_revenue: (portfolio as any)?.total_revenue,
      total_net_income: (portfolio as any)?.total_net_income,
    }) : null,
    validation_all_passed: (validation as any)?.summary?.all_passed ?? null,
    data_freshness: report.metadata.dataFreshness,
  };

  return createHash("sha256")
    .update(JSON.stringify(fingerData))
    .digest("hex");
}

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generates all FinanceOS Analysis statements for a BuiltReport.
 * Returns an array of AnalysisStatement objects, each with full provenance.
 * Does NOT persist to the database — that is the caller's responsibility.
 */
export function generateAnalysis(report: BuiltReport): AnalysisStatement[] {
  const statements: AnalysisStatement[] = [];

  // Portfolio KPIs
  const portfolioKpis = (report.sections["portfolio_kpis"] as any)?.portfolio ?? null;
  statements.push(...analyzePortfolioKpis(portfolioKpis, report.period));

  // Entity-level analysis
  const entitySummary = report.sections["entity_summary"] as Record<string, unknown> | null;
  const financials = report.sections["financials"] as Record<string, unknown> | null;

  if (entitySummary || financials) {
    const slugs = Object.keys(entitySummary ?? financials ?? {});
    slugs.forEach((slug, i) => {
      const metrics = (entitySummary?.[slug] as any)?.metrics ?? null;
      const fin = (financials?.[slug] as any) ?? null;
      statements.push(...analyzeEntityRevenue(slug, metrics, fin, report.period, i * 10));
    });
  }

  // Validation
  const validation = report.sections["validation"] as Record<string, unknown> | null;
  statements.push(...analyzeValidation(validation, report.period));

  // Alerts
  const alerts = report.sections["alerts"] as unknown[] | null;
  const entitySlugs = Object.keys(entitySummary ?? financials ?? {});
  statements.push(...analyzeAlerts(alerts ?? [], report.period, entitySlugs.length > 0 ? entitySlugs : ["portfolio"]));

  return statements;
}
