/**
 * AI CFO Briefing Engine — top-level composer.
 *
 * Deterministic. No LLM, no Anthropic, no OpenAI, no API keys.
 * Everything is computed locally from live FinanceOS data via pure functions.
 */

import {
  getEntityAnomalies,
  getDataFreshness,
  getPortfolioSummary,
  getValidationSummary,
  getEntityMetrics,
} from "../lib/dataSource";
import {
  ENTITY_SLUGS,
  type BriefingResponse,
  type DashboardData,
  type Opportunity,
  type Priority,
  type Risk,
} from "../lib/types";
import { fmtMoney, fmtPct, isKnown, num, safeFreshness, safeValidation } from "./format";
import { generateHighlights } from "./insights";
import { getCashTrend, getLargestOverdueAR, getRevenueChange } from "./trends";
import { RulesEngine } from "../rules/engine";
import type { Alert } from "../rules/engine";

const ALERT_SEVERITY_TO_RISK_SEVERITY: Record<Alert["severity"], Risk["severity"]> = {
  critical: "high",
  high: "high",
  medium: "medium",
  low: "low",
  info: "low",
};

function alertsToRisks(alerts: Alert[]): Risk[] {
  return alerts
    .filter((a) => a.severity === "critical" || a.severity === "high")
    .map((a) => ({
      title: a.title,
      description: a.description,
      severity: ALERT_SEVERITY_TO_RISK_SEVERITY[a.severity],
      entity: a.entity,
    }));
}

function alertsToPriorities(alerts: Alert[]): Priority[] {
  return alerts
    .filter((a) => a.severity === "medium")
    .map((a) => ({
      title: a.title,
      description: a.description,
      severity: "medium" as const,
      entity: a.entity,
      recommendedAction: a.recommendedAction,
      status: "New" as const,
    }))
    .slice(0, 6);
}

function alertsToOpportunities(alerts: Alert[]): Opportunity[] {
  return alerts
    .filter((a) => a.severity === "low" || a.severity === "info")
    .map((a) => ({
      title: a.title,
      description: a.description,
      entity: a.entity,
    }));
}

function getGreeting(): string {
  const hour = new Date().getHours();
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeOfDay = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${timeOfDay} — ${dateLabel}`;
}

async function loadDashboardData(): Promise<DashboardData> {
  const [portfolio, validation, freshness, metricsList, anomaliesList] = await Promise.all([
    getPortfolioSummary(),
    getValidationSummary(),
    getDataFreshness(),
    Promise.all(ENTITY_SLUGS.map((slug) => getEntityMetrics(slug))),
    Promise.all(ENTITY_SLUGS.map((slug) => getEntityAnomalies(slug))),
  ]);

  const metrics = Object.fromEntries(ENTITY_SLUGS.map((slug, i) => [slug, metricsList[i]])) as DashboardData["metrics"];
  const anomalies = Object.fromEntries(ENTITY_SLUGS.map((slug, i) => [slug, anomaliesList[i]])) as DashboardData["anomalies"];

  return { portfolio, validation, freshness, metrics, anomalies };
}

function buildExecutiveSummary(data: DashboardData): string[] {
  const { portfolio, metrics, validation, freshness } = data;
  const paragraphs: string[] = [];
  const entityList = Object.values(metrics);

  // 1 — Revenue overview
  const revenueChange = getRevenueChange(metrics, portfolio);
  paragraphs.push(
    isKnown(portfolio.portfolio_net_income_ytd)
      ? `Portfolio revenue stands at ${fmtMoney(portfolio.portfolio_revenue_ytd)} year-to-date across ${portfolio.entity_count} entities, ` +
          `generating ${fmtMoney(portfolio.portfolio_net_income_ytd)} in net income at a ${fmtPct(revenueChange.pct)} blended net margin.`
      : `Portfolio revenue stands at ${fmtMoney(portfolio.portfolio_revenue_ytd)} year-to-date across ${portfolio.entity_count} entities.`,
  );

  // 2 — Profitability and margin (only when net_margin_pct is actually known for entities)
  const marginKnownList = entityList.filter((m) => isKnown(m.net_margin_pct));
  const sortedByMargin = [...marginKnownList].sort((a, b) => num(b.net_margin_pct) - num(a.net_margin_pct));
  const best = sortedByMargin[0];
  const worst = sortedByMargin[sortedByMargin.length - 1];
  const grossMarginKnownList = entityList.filter((m) => isKnown(m.gross_margin_pct));
  paragraphs.push(
    best && worst
      ? `${best.entity} posts the strongest net margin at ${fmtPct(best.net_margin_pct)}, while ${worst.entity} trails at ${fmtPct(worst.net_margin_pct)}. ` +
          (grossMarginKnownList.length > 0
            ? `Gross margin across the portfolio ranges from ${fmtPct(Math.min(...grossMarginKnownList.map((m) => num(m.gross_margin_pct))))} to ${fmtPct(Math.max(...grossMarginKnownList.map((m) => num(m.gross_margin_pct))))}.`
            : "")
      : isKnown(portfolio.portfolio_net_margin_pct)
        ? `Portfolio net margin is ${fmtPct(portfolio.portfolio_net_margin_pct)} on ${fmtMoney(portfolio.portfolio_revenue_ytd)} of revenue.`
        : `Margin figures are not yet available in the connected data source for this portfolio.`,
  );

  // 3 — Cash position
  const cashTrend = getCashTrend(metrics);
  paragraphs.push(
    `Cash on hand totals ${fmtMoney(cashTrend.totalCash)} against ${fmtMoney(portfolio.portfolio_open_ap)} in open payables, ` +
      `${cashTrend.direction === "down" ? "a liquidity position that warrants close monitoring" : "a healthy liquidity cushion for the portfolio"}.`,
  );

  // 4 — AR/AP status with overdue call-outs by entity name
  const largestOverdueAR = getLargestOverdueAR(metrics);
  const overdueEntities = entityList.filter((m) => num(m.ar_overdue_pct) > 15).map((m) => m.entity);
  paragraphs.push(
    largestOverdueAR && largestOverdueAR.value > 0
      ? `Open receivables total ${fmtMoney(portfolio.portfolio_open_ar)} against ${fmtMoney(portfolio.portfolio_open_ap)} in payables. ` +
          `${largestOverdueAR.entity} carries the largest overdue AR balance at ${fmtMoney(largestOverdueAR.value)} (${fmtPct(largestOverdueAR.overduePct)} of its AR)` +
          (overdueEntities.length > 1
            ? `, with ${overdueEntities.filter((e) => e !== largestOverdueAR.entity).join(", ")} also above the 15% overdue watch line.`
            : ".")
      : `Open receivables total ${fmtMoney(portfolio.portfolio_open_ar)} against ${fmtMoney(portfolio.portfolio_open_ap)} in payables, with no entity currently flagged for overdue AR.`,
  );

  // 5 — Validation and data quality
  const v = safeValidation(validation);
  const f = safeFreshness(freshness);
  paragraphs.push(
    v.allPassed
      ? `All ${v.totalChecks} data validation checks passed as of ${v.runDate}, and the pipeline last ran on ${f.pipelineRun} — these figures are trustworthy.`
      : `${v.failed} of ${v.totalChecks} validation checks failed as of ${v.runDate} — figures should be reviewed before being relied upon for decisions.`,
  );

  // 6 — Overall assessment
  const profitableCount = entityList.filter((m) => num(m.net_income_ytd) > 0).length;
  paragraphs.push(
    `${profitableCount} of ${portfolio.entity_count} entities are operating profitably YTD. ` +
      `${
        revenueChange.direction === "up" && cashTrend.direction !== "down"
          ? "The portfolio is in a strong overall position heading into the next reporting period."
          : "Focused attention on the flagged risk areas will strengthen the portfolio's position heading into the next reporting period."
      }`,
  );

  return paragraphs;
}

function computeConfidenceScore(data: DashboardData): number {
  const { validation, freshness, metrics, anomalies, portfolio } = data;
  let score = 100;

  const v = safeValidation(validation);
  score -= v.failed * 10;

  const f = safeFreshness(freshness);
  const pipelineAgeDays = daysSince(f.pipelineRun);
  if (pipelineAgeDays > 2) score -= 15;

  const missingAnomalyEntities = Object.values(anomalies).filter((list) => list == null).length;
  score -= missingAnomalyEntities * 5;
  void metrics;

  if (portfolio.entity_count < 4) score -= 20;

  return Math.max(0, Math.min(100, score));
}

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)));
}

export async function generateBriefing(): Promise<BriefingResponse> {
  const data = await loadDashboardData();
  const alerts = await RulesEngine.run();

  return {
    greeting: getGreeting(),
    executiveSummary: buildExecutiveSummary(data),
    highlights: generateHighlights(data),
    priorities: alertsToPriorities(alerts),
    risks: alertsToRisks(alerts),
    opportunities: alertsToOpportunities(alerts),
    confidenceScore: computeConfidenceScore(data),
    generatedAt: new Date().toISOString(),
  };
}
