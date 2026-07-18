/**
 * Investor Update renderer.
 *
 * IMPORTANT: This renderer intentionally omits all internal pipeline details,
 * close status, validation runs, QBO connection status, and action item logs.
 * External distribution only — investor-safe content only.
 */

import type { BuiltReport } from "../builder.js";
import {
  escHtml,
  fmtCurrency,
  fmtPercent,
  amountCell,
  svgSimpleBars,
  svgGroupedBars,
  svgHBarRef,
  svgLineRef,
  refSectionHeader,
  refKpiRow,
  refInsightPanel,
  refNarrative,
  refSmallNote,
  refSubHeading,
  emptyState,
} from "./designSystem.js";
import {
  entityColor,
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
  open_ar: number; open_ap: number; dso_days: number | null; dso_days_standard: number | null;
  weighted_average_days_overdue: number | null; dpo_days: number | null;
  cash_on_hand: number; ar_overdue_pct: number; ap_overdue_pct: number;
}
interface MonthlyPL { month: string; revenue: number; cogs: number; gross_profit: number; opex: number; net_income: number; }
interface FinancialsData {
  entity_slug: string; as_of: string; monthly_pl?: MonthlyPL[];
  ytd_summary?: { revenue: number; cogs: number; gross_profit: number; opex: number; net_income: number };
  balance_sheet?: { as_of: string; assets: { cash: number; accounts_receivable: number; prepaid_expenses: number; equipment_net: number; total: number }; liabilities: { accounts_payable: number; accrued_liabilities: number; deferred_revenue: number; notes_payable: number; total: number }; equity: { paid_in_capital: number; retained_earnings: number; total: number } };
  cash_history?: { label: string; value: number }[];
}
interface Alert { entity: string; title: string; description: string; severity: string; recommended_action?: string; financial_impact?: string; }
interface EntitySection { metrics: EntityMetrics; anomalies: unknown[]; }

// ─── Table helpers ────────────────────────────────────────────────────────────

function refTable(head: string, rows: string): string {
  return `<table class="ref-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}
function th(text: string, align: "left" | "right" | "center" = "left"): string { return `<th style="text-align:${align}">${escHtml(text)}</th>`; }
function td(text: string, align: "left" | "right" | "center" = "left", bold = false): string { return `<td style="text-align:${align}${bold ? ";font-weight:600" : ""}">${escHtml(text)}</td>`; }
function tdRaw(html: string, align: "left" | "right" | "center" = "left", bold = false): string { return `<td style="text-align:${align}${bold ? ";font-weight:600" : ""}">${html}</td>`; }
function tr(...cells: string[]): string { return `<tr>${cells.join("")}</tr>`; }
function trTotal(...cells: string[]): string { return `<tr class="total">${cells.join("")}</tr>`; }

function ac(v: number | null | undefined): string { return amountCell(v).html; }

function fmtMonthName(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long" });
}
function fmtMonthShort(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
}

// ─── Page builders ────────────────────────────────────────────────────────────

function buildInvestorHighlightsPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const pl = first.fin.monthly_pl ?? [];
  const cur = pl[pl.length - 1] ?? null;

  const highlights: string[] = [];
  if (first.m.net_income_ytd >= 0) {
    highlights.push(`Profitable operations with ${fmtPercent(first.m.net_margin_pct)} net margin year to date.`);
  }
  if (pl.length >= 2) {
    const first_pl = pl[0]!;
    const last_pl = pl[pl.length - 1]!;
    const revGrowth = first_pl.revenue > 0 ? ((last_pl.revenue - first_pl.revenue) / first_pl.revenue) * 100 : null;
    if (revGrowth != null && revGrowth > 0) {
      highlights.push(`Revenue grew ${revGrowth.toFixed(1)}% from ${fmtMonthName(first_pl.month)} through ${fmtMonthName(last_pl.month)}.`);
    }
  }
  if (first.m.gross_margin_pct >= 55) {
    highlights.push(`High-quality gross margin of ${fmtPercent(first.m.gross_margin_pct)} reflects strong unit economics.`);
  }
  if (first.m.cash_on_hand > 0) {
    highlights.push(`Positive cash position of ${fmtCurrency(first.m.cash_on_hand)} with no immediate liquidity concerns.`);
  }
  if (highlights.length === 0) {
    highlights.push(`Operating results for ${report.period} are presented in the sections below.`);
  }

  const highlightNarrative = getCtxParagraphs(report, "executive_summary", [
    `${first.m.entity} presents the following performance highlights for ${report.period}.`,
    ...highlights,
  ]);
  const highlightHeading = getCtxHeading(report, "executive_summary", "Company Highlights");

  return wrapPage(`
    ${headerFn(`${report.period} Investor Update`)}
    ${renderApprovalBadge(report)}
    ${refSectionHeader(null, "HIGHLIGHTS", highlightHeading)}
    ${refNarrative(...highlightNarrative)}
    ${refKpiRow([
      { label: "Revenue YTD", value: fmtCurrency(first.m.revenue_ytd), change: "", changeClass: "neu" },
      { label: "Gross Margin", value: fmtPercent(first.m.gross_margin_pct), change: "", changeClass: "neu" },
      { label: "Net Income YTD", value: first.m.net_income_ytd < 0 ? `(${fmtCurrency(Math.abs(first.m.net_income_ytd))})` : fmtCurrency(first.m.net_income_ytd), change: "", changeClass: "neu" },
      { label: "Cash on Hand", value: first.m.cash_on_hand < 0 ? `(${fmtCurrency(Math.abs(first.m.cash_on_hand))})` : fmtCurrency(first.m.cash_on_hand), change: "", changeClass: "neu" },
    ])}
  `);
}

function buildInvestorFinancialPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const ytd = first.fin.ytd_summary;

  const rows = [
    tr(td("Revenue"), tdRaw(ac(ytd?.revenue ?? first.m.revenue_ytd), "right")),
    tr(td("Cost of Revenue"), tdRaw(ac(ytd?.cogs ?? first.m.cogs_ytd), "right")),
    trTotal(td("Gross Profit", "left", true), tdRaw(ac(ytd?.gross_profit ?? first.m.gross_profit_ytd), "right", true)),
    tr(td("Operating Expenses"), tdRaw(ac(ytd?.opex ?? first.m.opex_ytd), "right")),
    trTotal(td("Net Income", "left", true), tdRaw(ac(ytd?.net_income ?? first.m.net_income_ytd), "right", true)),
  ].join("");

  return wrapPage(`
    ${headerFn(`${report.period} Investor Update`)}
    ${refSectionHeader(1, "FINANCIAL PERFORMANCE", "Financial Performance")}
    ${refTable(tr(th("Line Item"), th("Year to Date", "right")), rows)}
    ${refSmallNote("Management accounts prepared from QuickBooks Online. Not an audited financial statement.")}
  `);
}

function buildInvestorRevenuePage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const pl = first.fin.monthly_pl ?? [];

  const chart = pl.length >= 2
    ? svgSimpleBars(
        pl.map((x) => ({ label: fmtMonthShort(x.month), value: x.revenue })),
        { width: 520, height: 180, color: "#00d4b8", title: "Monthly Revenue" },
      )
    : emptyState("Insufficient monthly data for revenue trend chart.");

  const cur = pl[pl.length - 1] ?? null;
  const prev = pl.length >= 2 ? pl[pl.length - 2] ?? null : null;
  const revGrowth = cur && prev && prev.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : null;

  return wrapPage(`
    ${headerFn(`${report.period} Investor Update`)}
    ${refSectionHeader(2, "REVENUE GROWTH", "Revenue and Growth")}
    <div style="margin:14pt 0 8pt;">${chart}</div>
    ${refNarrative(
      `Year-to-date revenue is ${fmtCurrency(first.m.revenue_ytd)} on a ${first.m.basis}-basis.`,
      revGrowth != null ? `The most recent month-over-month revenue change was ${revGrowth > 0 ? "+" : ""}${revGrowth.toFixed(1)}%, from ${fmtCurrency(prev!.revenue)} in ${fmtMonthName(prev!.month)} to ${fmtCurrency(cur!.revenue)} in ${fmtMonthName(cur!.month)}.` : "",
    ).replace(/<p><\/p>/g, "")}
  `);
}

function buildInvestorMarginPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const pl = first.fin.monthly_pl ?? [];

  const marginChart = pl.length >= 2
    ? svgLineRef(
        pl.map((x) => ({ label: fmtMonthShort(x.month), value: x.revenue > 0 ? (x.net_income / x.revenue) * 100 : 0 })),
        { width: 520, height: 155, color: "#6366f1", title: "Net Margin % — Monthly", yFormat: "percent" },
      )
    : "";

  return wrapPage(`
    ${headerFn(`${report.period} Investor Update`)}
    ${refSectionHeader(3, "PROFITABILITY", "Profitability and Margin")}
    ${refKpiRow([
      { label: "Gross Margin", value: fmtPercent(first.m.gross_margin_pct), change: "", changeClass: "neu" },
      { label: "Net Margin", value: `${fmtPercent(Math.abs(first.m.net_margin_pct))}${first.m.net_margin_pct < 0 ? " (loss)" : ""}`, change: "", changeClass: "neu" },
      { label: "Gross Profit YTD", value: fmtCurrency(first.m.gross_profit_ytd), change: "", changeClass: "neu" },
    ])}
    ${marginChart ? `<div style="margin:14pt 0 8pt;">${marginChart}</div>` : ""}
    ${refNarrative(
      `Gross margin for the year-to-date period is ${fmtPercent(first.m.gross_margin_pct)}, reflecting cost-of-revenue efficiency of ${fmtPercent(100 - first.m.gross_margin_pct)}.`,
      `Net margin is ${fmtPercent(Math.abs(first.m.net_margin_pct))}${first.m.net_margin_pct < 0 ? " (loss)" : ""} after operating expenses of ${fmtCurrency(first.m.opex_ytd)}.`,
    )}
  `);
}

function buildInvestorCashPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const cash = first.m.cash_on_hand;
  const cashHistory = first.fin.cash_history ?? [];

  const cashChart = cashHistory.length >= 2
    ? svgLineRef(cashHistory, { width: 520, height: 155, color: cash < 0 ? "#ef4444" : "#00d4b8", title: "Cash Balance" })
    : "";

  return wrapPage(`
    ${headerFn(`${report.period} Investor Update`)}
    ${refSectionHeader(4, "CASH AND RUNWAY", "Cash and Liquidity")}
    ${refKpiRow([
      { label: "Cash on Hand", value: cash < 0 ? `(${fmtCurrency(Math.abs(cash))})` : fmtCurrency(cash), change: "", changeClass: "neu" },
      { label: "Open AR", value: fmtCurrency(first.m.open_ar), change: "", changeClass: "neu" },
    ])}
    ${cashChart ? `<div style="margin:14pt 0 8pt;">${cashChart}</div>` : ""}
    ${refNarrative(`Cash on hand as of the reporting date is ${cash < 0 ? `a deficit of (${fmtCurrency(Math.abs(cash))})` : fmtCurrency(cash)}.`)}
  `);
}

function buildInvestorARPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const m = first.m;
  const overdueAmt = m.open_ar * (m.ar_overdue_pct / 100);

  return wrapPage(`
    ${headerFn(`${report.period} Investor Update`)}
    ${refSectionHeader(5, "ACCOUNTS RECEIVABLE", "AR Summary")}
    ${refKpiRow([
      { label: "Open AR", value: fmtCurrency(m.open_ar), change: "", changeClass: "neu" },
      { label: "Overdue Amount", value: fmtCurrency(overdueAmt), sub: `${fmtPercent(m.ar_overdue_pct)} of total`, change: "", changeClass: "neu" },
      { label: "DSO", value: m.dso_days != null ? `${m.dso_days} days` : "—", change: "", changeClass: "neu" },
    ])}
    ${refNarrative(
      `Total accounts receivable are ${fmtCurrency(m.open_ar)}, of which ${fmtPercent(m.ar_overdue_pct)} (${fmtCurrency(overdueAmt)}) is overdue as of the reporting date.`,
      m.dso_days != null ? `Days Sales Outstanding is ${m.dso_days} days${m.dso_days_standard != null ? ` (standard: ${m.dso_days_standard} days)` : ""}.` : "",
    )}
  `);
}

function buildInvestorRisksPage(report: BuiltReport, alerts: Alert[], headerFn: HeaderFn): string {
  // Only expose critical and high — not medium/low/internal
  const material = alerts.filter((a) => a.severity === "critical" || a.severity === "high");

  const panels = material.length > 0
    ? material.map((a) => {
        const variant: "red" | "amber" = a.severity === "critical" ? "red" : "amber";
        const badgeLabel = a.severity === "critical" ? "CRITICAL" : "HIGH";
        // Investor-safe: entity + title + description only (no pipeline_run, no qbo details)
        return refInsightPanel(a.title, `${a.description} Entity: ${a.entity}.${a.financial_impact ? ` Financial impact: ${a.financial_impact}.` : ""}`, variant, badgeLabel, "amber");
      })
    : [refInsightPanel("No Material Risk Items", "No critical or high-severity risk items were identified for the period.", "green", "CLEAR", "green")];

  return wrapPage(`
    ${headerFn(`${report.period} Investor Update`)}
    ${refSectionHeader(6, "KEY RISKS", "Key Risk Items")}
    ${panels.join("\n")}
  `);
}

function buildInvestorOutlookPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Investor Update`)}
    ${refSectionHeader(7, "OUTLOOK", "Business Outlook")}
    ${refNarrative(
      "Management is focused on sustaining revenue growth, maintaining margin discipline, and improving working capital efficiency in the periods ahead.",
      "The business continues to develop its service capacity and client relationships. Key initiatives underway include accounts receivable acceleration, operating cost management, and pricing optimization across service lines.",
      "Investors should note that the outlook statements below are based on current management expectations and are subject to change as market conditions and business performance evolve.",
    )}
  `);
}

function buildInvestorDisclaimerPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Investor Update`)}
    ${refSectionHeader("D", "DISCLAIMER", "Important Disclosures")}
    ${refNarrative(
      "This Investor Update was prepared by FinanceOS from QuickBooks Online data and is intended solely for authorized investors.",
      "The financial information presented is based on management accounts and has not been audited or reviewed by independent accountants.",
      "Forward-looking statements, if any, are based on current expectations and may differ materially from actual results.",
      "Recipients should not rely on this document as the sole basis for investment decisions.",
      "All figures in USD unless otherwise noted.",
      "Distribution or reproduction without written consent is prohibited.",
    )}
  `);
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function renderInvestorUpdate(report: BuiltReport): string {
  const sections_data = report.sections as Record<string, unknown>;
  const entitySummary = (sections_data.entity_summary ?? {}) as Record<string, EntitySection>;
  const financials = (sections_data.financials ?? {}) as Record<string, FinancialsData>;
  // Investor-safe: only expose critical/high alerts with no internal metadata
  const allAlerts = (sections_data.alerts as Alert[]) ?? [];

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
      eyebrow: isPortfolio ? "PORTFOLIO INVESTOR UPDATE" : "INVESTOR UPDATE",
      subtitle: "External Distribution — Portfolio Financial Update",
      confidentiality: "For Authorized Investor Distribution Only",
    }),
    buildInvestorHighlightsPage(report, focusEntities, headerFn),
    buildInvestorFinancialPage(report, focusEntities, headerFn),
    buildInvestorRevenuePage(report, focusEntities, headerFn),
    buildInvestorMarginPage(report, focusEntities, headerFn),
    buildInvestorCashPage(report, focusEntities, headerFn),
    buildInvestorARPage(report, focusEntities, headerFn),
    buildInvestorRisksPage(report, allAlerts, headerFn),
    buildInvestorOutlookPage(report, headerFn),
    buildInvestorDisclaimerPage(report, headerFn),
  ];

  return buildReportHtml({
    title: getCtxTitle(report, `${primaryName} — ${report.period} Investor Update`),
    accent,
    pages,
    extraStyles: SHELL_EXTRA_STYLES,
  });
}
