/**
 * Rules Engine — evaluator.
 *
 * Runs every enabled Rule in RULE_REGISTRY against live DashboardData and
 * produces the deduplicated, severity-sorted Alert[] that both
 * /api/alerts and the AI CFO briefing consume. Never hardcode alerts here —
 * all alert content originates from a Rule's evaluate() function.
 */

import type { DashboardData } from "../lib/types";
import { RULE_REGISTRY, type Rule } from "./registry";
import { THRESHOLDS } from "./thresholds";

export type Alert = {
  id: string;
  ruleId: string;
  entity: string;
  severity: Rule["severity"];
  category: Rule["category"];
  title: string;
  description: string;
  recommendedAction: string;
  createdAt: string;
  status: "active";
};

const SEVERITY_ORDER: Record<Rule["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export async function evaluateAllRules(data: DashboardData): Promise<Alert[]> {
  const createdAt = new Date().toISOString();
  const seen = new Map<string, Alert>();

  const enabledRules = RULE_REGISTRY.filter((rule) => rule.enabled);

  for (const rule of enabledRules) {
    const results = rule.evaluate(data, THRESHOLDS).filter((r) => r.triggered);
    for (const result of results) {
      const id = `${result.ruleId}-${result.entity}`;
      if (seen.has(id)) continue;
      seen.set(id, {
        id,
        ruleId: result.ruleId,
        entity: result.entity,
        severity: rule.severity,
        category: rule.category,
        title: result.title,
        description: result.description,
        recommendedAction: result.recommendedAction,
        createdAt,
        status: "active",
      });
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}
