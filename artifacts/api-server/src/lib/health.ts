/**
 * Company Health Score — the single source of truth.
 *
 * This penalty-based formula is the ONLY place an entity health score is
 * computed anywhere in FinanceOS. The API server injects the result into every
 * EntityMetrics it serves (see dataSource.getEntityMetrics and
 * snapshotStore.getMetricSnapshots), and the frontend renders that value
 * verbatim — it never recomputes a headline score client-side.
 *
 * Inputs are read defensively via isKnown so a missing metric never invents a
 * penalty. Score is clamped to [0, 100].
 */

import { isKnown } from "../ai/format";
import type { EntityMetrics } from "./types";

export type HealthLabel = "Excellent" | "Good" | "Needs Attention";

/** Metrics shape needed to score — accepts full EntityMetrics (with or without
 *  the injected health fields). */
type ScoreableMetrics = Omit<EntityMetrics, "health_score" | "health_label">;

export function computeEntityHealthScore(m: ScoreableMetrics): number {
  let score = 100;

  if (isKnown(m.dso_days)) {
    if (m.dso_days > 75) score -= 20;
    else if (m.dso_days > 60) score -= 12;
    else if (m.dso_days > 45) score -= 4;
  }

  if (isKnown(m.ar_overdue_pct)) {
    if (m.ar_overdue_pct > 25) score -= 15;
    else if (m.ar_overdue_pct > 15) score -= 8;
    else if (m.ar_overdue_pct > 10) score -= 3;
    else if (m.ar_overdue_pct > 5) score -= 1;
  }

  if (isKnown(m.net_margin_pct)) {
    if (m.net_margin_pct < 0) score -= 15;
    else if (m.net_margin_pct < 5) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function entityHealthLabel(score: number): HealthLabel {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  return "Needs Attention";
}

/** Attach the single-source health score + label to a metrics object. */
export function withHealth(m: ScoreableMetrics): EntityMetrics {
  const score = computeEntityHealthScore(m);
  return { ...m, health_score: score, health_label: entityHealthLabel(score) };
}
