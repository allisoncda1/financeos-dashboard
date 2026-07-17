/**
 * Executive Package renderer.
 *
 * Concise 5-page management summary: core KPIs, performance vs prior period,
 * cash/liquidity, top risks and opportunities, and immediate actions.
 * Deliberately shorter than monthly-close or board-package.
 */

import type { BuiltReport } from "../builder.js";
import {
  escHtml,
  fmtCurrency,
  fmtPercent,
  amountCell,
  varianceCell,
  refSectionHeader,
  refKpiRow,
  refNarrative,
  refSubHeading,
  svgGroupedBars,
} from "./designSystem.js";
import {
  wrapPage,
  buildCoverPage,
  buildReportHtml,
  buildReportHeaderFn,
  SHELL_EXTRA_STYLES,
  type HeaderFn,
} from "./reportShell.js";
import {
  getCtxParagraphs,
  getCtxHeading,
  getCtxTitle,
  renderApprovalBadge,
} from "./narrativeRendering.js";

// ─── Local types ──────────────────────────────────────────────────────────────

interface EntityMetrics {
  entity: string; slug: string; basis: string; as_of: string;
  revenue_ytd: number; cogs_ytd: number; gross_profit_ytd: number; gross_margin_pct: number;
  opex_ytd: number; net_income_ytd: number; net_margin_pct: number;
  total_assets: number; total_liabilities: number; total_equity: number;
  open_ar: number; open_ap: number;
  dso_days: number | null; dso_days_standard: number | null;
  weighted_average_days_overdue: number | null; dpo_days: number | null;
  cash_on_hand: number; ar_overdue_pct: number; ap_overdue_pct: number;
}

interface MonthlyPL {
  month: string; revenue: number; cogs: number;
  gross_profit: number; opex: number; net_income: number;
}

interface FinancialsData {
  entity_slug: string; as_of: string;
  monthly_pl?: MonthlyPL[];
  balance_sheet?: {
    as_of: string;
    assets: { cash: number; accounts_receivable: number; prepaid_expenses: number; equipment_net: number; total: number };
    liabilities: { accounts_payable: number; accrued_liabilities: number; deferred_revenue: number; notes_payable: number; total: number };
    equity: { paid_in_capital: number; retained_earnings: number; total: number };
  };
}

interface Alert {
  entity: string; title: string; description: string; severity: string;
  recommended_action?: string; financial_impact?: string;
}

interface EntitySection { metrics: EntityMetrics; anomalies: unknown[]; }

// ─── Table helpers ────────────────────────────────────────────────────────────

function refTable(head: string, rows: string): string {
  return `<table class="ref-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}
function th(text: string, align: "left"|"right"|"center" = "left"): string {
  return `<th style="text-align:${align}">${escHtml(text)}</th>`;
}
function td(text: string, align: "left"|"right"|"center" = "left", bold = false): string {
  return `<td style="text-align:${align}${bold ? ";font-weight:600" : ""}">${escHtml(text)}</td>`;
}
function tdRaw(html: string, align: "left"|"right"|"center" = "left"): string {
  return `<td style="text-align:${align}">${html}</td>`;
}
function tr(...cells: string[]): string { return `<tr>${cells.join("")}</tr>`; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ac(v: number | null | undefined): string { return amountCell(v).html; }

function curAndPrv(pl?: MonthlyPL[]): { cur: MonthlyPL|null; prv: MonthlyPL|null } {
  if (!pl?.length) return { cur: null, prv: null };
  return { cur: pl[pl.length-1] ?? null, prv: pl.length >= 2 ? (pl[pl.length-2] ?? null) : null };
}

function shortMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m)-1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

// ─── P1: Executive Overview ───────────────────────────────────────────────────

function buildExecOverviewPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const { cur, prv } = curAndPrv(first.fin.monthly_pl);

  const kpis = refKpiRow([
    { label: "Revenue YTD", value: fmtCurrency(first.m.revenue_ytd) },
    { label: "Net Income YTD", value: fmtCurrency(first.m.net_income_ytd), sub: `${fmtPercent(first.m.net_margin_pct)} margin` },
    { label: "Gross Margin", value: fmtPercent(first.m.gross_margin_pct) },
    { label: "Cash on Hand", value: first.m.cash_on_hand < 0 ? `(${fmtCurrency(Math.abs(first.m.cash_on_hand))})` : fmtCurrency(first.m.cash_on_hand) },
    { label: "Open AR", value: fmtCurrency(first.m.open_ar), sub: `${fmtPercent(first.m.ar_overdue_pct)} overdue` },
    { label: "Open AP", value: fmtCurrency(first.m.open_ap) },
  ]);

  const narrative = [
    `${first.m.entity} reported ${fmtCurrency(first.m.revenue_ytd)} in year-to-date revenue with a ${fmtPercent(first.m.gross_margin_pct)} gross margin and ${first.m.net_income_ytd < 0 ? "a net loss" : "net income"} of ${fmtCurrency(Math.abs(first.m.net_income_ytd))} (${fmtPercent(Math.abs(first.m.net_margin_pct))} ${first.m.net_income_ytd < 0 ? "loss" : "margin"}).`,
    first.m.cash_on_hand < 0
      ? `Cash on hand is negative at (${fmtCurrency(Math.abs(first.m.cash_on_hand))}). Immediate focus on AR collections is required.`
      : `Cash on hand stands at ${fmtCurrency(first.m.cash_on_hand)}. AR of ${fmtCurrency(first.m.open_ar)} includes ${fmtPercent(first.m.ar_overdue_pct)} overdue.`,
  ];

  const chartHtml = cur && prv
    ? svgGroupedBars(
        ["Revenue", "Gross Profit", "Net Income"],
        [
          { label: shortMonth(prv.month), color: "#cbd5e1", values: [prv.revenue, prv.gross_profit, prv.net_income] },
          { label: shortMonth(cur.month), color: "#2563eb", values: [cur.revenue, cur.gross_profit, cur.net_income] },
        ],
        { width: 520, height: 160, title: "Current vs. Prior Month" },
      )
    : "";

  const execNarrative = getCtxParagraphs(report, "executive_summary", narrative);
  const execHeading   = getCtxHeading(report, "executive_summary", "Executive Overview");

  return wrapPage(`
    ${headerFn(`${report.period} Executive Package`)}
    ${renderApprovalBadge(report)}
    ${refSectionHeader(1, "EXECUTIVE OVERVIEW", execHeading)}
    ${refNarrative(...execNarrative)}
    ${kpis}
    ${chartHtml ? `<div style="margin:12pt 0 8pt;">${chartHtml}</div>` : ""}
  `);
}

// ─── P2: Performance vs Prior Period ─────────────────────────────────────────

function buildPerformancePage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const { cur, prv } = curAndPrv(first.fin.monthly_pl);
  const bs = first.fin.balance_sheet;
  const cashVal = bs?.assets.cash ?? first.m.cash_on_hand;

  const rows = [
    tr(td("Revenue"), tdRaw(ac(cur?.revenue ?? first.m.revenue_ytd), "right"), tdRaw(prv ? varianceCell(cur?.revenue ?? 0, prv.revenue) : td("—", "right"))),
    tr(td("Gross Profit"), tdRaw(ac(cur?.gross_profit ?? first.m.gross_profit_ytd), "right"), tdRaw(prv ? varianceCell(cur?.gross_profit ?? 0, prv.gross_profit) : td("—", "right"))),
    tr(td("Net Income"), tdRaw(ac(cur?.net_income ?? first.m.net_income_ytd), "right"), tdRaw(prv ? varianceCell(cur?.net_income ?? 0, prv.net_income) : td("—", "right"))),
    tr(td("Cash on Hand"), tdRaw(ac(cashVal), "right"), td("—", "right")),
    tr(td("Open AR"), tdRaw(ac(first.m.open_ar), "right"), td("—", "right")),
    tr(td("Open AP"), tdRaw(ac(first.m.open_ap), "right"), td("—", "right")),
  ].join("");

  const portfolioRows = entities.length > 1
    ? entities.map(({ m }) => tr(
        td(m.entity), tdRaw(ac(m.revenue_ytd), "right"), tdRaw(ac(m.net_income_ytd), "right"),
        td(fmtPercent(m.net_margin_pct), "right"), tdRaw(ac(m.cash_on_hand), "right"),
      )).join("")
    : "";

  return wrapPage(`
    ${headerFn(`${report.period} Executive Package`)}
    ${refSectionHeader(2, "PERFORMANCE VS PRIOR PERIOD", "Performance vs. Prior Period")}
    ${refSubHeading(cur ? `${shortMonth(cur.month)} — Month-over-Month` : "Performance Summary")}
    ${refTable(tr(th("Metric"), th("Current Period", "right"), th("vs. Prior Month", "right")), rows)}
    ${portfolioRows ? `${refSubHeading("Entity Comparison — Year to Date")}${refTable(tr(th("Entity"), th("Revenue YTD", "right"), th("Net Income YTD", "right"), th("Net Margin", "right"), th("Cash on Hand", "right")), portfolioRows)}` : ""}
  `);
}

// ─── P3: Cash & Liquidity ─────────────────────────────────────────────────────

function buildCashPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const bs = first.fin.balance_sheet;

  const wc = [
    tr(td("Cash on Hand"), tdRaw(ac(first.m.cash_on_hand), "right")),
    tr(td("Accounts Receivable"), tdRaw(ac(first.m.open_ar), "right")),
    tr(td("Accounts Payable"), tdRaw(ac(first.m.open_ap), "right")),
    tr(td("DSO"), td(first.m.dso_days != null ? `${first.m.dso_days} days` : "—", "right")),
    tr(td("DPO"), td(first.m.dpo_days != null ? `${first.m.dpo_days} days` : "—", "right")),
    tr(td("AR Overdue"), td(`${fmtPercent(first.m.ar_overdue_pct)} of Open AR`, "right")),
  ].join("");

  const bsRows = bs ? [
    tr(td("Total Assets"), tdRaw(ac(bs.assets.total), "right")),
    tr(td("Total Liabilities"), tdRaw(ac(bs.liabilities.total), "right")),
    tr(td("Total Equity"), tdRaw(ac(bs.equity.total), "right")),
  ].join("") : "";

  const narrative = first.m.cash_on_hand < 0
    ? [`Cash is negative at (${fmtCurrency(Math.abs(first.m.cash_on_hand))}). With ${fmtCurrency(first.m.open_ar)} in open receivables, accelerating collections is the primary liquidity action.`]
    : [`Cash on hand is ${fmtCurrency(first.m.cash_on_hand)} with ${fmtCurrency(first.m.open_ar)} in receivables. ${fmtPercent(first.m.ar_overdue_pct)} of AR is overdue.`];

  return wrapPage(`
    ${headerFn(`${report.period} Executive Package`)}
    ${refSectionHeader(3, "CASH & LIQUIDITY", "Cash and Liquidity")}
    ${refNarrative(...narrative)}
    ${refSubHeading("Working Capital")}
    ${refTable(tr(th("Metric"), th("Amount", "right")), wc)}
    ${bsRows ? `${refSubHeading("Balance Sheet Snapshot")}${refTable(tr(th("Item"), th("Amount", "right")), bsRows)}` : ""}
  `);
}

// ─── P4: Top Risks & Opportunities ───────────────────────────────────────────

function buildRisksOpportunitiesPage(report: BuiltReport, alerts: Alert[], headerFn: HeaderFn): string {
  const sections_data = report.sections as Record<string, unknown>;
  const recommendations = sections_data.recommendations as { priorities?: { title: string; description: string }[]; opportunities?: { title: string; description: string }[] } | undefined;

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const topAlerts = [...alerts].sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)).slice(0, 5);

  const alertRows = topAlerts.length > 0
    ? topAlerts.map((a) => {
        const badge = a.severity === "critical"
          ? `<span style="background:#fee2e2;color:#b91c1c;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:600">CRITICAL</span>`
          : a.severity === "high"
          ? `<span style="background:#fef3c7;color:#92400e;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:600">HIGH</span>`
          : `<span style="background:#e0f2fe;color:#0369a1;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:600">${escHtml(a.severity.toUpperCase())}</span>`;
        return tr(tdRaw(badge), td(a.title), td(a.entity), td(a.description));
      }).join("")
    : tr(td("No active alerts", "left"), td(""), td(""), td(""));

  const opps = (recommendations?.opportunities ?? []).slice(0, 4);
  const oppRows = opps.length > 0
    ? opps.map((o) => tr(td(o.title, "left", true), td(o.description))).join("")
    : tr(td("No opportunities defined for this period"), td(""));

  return wrapPage(`
    ${headerFn(`${report.period} Executive Package`)}
    ${refSectionHeader(4, "RISKS & OPPORTUNITIES", "Top Risks and Opportunities")}
    ${refSubHeading("Active Risks")}
    ${refTable(tr(th("Level"), th("Title"), th("Entity"), th("Summary")), alertRows)}
    ${refSubHeading("Key Opportunities")}
    ${refTable(tr(th("Opportunity"), th("Description")), oppRows)}
  `);
}

// ─── P5: Immediate Management Actions ────────────────────────────────────────

function buildActionsPage(report: BuiltReport, headerFn: HeaderFn): string {
  const sections_data = report.sections as Record<string, unknown>;
  const recommendations = sections_data.recommendations as { priorities?: { title: string; description: string }[] } | undefined;
  const priorities = recommendations?.priorities ?? [];

  const rows = priorities.length > 0
    ? priorities.slice(0, 8).map((p, i) =>
        tr(td(String(i+1), "center"), td(p.title, "left", true), td(p.description), td("Owner", "center"), td("This period", "center")),
      ).join("")
    : tr(td("No action items defined.", "left"), td(""), td(""), td(""), td(""));

  return wrapPage(`
    ${headerFn(`${report.period} Executive Package`)}
    ${refSectionHeader(5, "MANAGEMENT ACTIONS", "Immediate Management Actions")}
    ${refTable(
      tr(th("#", "center"), th("Action"), th("Detail"), th("Owner", "center"), th("Timing", "center")),
      rows,
    )}
  `);
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function renderExecutivePackage(report: BuiltReport): string {
  const sections_data = report.sections as Record<string, unknown>;
  const entitySummary = (sections_data.entity_summary ?? {}) as Record<string, EntitySection>;
  const financials = (sections_data.financials ?? {}) as Record<string, FinancialsData>;
  const alerts = (sections_data.alerts as Alert[]) ?? [];

  const entities = report.branding.entities
    .map(({ slug }) => {
      const sec = entitySummary[slug];
      const fin = financials[slug];
      if (!sec || !fin) return null;
      return { slug, m: sec.metrics, fin };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const { headerFn, primaryName, primaryColor, isPortfolio } = buildReportHeaderFn(report);
  const focusEntities = isPortfolio ? entities : entities.slice(0, 1);
  const accent = primaryColor;

  if (focusEntities.length === 0) {
    return `<!DOCTYPE html><html><body><p>No entity data available.</p></body></html>`;
  }

  const pages: string[] = [
    buildCoverPage(report, {
      eyebrow: isPortfolio ? "PORTFOLIO EXECUTIVE PACKAGE" : "EXECUTIVE PACKAGE",
      subtitle: "Condensed Management Summary",
    }),
    buildExecOverviewPage(report, focusEntities, headerFn),
    buildPerformancePage(report, focusEntities, headerFn),
    buildCashPage(report, focusEntities, headerFn),
    buildRisksOpportunitiesPage(report, alerts, headerFn),
    buildActionsPage(report, headerFn),
  ];

  return buildReportHtml({
    title: getCtxTitle(report, `${primaryName} — ${report.period} Executive Package`),
    accent,
    pages,
    extraStyles: SHELL_EXTRA_STYLES,
  });
}
