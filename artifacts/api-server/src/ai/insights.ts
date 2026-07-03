/**
 * AI CFO Briefing Engine — Highlights, Risks & Opportunities.
 *
 * Deterministic, pure functions over live DashboardData. No LLM.
 * Every sentence produced here must cite a real number from `data`.
 */

import type { DashboardData, Highlight, Opportunity, Risk } from "../lib/types";
import { fmtMoney, fmtPct, isKnown, num, safeFreshness, safeValidation } from "./format";
import {
  getCashTrend,
  getHighestGrowthEntity,
  getLargestOverdueAR,
  getLargestVendorExposure,
  getLowestMarginEntity,
  getRevenueChange,
} from "./trends";

// ── Highlights ──────────────────────────────────────────────────────────────

export function generateHighlights(data: DashboardData): Highlight[] {
  const { metrics, portfolio, validation, freshness } = data;
  const highlights: Highlight[] = [];

  // 1 — Revenue direction
  const revenueChange = getRevenueChange(metrics, portfolio);
  highlights.push({
    icon: revenueChange.direction === "up" ? "trending-up" : revenueChange.direction === "down" ? "trending-down" : "minus",
    text: `Portfolio revenue is ${fmtMoney(portfolio.portfolio_revenue_ytd)} YTD across ${portfolio.entity_count} entities, converting at a ${fmtPct(revenueChange.pct)} net margin`,
    sentiment: revenueChange.direction === "down" ? "negative" : revenueChange.direction === "up" ? "positive" : "neutral",
  });

  // 2 — Cash direction
  const cashTrend = getCashTrend(metrics);
  highlights.push({
    icon: cashTrend.direction === "up" ? "wallet" : cashTrend.direction === "down" ? "alert-triangle" : "wallet",
    text:
      cashTrend.direction === "down"
        ? `Portfolio cash on hand is ${fmtMoney(cashTrend.totalCash)} — below total open payables, a liquidity flag`
        : `Portfolio cash on hand stands at ${fmtMoney(cashTrend.totalCash)} against ${fmtMoney(portfolio.portfolio_open_ap)} in open payables`,
    sentiment: cashTrend.direction === "down" ? "negative" : "positive",
  });

  // 3 — Highest growth entity
  const highestGrowth = getHighestGrowthEntity(metrics);
  if (highestGrowth) {
    highlights.push({
      icon: "award",
      text: `${highestGrowth.entity} leads portfolio revenue at ${fmtMoney(highestGrowth.value)} YTD`,
      sentiment: "positive",
    });
  }

  // 4 — Lowest margin entity
  const lowestMargin = getLowestMarginEntity(metrics);
  if (lowestMargin) {
    highlights.push({
      icon: lowestMargin.value < 5 ? "trending-down" : "bar-chart",
      text: `${lowestMargin.entity} has the portfolio's lowest net margin at ${fmtPct(lowestMargin.value)}`,
      sentiment: lowestMargin.value < 5 ? "negative" : "neutral",
    });
  }

  // 5 — Largest overdue AR entity
  const largestOverdueAR = getLargestOverdueAR(metrics);
  if (largestOverdueAR && largestOverdueAR.value > 0) {
    highlights.push({
      icon: "clock",
      text: `${largestOverdueAR.entity} carries the most overdue receivables — ${fmtMoney(largestOverdueAR.value)} of ${fmtMoney(largestOverdueAR.openAr)} open AR (${fmtPct(largestOverdueAR.overduePct)} overdue)`,
      sentiment: largestOverdueAR.overduePct > 20 ? "negative" : "neutral",
    });
  }

  // 6 — Largest vendor exposure
  const largestVendorExposure = getLargestVendorExposure(metrics);
  if (largestVendorExposure && largestVendorExposure.value > 0) {
    highlights.push({
      icon: "package",
      text: `${largestVendorExposure.entity} holds the largest vendor exposure at ${fmtMoney(largestVendorExposure.value)} in open payables`,
      sentiment: "neutral",
    });
  }

  // 7 — Validation status
  const v = safeValidation(validation);
  highlights.push({
    icon: v.allPassed ? "check-circle" : "alert-circle",
    text: v.allPassed
      ? `All ${v.totalChecks} data validation checks passed as of ${v.runDate} — figures are trusted`
      : `${v.failed} of ${v.totalChecks} validation checks failed as of ${v.runDate} — review before relying on these figures`,
    sentiment: v.allPassed ? "positive" : "negative",
  });

  // 8 — Data freshness status
  const f = safeFreshness(freshness);
  const daysOld = daysSince(f.pipelineRun);
  highlights.push({
    icon: daysOld > 2 ? "alert-triangle" : "refresh-cw",
    text:
      daysOld > 2
        ? `Data pipeline last ran ${daysOld} days ago (${f.pipelineRun}) — figures may be stale`
        : `Data pipeline ran on ${f.pipelineRun} — figures are current as of ${f.dataAsOf}`,
    sentiment: daysOld > 2 ? "negative" : "positive",
  });

  return highlights.slice(0, 8);
}

// ── Risks ───────────────────────────────────────────────────────────────────

export function generateRisks(data: DashboardData): Risk[] {
  const { metrics, validation } = data;
  const risks: Risk[] = [];

  for (const m of Object.values(metrics)) {
    if (isKnown(m.dso_days) && m.dso_days > 45) {
      risks.push({
        title: `${m.entity} — DSO at ${m.dso_days} days`,
        description: `Days Sales Outstanding is ${m.dso_days} days, above the 45-day threshold, with ${fmtMoney(m.open_ar)} in open receivables.`,
        severity: "high",
        entity: m.entity,
      });
    }

    if (isKnown(m.ar_overdue_pct) && m.ar_overdue_pct > 20) {
      risks.push({
        title: `${m.entity} — ${fmtPct(m.ar_overdue_pct)} of AR overdue`,
        description: `${fmtMoney((num(m.open_ar) * m.ar_overdue_pct) / 100)} of ${fmtMoney(m.open_ar)} in receivables is overdue, exceeding the 20% threshold.`,
        severity: "high",
        entity: m.entity,
      });
    }

    if (isKnown(m.net_margin_pct) && m.net_margin_pct < 5) {
      risks.push({
        title: `${m.entity} — net margin at ${fmtPct(m.net_margin_pct)}`,
        description: `Net margin of ${fmtPct(m.net_margin_pct)} on ${fmtMoney(m.revenue_ytd)} revenue YTD is below the 5% healthy-margin threshold.`,
        severity: "medium",
        entity: m.entity,
      });
    }

    if (isKnown(m.cash_on_hand) && m.cash_on_hand < 50_000) {
      risks.push({
        title: `${m.entity} — cash on hand at ${fmtMoney(m.cash_on_hand)}`,
        description: `Cash on hand of ${fmtMoney(m.cash_on_hand)} is below the $50,000 minimum runway threshold.`,
        severity: "high",
        entity: m.entity,
      });
    }

    if (isKnown(m.ap_overdue_pct) && m.ap_overdue_pct > 25) {
      risks.push({
        title: `${m.entity} — ${fmtPct(m.ap_overdue_pct)} of AP overdue`,
        description: `${fmtMoney((num(m.open_ap) * m.ap_overdue_pct) / 100)} of ${fmtMoney(m.open_ap)} in payables is overdue, exceeding the 25% threshold.`,
        severity: "medium",
        entity: m.entity,
      });
    }
  }

  const riskValidation = safeValidation(validation);
  if (riskValidation.failed > 0) {
    risks.push({
      title: `${riskValidation.failed} validation check${riskValidation.failed > 1 ? "s" : ""} failed`,
      description: `${riskValidation.failed} of ${riskValidation.totalChecks} data validation rules failed as of ${riskValidation.runDate} — underlying figures require review.`,
      severity: "medium",
      entity: "Portfolio",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  risks.sort((a, b) => order[a.severity] - order[b.severity]);

  return risks;
}

// ── Opportunities ────────────────────────────────────────────────────────────

export function generateOpportunities(data: DashboardData): Opportunity[] {
  const { metrics, validation } = data;
  const opportunities: Opportunity[] = [];

  for (const m of Object.values(metrics)) {
    if (isKnown(m.cash_on_hand) && m.cash_on_hand > 200_000) {
      opportunities.push({
        title: `${m.entity} — strong cash position`,
        description: `${fmtMoney(m.cash_on_hand)} in cash on hand exceeds the $200,000 threshold, providing room to invest, pay down liabilities, or fund growth.`,
        entity: m.entity,
      });
    }

    if (isKnown(m.gross_margin_pct) && m.gross_margin_pct > 60) {
      opportunities.push({
        title: `${m.entity} — high gross margin`,
        description: `Gross margin of ${fmtPct(m.gross_margin_pct)} on ${fmtMoney(m.revenue_ytd)} revenue YTD leaves room to reinvest in growth while preserving profitability.`,
        entity: m.entity,
      });
    }

    if (isKnown(m.net_margin_pct) && m.net_margin_pct > 20) {
      opportunities.push({
        title: `${m.entity} — strong net margin`,
        description: `Net margin of ${fmtPct(m.net_margin_pct)} on ${fmtMoney(m.revenue_ytd)} revenue YTD is well above the 20% benchmark for healthy profitability.`,
        entity: m.entity,
      });
    }

    if (isKnown(m.revenue_ytd) && m.revenue_ytd > 0 && isKnown(m.open_ap) && m.open_ap / m.revenue_ytd < 0.05) {
      opportunities.push({
        title: `${m.entity} — low vendor exposure`,
        description: `Open payables of ${fmtMoney(m.open_ap)} are just ${fmtPct((m.open_ap / m.revenue_ytd) * 100)} of YTD revenue, indicating disciplined vendor management.`,
        entity: m.entity,
      });
    }
  }

  const oppValidation = safeValidation(validation);
  if (oppValidation.allPassed) {
    opportunities.push({
      title: "Portfolio data integrity is fully validated",
      description: `All ${oppValidation.totalChecks} validation checks passed as of ${oppValidation.runDate} — leadership can act on these figures with confidence.`,
      entity: "Portfolio",
    });
  }

  return opportunities;
}

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}
