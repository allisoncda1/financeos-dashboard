/**
 * AI CFO Briefing Engine — Highlights.
 *
 * Deterministic, pure functions over live DashboardData. No LLM.
 * Every sentence produced here must cite a real number from `data`.
 *
 * Risks, priorities, and opportunities are no longer generated here — they
 * come exclusively from the Rules Engine (see ../rules/engine.ts) so alert
 * logic has a single source of truth. See generateBriefing() in ./briefing.ts.
 */

import type { DashboardData, Highlight } from "../lib/types";
import { fmtMoney, fmtPct, safeFreshness, safeValidation } from "./format";
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

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 0;
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}
