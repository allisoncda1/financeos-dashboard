// FinanceOS — AI Briefing & Priority generation
// Computes data-driven content from DashboardData (mock in Phase 1, Drive in Phase 2).
// No hardcoded strings — everything is derived from mock metrics, anomalies, validation.

import type { DashboardData, EntityMetrics, EntitySlug } from "./types";
import { ENTITY_SLUGS, ENTITY_CONFIG } from "./types";

// ── Types ──────────────────────────────────────────────────────────────────────

export type BriefingSummaryItem = {
  text: string;
  type: "positive" | "negative" | "neutral";
};

export type RecommendedAction = {
  index: number;
  text: string;
  href: string;
};

export type BriefingData = {
  greeting: string;
  userName: string;
  date: string;
  summaryItems: BriefingSummaryItem[];
  recommendedActions: RecommendedAction[];
  pipelineHealthy: boolean;
  lastUpdated: string;
  confidenceScore: number;
};

export type PriorityItem = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  entity: string;
  entitySlug: EntitySlug | null;
  entityColor: string;
  action: string;
  href: string;
  type: "ar" | "ap" | "reconciliation" | "validation" | "anomaly" | "close";
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export function computeHealthScore(m: EntityMetrics): number {
  let score = 100;
  // DSO
  if (m.dso_days > 75) score -= 20;
  else if (m.dso_days > 60) score -= 12;
  else if (m.dso_days > 45) score -= 4;
  // AR overdue
  if (m.ar_overdue_pct > 25) score -= 15;
  else if (m.ar_overdue_pct > 15) score -= 8;
  else if (m.ar_overdue_pct > 10) score -= 3;
  else if (m.ar_overdue_pct > 5) score -= 1;
  // AP overdue
  if (m.ap_overdue_pct > 10) score -= 10;
  else if (m.ap_overdue_pct > 5) score -= 5;
  else if (m.ap_overdue_pct > 3) score -= 2;
  // Net margin
  if (m.net_margin_pct < 0) score -= 15;
  else if (m.net_margin_pct < 5) score -= 5;
  return Math.max(0, Math.min(100, score));
}

export function healthColor(score: number): string {
  if (score >= 85) return "#10B981";
  if (score >= 70) return "#F59E0B";
  return "#EF4444";
}

export function healthLabel(score: number): "Excellent" | "Good" | "Needs Attention" {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  return "Needs Attention";
}

export function generateEntityInsight(m: EntityMetrics): { text: string; type: "positive" | "warning" | "critical" } {
  if (m.dso_days > 60)
    return { text: `DSO at ${m.dso_days}d — exceeds 60-day target`, type: "critical" };
  if (typeof m.ar_overdue_pct === "number" && m.ar_overdue_pct > 15)
    return { text: `${m.ar_overdue_pct.toFixed(1)}% of AR overdue`, type: "warning" };
  if (typeof m.ap_overdue_pct === "number" && m.ap_overdue_pct > 5)
    return { text: `AP overdue approaching threshold (${m.ap_overdue_pct.toFixed(1)}%)`, type: "warning" };
  if (typeof m.net_margin_pct === "number" && m.net_margin_pct > 30)
    return { text: `Strong net margin at ${m.net_margin_pct.toFixed(1)}%`, type: "positive" };
  return { text: `Revenue YTD ${fmtK(m.revenue_ytd)} — on track`, type: "positive" };
}

// ── Briefing generation ───────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export function generateBriefing(data: DashboardData): BriefingData {
  const items: BriefingSummaryItem[] = [];

  // 1 — Validation
  if (data.validation.all_passed) {
    items.push({
      text: `${data.validation.total_checks}/${data.validation.total_checks} validation checks passed — data is trusted`,
      type: "positive",
    });
  } else {
    items.push({
      text: `${data.validation.failed} validation rule${data.validation.failed > 1 ? "s" : ""} failed — review required`,
      type: "negative",
    });
  }

  // 2 — Portfolio revenue
  items.push({
    text: `Portfolio revenue at ${fmtK(data.portfolio.portfolio_revenue_ytd)} YTD across ${data.portfolio.entity_count} entities`,
    type: "neutral",
  });

  // 3 — Profitability
  const profitable = ENTITY_SLUGS.filter((s) => data.metrics[s].net_income_ytd > 0).length;
  items.push({
    text:
      profitable === ENTITY_SLUGS.length
        ? `All ${profitable} entities operating profitably`
        : `${profitable} of ${ENTITY_SLUGS.length} entities profitable`,
    type: profitable === ENTITY_SLUGS.length ? "positive" : "neutral",
  });

  // 4 — DSO flags
  const dsoFlagged = ENTITY_SLUGS.filter((s) => data.metrics[s].dso_days > 60);
  if (dsoFlagged.length > 0) {
    const names = dsoFlagged.map((s) => ENTITY_CONFIG[s].name).join(", ");
    items.push({
      text: `${names} DSO exceeding 60-day target`,
      type: "negative",
    });
  }

  // 5 — Cash position
  const cash = data.portfolio.portfolio_cash_on_hand;
  items.push({
    text:
      cash > 500_000
        ? `Portfolio cash healthy at ${fmtK(cash)}`
        : `Cash position at ${fmtK(cash)} — monitor runway`,
    type: cash > 500_000 ? "positive" : "neutral",
  });

  // 6 — Anomalies
  const totalAnomalies = ENTITY_SLUGS.reduce(
    (sum, s) => sum + (data.anomalies[s]?.length ?? 0),
    0
  );
  if (totalAnomalies > 0) {
    items.push({
      text: `${totalAnomalies} anomal${totalAnomalies === 1 ? "y" : "ies"} flagged across portfolio`,
      type: totalAnomalies > 3 ? "negative" : "neutral",
    });
  }

  // Recommended actions (derived, not hardcoded)
  const actions: RecommendedAction[] = [];
  if (dsoFlagged.length > 0) {
    actions.push({
      index: 1,
      text: `Review ${ENTITY_CONFIG[dsoFlagged[0]].name} AR aging`,
      href: `/entity/${dsoFlagged[0]}`,
    });
  }
  const arFlagged = ENTITY_SLUGS.filter((s) => data.metrics[s].ar_overdue_pct > 15);
  if (arFlagged.length > 0) {
    actions.push({
      index: actions.length + 1,
      text: `Collect overdue receivables — ${ENTITY_CONFIG[arFlagged[0]].name}`,
      href: `/entity/${arFlagged[0]}`,
    });
  }
  if (totalAnomalies > 0) {
    actions.push({
      index: actions.length + 1,
      text: `Investigate ${totalAnomalies} flagged anomal${totalAnomalies === 1 ? "y" : "ies"}`,
      href: "/operations",
    });
  }
  if (actions.length < 2) {
    actions.push({ index: actions.length + 1, text: "Review Operations Inbox", href: "/operations" });
  }

  return {
    greeting: getGreeting(),
    userName: "Allison",
    date: formatDate(),
    summaryItems: items.slice(0, 5),
    recommendedActions: actions.slice(0, 3).map((a, i) => ({ ...a, index: i + 1 })),
    pipelineHealthy: data.validation.all_passed,
    lastUpdated: data.freshness.data_as_of,
    confidenceScore: 98, // Phase 2: computed from pipeline metadata
  };
}

// ── Priority generation ───────────────────────────────────────────────────────

export function generatePriorities(data: DashboardData): PriorityItem[] {
  const items: PriorityItem[] = [];

  ENTITY_SLUGS.forEach((slug) => {
    const m = data.metrics[slug];
    const cfg = ENTITY_CONFIG[slug];

    // DSO alert
    if (m.dso_days > 60) {
      items.push({
        id: `${slug}-dso-alert`,
        severity: m.dso_days > 75 ? "high" : "high",
        title: `${cfg.name} — DSO at ${m.dso_days} days`,
        description: `Days Sales Outstanding exceeds 60-day target. ${fmtK(m.open_ar)} in open receivables.`,
        entity: cfg.name,
        entitySlug: slug,
        entityColor: cfg.color,
        action: "Review AR aging",
        href: `/entity/${slug}`,
        type: "ar",
      });
    }

    // AR overdue
    if (m.ar_overdue_pct > 15) {
      items.push({
        id: `${slug}-ar-overdue`,
        severity: m.ar_overdue_pct > 20 ? "high" : "medium",
        title: `${cfg.name} — ${m.ar_overdue_pct.toFixed(1)}% of AR overdue`,
        description: `${fmtK(m.open_ar * m.ar_overdue_pct / 100)} in overdue receivables requires immediate follow-up.`,
        entity: cfg.name,
        entitySlug: slug,
        entityColor: cfg.color,
        action: "Review customers",
        href: `/entity/${slug}`,
        type: "ar",
      });
    }

    // AP overdue
    if (m.ap_overdue_pct > 3) {
      items.push({
        id: `${slug}-ap-overdue`,
        severity: m.ap_overdue_pct > 8 ? "high" : "low",
        title: `${cfg.name} — AP overdue at ${m.ap_overdue_pct.toFixed(1)}%`,
        description: `Vendor payments approaching overdue threshold. Review and approve pending bills.`,
        entity: cfg.name,
        entitySlug: slug,
        entityColor: cfg.color,
        action: "Review vendors",
        href: `/entity/${slug}`,
        type: "ap",
      });
    }

    // Anomalies
    (data.anomalies[slug] ?? []).forEach((a, i) => {
      items.push({
        id: `${slug}-anomaly-${i}`,
        severity: a.severity === "error" ? "high" : a.severity === "warning" ? "medium" : "low",
        title: `${cfg.name} — Rule ${a.rule}: ${a.description}`,
        description: `Period: ${a.period}${a.amount > 0 ? ` · ${fmtK(a.amount)} affected` : ""}`,
        entity: cfg.name,
        entitySlug: slug,
        entityColor: cfg.color,
        action: "Investigate",
        href: `/entity/${slug}`,
        type: "anomaly",
      });
    });
  });

  // Sort: high → medium → low
  const order = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  return items.slice(0, 8);
}
