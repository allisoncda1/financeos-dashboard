/**
 * AI CFO Briefing Engine — Actionable priorities.
 *
 * Deterministic, pure function over live DashboardData. No LLM.
 */

import type { DashboardData, Priority } from "../lib/types";
import { fmtMoney, fmtPct, isKnown, num } from "./format";

export function generatePriorities(data: DashboardData): Priority[] {
  const { metrics, validation } = data;
  const priorities: Priority[] = [];

  for (const m of Object.values(metrics)) {
    // Overdue AR
    if (isKnown(m.ar_overdue_pct) && m.ar_overdue_pct > 15) {
      priorities.push({
        title: `Collect overdue receivables at ${m.entity}`,
        description: `${fmtMoney((num(m.open_ar) * m.ar_overdue_pct) / 100)} of ${fmtMoney(m.open_ar)} in open AR is overdue (${fmtPct(m.ar_overdue_pct)}), with DSO at ${m.dso_days} days.`,
        severity: m.ar_overdue_pct > 20 ? "high" : "medium",
        entity: m.entity,
        recommendedAction: "Review AR aging and follow up with customers past due",
        status: "New",
      });
    }

    // Low margin
    if (isKnown(m.net_margin_pct) && m.net_margin_pct < 5) {
      priorities.push({
        title: `Improve margin at ${m.entity}`,
        description: `Net margin is ${fmtPct(m.net_margin_pct)} on ${fmtMoney(m.revenue_ytd)} revenue YTD, below the 5% healthy-margin threshold.`,
        severity: m.net_margin_pct < 0 ? "high" : "medium",
        entity: m.entity,
        recommendedAction: "Review cost structure and pricing to restore margin",
        status: "New",
      });
    }

    // Cash low
    if (isKnown(m.cash_on_hand) && m.cash_on_hand < 50_000) {
      priorities.push({
        title: `Shore up cash reserves at ${m.entity}`,
        description: `Cash on hand is ${fmtMoney(m.cash_on_hand)}, below the $50,000 minimum runway threshold.`,
        severity: "high",
        entity: m.entity,
        recommendedAction: "Accelerate collections or arrange short-term funding",
        status: "New",
      });
    }

    // AP overdue
    if (isKnown(m.ap_overdue_pct) && m.ap_overdue_pct > 25) {
      priorities.push({
        title: `Address overdue payables at ${m.entity}`,
        description: `${fmtMoney((num(m.open_ap) * m.ap_overdue_pct) / 100)} of ${fmtMoney(m.open_ap)} in open AP is overdue (${fmtPct(m.ap_overdue_pct)}).`,
        severity: "medium",
        entity: m.entity,
        recommendedAction: "Prioritize and schedule overdue vendor payments",
        status: "New",
      });
    }
  }

  // Validation failures
  if (validation.failed > 0) {
    priorities.push({
      title: "Resolve data validation failures",
      description: `${validation.failed} of ${validation.total_checks} validation checks failed as of ${validation.run_date}.`,
      severity: "high",
      entity: "Portfolio",
      recommendedAction: "Review failed validation rules before reporting these figures",
      status: "New",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  priorities.sort((a, b) => order[a.severity] - order[b.severity]);

  return priorities.slice(0, 6);
}
