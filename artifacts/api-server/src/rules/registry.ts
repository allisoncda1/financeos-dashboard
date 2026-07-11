/**
 * Rules Engine — rule definitions.
 *
 * Every operational alert in FinanceOS originates from exactly one Rule in
 * RULE_REGISTRY below. Rules are pure, deterministic functions over live
 * DashboardData + THRESHOLDS — no hardcoded alert text lives anywhere else
 * (routes, briefing, frontend). This is the single source of truth.
 *
 * Design note on severity: the Rule type carries one fixed `severity` per
 * rule id (not per RuleResult), matching the contract used by evaluator.ts
 * and the Alert type. Where a metric has both a "warning" and a "critical"
 * threshold (DSO, AR/AP overdue %, entity health), the rule uses its warning
 * threshold to decide whether to trigger and its critical threshold only to
 * escalate the title/description/recommendedAction wording — it does not
 * change the rule's fixed severity. Cash runway and net margin instead ship
 * as two distinct rule ids (…-low/-deterioration and …-critical/-negative)
 * so the critical case surfaces as its own higher-severity alert.
 */

import { ENTITY_SLUGS, type DashboardData, type EntityMetrics, type EntitySlug } from "../lib/types";
import { isKnown, num } from "../ai/format";
import { computeEntityHealthScore } from "../lib/health";
import { THRESHOLDS } from "./thresholds";

export type RuleCategory = "receivables" | "payables" | "cash" | "revenue" | "validation" | "portfolio";
export type RuleSeverity = "critical" | "high" | "medium" | "low" | "info";

export type RuleResult = {
  ruleId: string;
  entity: string;
  triggered: boolean;
  title: string;
  description: string;
  recommendedAction: string;
};

export type Rule = {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  enabled: boolean;
  evaluate: (data: DashboardData, thresholds: typeof THRESHOLDS) => RuleResult[];
};

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function entityName(data: DashboardData, slug: EntitySlug): string {
  return data.metrics[slug]?.entity ?? slug;
}

function monthsElapsedInYear(): number {
  return new Date().getMonth() + 1;
}

export const RULE_REGISTRY: Rule[] = [
  // ── RECEIVABLES ──────────────────────────────────────────────────────────
  {
    id: "dso-above-target",
    name: "DSO Above Target",
    description: "Flags entities whose Days Sales Outstanding exceeds the policy threshold.",
    category: "receivables",
    severity: "high",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m || !isKnown(m.dso_days)) continue;
        if (m.dso_days > thresholds.dso_warning_days) {
          const critical = m.dso_days > thresholds.dso_critical_days;
          const name = entityName(data, slug);
          results.push({
            ruleId: "dso-above-target",
            entity: name,
            triggered: true,
            title: `${critical ? "CRITICAL: " : ""}${name} — DSO at ${m.dso_days.toFixed(1)} days`,
            description: `Days Sales Outstanding is ${m.dso_days.toFixed(1)} days, above the ${thresholds.dso_warning_days}-day threshold${
              critical ? ` and past the ${thresholds.dso_critical_days}-day critical limit` : ""
            }, with ${money(num(m.open_ar))} in open receivables.`,
            recommendedAction: critical
              ? "Escalate immediately: contact all overdue customers and consider credit holds"
              : "Review AR aging and follow up with customers past due",
          });
        }
      }
      return results;
    },
  },
  {
    id: "ar-overdue-high",
    name: "AR Overdue Percentage High",
    description: "Flags entities where the overdue share of open AR exceeds the policy threshold.",
    category: "receivables",
    severity: "high",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m || !isKnown(m.ar_overdue_pct)) continue;
        if (m.ar_overdue_pct > thresholds.ar_overdue_pct_warning) {
          const critical = m.ar_overdue_pct > thresholds.ar_overdue_pct_critical;
          const name = entityName(data, slug);
          const overdueAmount = (num(m.open_ar) * m.ar_overdue_pct) / 100;
          results.push({
            ruleId: "ar-overdue-high",
            entity: name,
            triggered: true,
            title: `${critical ? "CRITICAL: " : ""}${name} — ${m.ar_overdue_pct.toFixed(1)}% of AR overdue`,
            description: `${money(overdueAmount)} of ${money(num(m.open_ar))} in receivables is overdue (${m.ar_overdue_pct.toFixed(1)}%), above the ${thresholds.ar_overdue_pct_warning}% threshold.`,
            recommendedAction: critical
              ? "Escalate overdue accounts to collections immediately"
              : "Send collection notices to accounts past due",
          });
        }
      }
      return results;
    },
  },
  {
    id: "ar-concentration",
    name: "AR Concentration Risk",
    description: "Flags when a single entity holds a disproportionate share of portfolio-wide open AR.",
    category: "receivables",
    severity: "medium",
    enabled: true,
    evaluate: (data) => {
      const results: RuleResult[] = [];
      const portfolioAr = num(data.portfolio?.portfolio_open_ar);
      if (portfolioAr <= 0) return results;
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m || !isKnown(m.open_ar)) continue;
        const share = m.open_ar / portfolioAr;
        if (share > 0.6) {
          const name = entityName(data, slug);
          results.push({
            ruleId: "ar-concentration",
            entity: name,
            triggered: true,
            title: `${name} — AR concentration risk`,
            description: `${name} holds ${money(m.open_ar)} (${(share * 100).toFixed(1)}%) of the portfolio's ${money(portfolioAr)} total open AR, exceeding the 60% concentration threshold.`,
            recommendedAction: "Diversify receivables exposure and monitor this entity's collections closely",
          });
        }
      }
      return results;
    },
  },

  // ── PAYABLES ─────────────────────────────────────────────────────────────
  {
    id: "ap-overdue-high",
    name: "AP Overdue Percentage High",
    description: "Flags entities where the overdue share of open AP exceeds the policy threshold.",
    category: "payables",
    severity: "medium",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m || !isKnown(m.ap_overdue_pct)) continue;
        if (m.ap_overdue_pct > thresholds.ap_overdue_pct_warning) {
          const critical = m.ap_overdue_pct > thresholds.ap_overdue_pct_critical;
          const name = entityName(data, slug);
          const overdueAmount = (num(m.open_ap) * m.ap_overdue_pct) / 100;
          results.push({
            ruleId: "ap-overdue-high",
            entity: name,
            triggered: true,
            title: `${critical ? "CRITICAL: " : ""}${name} — ${m.ap_overdue_pct.toFixed(1)}% of AP overdue`,
            description: `${money(overdueAmount)} of ${money(num(m.open_ap))} in payables is overdue (${m.ap_overdue_pct.toFixed(1)}%), above the ${thresholds.ap_overdue_pct_warning}% threshold.`,
            recommendedAction: critical
              ? "Contact vendors immediately to avoid service disruption or late fees"
              : "Prioritize and schedule overdue vendor payments",
          });
        }
      }
      return results;
    },
  },
  {
    id: "ap-concentration",
    name: "AP Concentration Risk",
    description: "Flags when a single entity holds a disproportionate share of portfolio-wide open AP.",
    category: "payables",
    severity: "medium",
    enabled: true,
    evaluate: (data) => {
      const results: RuleResult[] = [];
      const portfolioAp = num(data.portfolio?.portfolio_open_ap);
      if (portfolioAp <= 0) return results;
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m || !isKnown(m.open_ap)) continue;
        const share = m.open_ap / portfolioAp;
        if (share > 0.6) {
          const name = entityName(data, slug);
          results.push({
            ruleId: "ap-concentration",
            entity: name,
            triggered: true,
            title: `${name} — AP concentration risk`,
            description: `${name} holds ${money(m.open_ap)} (${(share * 100).toFixed(1)}%) of the portfolio's ${money(portfolioAp)} total open AP, exceeding the 60% concentration threshold.`,
            recommendedAction: "Review vendor payment scheduling to reduce concentration in this entity",
          });
        }
      }
      return results;
    },
  },

  // ── CASH ─────────────────────────────────────────────────────────────────
  {
    id: "cash-runway-low",
    name: "Cash Runway Low",
    description: "Flags entities whose cash runway (cash on hand ÷ monthly burn) is below the warning threshold.",
    category: "cash",
    severity: "high",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      const monthsElapsed = monthsElapsedInYear();
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m || !isKnown(m.cash_on_hand) || !isKnown(m.opex_ytd)) continue;
        const monthlyBurn = m.opex_ytd / monthsElapsed;
        if (monthlyBurn <= 0) continue;
        const runway = m.cash_on_hand / monthlyBurn;
        if (runway < thresholds.cash_runway_warning_months) {
          const name = entityName(data, slug);
          results.push({
            ruleId: "cash-runway-low",
            entity: name,
            triggered: true,
            title: `${name} — cash runway at ${runway.toFixed(1)} months`,
            description: `At the current burn rate of ${money(monthlyBurn)}/month, ${money(m.cash_on_hand)} in cash on hand covers ${runway.toFixed(1)} months — below the ${thresholds.cash_runway_warning_months}-month warning threshold.`,
            recommendedAction: "Accelerate collections or arrange short-term funding",
          });
        }
      }
      return results;
    },
  },
  {
    id: "cash-runway-critical",
    name: "Cash Runway Critical",
    description: "Flags entities whose cash runway has fallen below the critical threshold.",
    category: "cash",
    severity: "critical",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      const monthsElapsed = monthsElapsedInYear();
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m || !isKnown(m.cash_on_hand) || !isKnown(m.opex_ytd)) continue;
        const monthlyBurn = m.opex_ytd / monthsElapsed;
        if (monthlyBurn <= 0) continue;
        const runway = m.cash_on_hand / monthlyBurn;
        if (runway < thresholds.cash_runway_critical_months) {
          const name = entityName(data, slug);
          results.push({
            ruleId: "cash-runway-critical",
            entity: name,
            triggered: true,
            title: `${name} — cash runway critical at ${runway.toFixed(1)} months`,
            description: `At the current burn rate of ${money(monthlyBurn)}/month, ${money(m.cash_on_hand)} in cash on hand covers only ${runway.toFixed(1)} months — below the ${thresholds.cash_runway_critical_months}-month critical threshold.`,
            recommendedAction: "Immediate action required: secure emergency funding or cut discretionary spend now",
          });
        }
      }
      return results;
    },
  },

  // ── REVENUE ──────────────────────────────────────────────────────────────
  {
    id: "margin-deterioration",
    name: "Margin Deterioration",
    description: "Flags entities whose net margin has fallen below the healthy-margin threshold.",
    category: "revenue",
    severity: "medium",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m || !isKnown(m.net_margin_pct)) continue;
        if (m.net_margin_pct < thresholds.net_margin_warning_pct) {
          const name = entityName(data, slug);
          results.push({
            ruleId: "margin-deterioration",
            entity: name,
            triggered: true,
            title: `${name} — net margin at ${m.net_margin_pct.toFixed(1)}%`,
            description: `Net margin of ${m.net_margin_pct.toFixed(1)}% on ${money(num(m.revenue_ytd))} revenue YTD is below the ${thresholds.net_margin_warning_pct}% healthy-margin threshold.`,
            recommendedAction: "Review cost structure and pricing to restore margin",
          });
        }
      }
      return results;
    },
  },
  {
    id: "margin-negative",
    name: "Margin Negative",
    description: "Flags entities that are operating at a net loss.",
    category: "revenue",
    severity: "critical",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m || !isKnown(m.net_margin_pct)) continue;
        if (m.net_margin_pct < thresholds.net_margin_critical_pct) {
          const name = entityName(data, slug);
          results.push({
            ruleId: "margin-negative",
            entity: name,
            triggered: true,
            title: `${name} — operating at a net loss`,
            description: `Net margin of ${m.net_margin_pct.toFixed(1)}% on ${money(num(m.revenue_ytd))} revenue YTD means this entity is losing money.`,
            recommendedAction: "Convene an urgent cost review — identify and cut unprofitable spend immediately",
          });
        }
      }
      return results;
    },
  },

  // ── VALIDATION ───────────────────────────────────────────────────────────
  {
    id: "validation-failures",
    name: "Data Validation Failures",
    description: "Flags one alert per failed data validation check.",
    category: "validation",
    severity: "high",
    enabled: true,
    evaluate: (data) => {
      const results: RuleResult[] = [];
      const failed = num(data.validation?.failed);
      const total = num(data.validation?.total_checks);
      const runDate = data.validation?.run_date ?? "an unknown date";
      for (let i = 0; i < failed; i++) {
        results.push({
          ruleId: "validation-failures",
          entity: "Portfolio",
          triggered: true,
          title: `Data validation failure ${i + 1} of ${failed}`,
          description: `${failed} of ${total} validation checks failed as of ${runDate} — underlying figures require review.`,
          recommendedAction: "Review failed validation rules before reporting these figures",
        });
      }
      return results;
    },
  },
  {
    id: "stale-data",
    name: "Stale Pipeline Data",
    description: "Flags when the data pipeline hasn't run recently enough to trust current figures.",
    category: "validation",
    severity: "medium",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      const pipelineRun = data.freshness?.pipeline_run;
      if (!pipelineRun) return results;
      const then = new Date(pipelineRun).getTime();
      if (Number.isNaN(then)) return results;
      const daysOld = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
      if (daysOld > thresholds.stale_data_days) {
        results.push({
          ruleId: "stale-data",
          entity: "Portfolio",
          triggered: true,
          title: `Pipeline data is ${daysOld} days old`,
          description: `The data pipeline last ran on ${pipelineRun}, ${daysOld} days ago — above the ${thresholds.stale_data_days}-day freshness threshold. Figures may be stale.`,
          recommendedAction: "Re-run the data pipeline to refresh figures before relying on them",
        });
      }
      return results;
    },
  },

  // ── PORTFOLIO ────────────────────────────────────────────────────────────
  {
    id: "entity-health-low",
    name: "Entity Health Score Low",
    description: "Flags entities whose composite health score (margin, DSO, AR overdue) falls below the warning threshold.",
    category: "portfolio",
    severity: "medium",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      for (const slug of ENTITY_SLUGS) {
        const m = data.metrics[slug];
        if (!m) continue;
        const score = computeEntityHealthScore(m);
        if (score < thresholds.entity_health_warning) {
          const critical = score < thresholds.entity_health_critical;
          const name = entityName(data, slug);
          results.push({
            ruleId: "entity-health-low",
            entity: name,
            triggered: true,
            title: `${critical ? "CRITICAL: " : ""}${name} — health score at ${score}`,
            description: `${name}'s composite health score is ${score}/100, below the ${thresholds.entity_health_warning} warning threshold${
              critical ? ` and the ${thresholds.entity_health_critical} critical threshold` : ""
            }, driven by margin, DSO, and AR overdue trends.`,
            recommendedAction: critical
              ? "Conduct an urgent entity-level financial review"
              : "Schedule a review of this entity's AR, DSO, and margin trends",
          });
        }
      }
      return results;
    },
  },
  {
    id: "anomaly-count-high",
    name: "Anomaly Count High",
    description: "Flags entities with more open data anomalies than the warning threshold.",
    category: "portfolio",
    severity: "medium",
    enabled: true,
    evaluate: (data, thresholds) => {
      const results: RuleResult[] = [];
      for (const slug of ENTITY_SLUGS) {
        const list = data.anomalies[slug] ?? [];
        if (list.length > thresholds.anomaly_count_warning) {
          const name = entityName(data, slug);
          results.push({
            ruleId: "anomaly-count-high",
            entity: name,
            triggered: true,
            title: `${name} — ${list.length} open anomalies`,
            description: `${name} has ${list.length} flagged data anomalies, above the ${thresholds.anomaly_count_warning}-anomaly threshold.`,
            recommendedAction: "Review flagged transactions and resolve or annotate each anomaly",
          });
        }
      }
      return results;
    },
  },
];
