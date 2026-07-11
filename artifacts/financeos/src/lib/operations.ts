// FinanceOS — Operations Inbox item generation
// Seeds items from mock anomalies, AR/AP flags, banking issues, and customer data.
// IDs match the `financeos_op_statuses` localStorage key used by TodaysPriorities.

import type { Alert, AlertCategory, DashboardData, CustomersData, VendorsData, BankingData, EntitySlug } from "./types";
import { ENTITY_SLUGS } from "./types";
import { ENTITY_CONFIG } from "./entities";

export type OperationSeverity = "high" | "medium" | "low";
export type OperationType = "ar" | "ap" | "anomaly" | "banking" | "reconciliation" | "validation" | "close";
export type OperationStatus = "new" | "acknowledged" | "in_progress" | "resolved";

export const TYPE_LABEL: Record<OperationType, string> = {
  ar:             "AR / Receivables",
  ap:             "AP / Payables",
  anomaly:        "Rule Violation",
  banking:        "Banking",
  reconciliation: "Reconciliation",
  validation:     "Validation",
  close:          "Month-End Close",
};

export type OperationItem = {
  id: string;
  severity: OperationSeverity;
  type: OperationType;
  title: string;
  description: string;
  entity: string;
  entitySlug: EntitySlug | null;
  entityColor: string;
  action: string;
  href: string;
  flaggedDate: string;
  amount?: number;
  details: string[];
};

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export function generateOperationItems(
  data: DashboardData,
  customersMap: Record<EntitySlug, CustomersData>,
  vendorsMap: Record<EntitySlug, VendorsData>,
  bankingMap: Record<EntitySlug, BankingData>
): OperationItem[] {
  const items: OperationItem[] = [];

  ENTITY_SLUGS.forEach((slug) => {
    const m   = data.metrics[slug];
    const cfg = ENTITY_CONFIG[slug];
    const cust = customersMap[slug];
    const vend = vendorsMap[slug];
    const bank = bankingMap[slug];

    // ── AR: DSO alert ───────────────────────────────────────────────────────
    if (m.dso_days > 60) {
      items.push({
        id:          `${slug}-dso-alert`,
        severity:    "high",
        type:        "ar",
        title:       `${cfg.name} — DSO at ${m.dso_days} days`,
        description: `Days Sales Outstanding exceeds the 60-day policy threshold. ${fmtK(m.open_ar)} in open receivables.`,
        entity:      cfg.name,
        entitySlug:  slug,
        entityColor: cfg.color,
        action:      "Review AR aging",
        href:        `/entity/${slug}/customers`,
        flaggedDate: "2026-07-02",
        amount:      m.open_ar,
        details: [
          `Current DSO: ${m.dso_days} days (policy threshold: 60 days)`,
          `Open AR balance: ${fmtK(m.open_ar)}`,
          `AR overdue %: ${m.ar_overdue_pct.toFixed(1)}%`,
          "Action: Contact overdue customers and escalate invoices older than 60 days",
          "Next step: Pull AR aging report and identify top 3 past-due accounts",
        ],
      });
    }

    // ── AR: Overdue % alert ─────────────────────────────────────────────────
    if (m.ar_overdue_pct > 15) {
      const overdueAmt = m.open_ar * (m.ar_overdue_pct / 100);
      items.push({
        id:          `${slug}-ar-overdue`,
        severity:    m.ar_overdue_pct > 20 ? "high" : "medium",
        type:        "ar",
        title:       `${cfg.name} — ${m.ar_overdue_pct.toFixed(1)}% of AR overdue`,
        description: `${fmtK(overdueAmt)} in overdue receivables requires immediate follow-up.`,
        entity:      cfg.name,
        entitySlug:  slug,
        entityColor: cfg.color,
        action:      "Review customers",
        href:        `/entity/${slug}/customers`,
        flaggedDate: "2026-07-02",
        amount:      overdueAmt,
        details: [
          `Overdue amount: ${fmtK(overdueAmt)} (${m.ar_overdue_pct.toFixed(1)}% of ${fmtK(m.open_ar)} total AR)`,
          `Policy threshold: 10% — currently ${(m.ar_overdue_pct - 10).toFixed(1)}% above limit`,
          "Action: Send collection notices to all accounts 31+ days past due",
          "Action: Escalate 90+ day accounts to collections or credit hold",
        ],
      });
    }

    // ── AR: Individual overdue customers (late 90+) ─────────────────────────
    if (cust) {
      cust.top_customers.forEach((c, i) => {
        if (c.status === "late") {
          items.push({
            id:          `${slug}-customer-late-${i}`,
            severity:    "medium",
            type:        "ar",
            title:       `${cfg.name} — ${c.name}: ${c.dso_days}d outstanding`,
            description: `Invoice unpaid for ${c.dso_days} days. Balance ${fmtK(c.balance)}. Last payment ${c.last_payment_date}.`,
            entity:      cfg.name,
            entitySlug:  slug,
            entityColor: cfg.color,
            action:      "View customer",
            href:        `/entity/${slug}/customers`,
            flaggedDate: "2026-07-02",
            amount:      c.balance,
            details: [
              `Customer: ${c.name}`,
              `Outstanding balance: ${fmtK(c.balance)}`,
              `Days outstanding: ${c.dso_days} days`,
              `Last payment received: ${c.last_payment_date}`,
              "Action: Issue formal demand notice and suspend services if applicable",
            ],
          });
        }
      });
    }

    // ── AP: Overdue % alert ─────────────────────────────────────────────────
    if (m.ap_overdue_pct > 3) {
      items.push({
        id:          `${slug}-ap-overdue`,
        severity:    m.ap_overdue_pct > 8 ? "high" : "low",
        type:        "ap",
        title:       `${cfg.name} — AP overdue at ${m.ap_overdue_pct.toFixed(1)}%`,
        description: `Vendor payments approaching overdue threshold. Review and approve pending bills.`,
        entity:      cfg.name,
        entitySlug:  slug,
        entityColor: cfg.color,
        action:      "Review vendors",
        href:        `/entity/${slug}/vendors`,
        flaggedDate: "2026-07-02",
        amount:      m.open_ap * (m.ap_overdue_pct / 100),
        details: [
          `Open AP: ${fmtK(m.open_ap)}`,
          `Overdue: ${m.ap_overdue_pct.toFixed(1)}% (policy threshold: 5%)`,
          `Overdue amount: ${fmtK(m.open_ap * m.ap_overdue_pct / 100)}`,
          "Action: Review bills due within 7 days and schedule payment runs",
          "Action: Contact vendors with overdue balances to avoid late fees",
        ],
      });
    }

    // ── AP: Individual overdue vendors ──────────────────────────────────────
    if (vend) {
      vend.top_vendors.forEach((v, i) => {
        if (v.status === "overdue") {
          items.push({
            id:          `${slug}-vendor-overdue-${i}`,
            severity:    "low",
            type:        "ap",
            title:       `${cfg.name} — ${v.name}: payment overdue`,
            description: `Bill was due ${v.due_date}. Balance ${fmtK(v.balance)}. Schedule payment to avoid late fees.`,
            entity:      cfg.name,
            entitySlug:  slug,
            entityColor: cfg.color,
            action:      "Review vendor",
            href:        `/entity/${slug}/vendors`,
            flaggedDate: "2026-07-02",
            amount:      v.balance,
            details: [
              `Vendor: ${v.name}`,
              `Balance due: ${fmtK(v.balance)}`,
              `Due date: ${v.due_date}`,
              "Status: Overdue",
              "Action: Approve payment in next payment run or contact vendor",
            ],
          });
        }
      });
    }

    // ── Anomalies (rule violations) ──────────────────────────────────────────
    (data.anomalies[slug] ?? []).forEach((a, i) => {
      items.push({
        id:          `${slug}-anomaly-${i}`,
        severity:    a.severity === "error" ? "high" : a.severity === "warning" ? "medium" : "low",
        type:        "anomaly",
        title:       `${cfg.name} — Rule ${a.rule}: ${a.description}`,
        description: `Period: ${a.period}${a.amount > 0 ? ` · ${fmtK(a.amount)} affected` : ""}`,
        entity:      cfg.name,
        entitySlug:  slug,
        entityColor: cfg.color,
        action:      "Investigate",
        href:        `/entity/${slug}/financials`,
        flaggedDate: "2026-07-02",
        amount:      a.amount > 0 ? a.amount : undefined,
        details: [
          `Rule: ${a.rule}`,
          `Severity: ${a.severity}`,
          `Period: ${a.period}`,
          ...(a.amount > 0 ? [`Amount affected: ${fmtK(a.amount)}`] : []),
          `Description: ${a.description}`,
          "Action: Review transactions in the affected period and add a memo explaining the variance",
        ],
      });
    });

    // ── Banking: Unreconciled items ─────────────────────────────────────────
    if (bank && bank.reconciliation_status === "needs_review" && bank.unreconciled_count > 0) {
      items.push({
        id:          `${slug}-banking-unreconciled`,
        severity:    "medium",
        type:        "banking",
        title:       `${cfg.name} — ${bank.unreconciled_count} unreconciled transaction${bank.unreconciled_count !== 1 ? "s" : ""}`,
        description: `${bank.unreconciled_count} bank transaction${bank.unreconciled_count !== 1 ? "s" : ""} have not been reconciled. Accounts last fully reconciled May 2026.`,
        entity:      cfg.name,
        entitySlug:  slug,
        entityColor: cfg.color,
        action:      "Review banking",
        href:        `/entity/${slug}/banking`,
        flaggedDate: "2026-07-02",
        details: [
          `Unreconciled transactions: ${bank.unreconciled_count}`,
          `Affected accounts: ${bank.accounts.filter(a => !a.reconciled).map(a => a.name).join(", ")}`,
          `Last full reconciliation: May 2026`,
          "Action: Match unreconciled transactions to bank statements",
          "Action: Mark transactions as reconciled once verified",
        ],
      });
    }
  });

  // Sort: high → medium → low, then by entity name
  const order: Record<OperationSeverity, number> = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => {
    if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
    return a.entity.localeCompare(b.entity);
  });

  return items;
}

// ── Rules Engine alert adapter (Sprint 14) ──────────────────────────────────
// Maps live Alert[] (from GET /api/alerts) into the OperationItem shape the
// existing OperationsInbox component already renders. No new components.

const ALERT_CATEGORY_TO_TYPE: Record<AlertCategory, OperationType> = {
  receivables: "ar",
  payables: "ap",
  cash: "banking",
  revenue: "anomaly",
  validation: "validation",
  portfolio: "anomaly",
};

const ALERT_CATEGORY_TO_HREF_SEGMENT: Record<AlertCategory, string> = {
  receivables: "customers",
  payables: "vendors",
  cash: "banking",
  revenue: "financials",
  validation: "financials",
  portfolio: "financials",
};

const ENTITY_NAME_TO_SLUG: Record<string, EntitySlug> = Object.fromEntries(
  ENTITY_SLUGS.map((slug) => [ENTITY_CONFIG[slug].name, slug])
);

function alertSeverityToOperationSeverity(severity: Alert["severity"]): OperationSeverity {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

export function alertsToOperationItems(alerts: Alert[]): OperationItem[] {
  return alerts.map((alert) => {
    const entitySlug = ENTITY_NAME_TO_SLUG[alert.entity] ?? null;
    const entityColor = entitySlug ? ENTITY_CONFIG[entitySlug].color : "#9CA3AF";
    const hrefSegment = ALERT_CATEGORY_TO_HREF_SEGMENT[alert.category];

    return {
      id: alert.id,
      severity: alertSeverityToOperationSeverity(alert.severity),
      type: ALERT_CATEGORY_TO_TYPE[alert.category],
      title: alert.title,
      description: alert.description,
      entity: alert.entity,
      entitySlug,
      entityColor,
      action: alert.recommendedAction,
      href: entitySlug ? `/entity/${entitySlug}/${hrefSegment}` : "/operations",
      flaggedDate: alert.createdAt.slice(0, 10),
      details: [alert.description, `Recommended action: ${alert.recommendedAction}`],
    };
  });
}
