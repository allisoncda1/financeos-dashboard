/**
 * Board Package renderer.
 *
 * Produces an editorial board package for director review using the shared
 * reportShell foundation. Covers agenda, financials, risks, and decisions.
 */

import type { BuiltReport } from "../builder.js";
import {
  escHtml,
  fmtCurrency,
  fmtPercent,
  fmtDate,
  amountCell,
  svgSimpleBars,
  svgGroupedBars,
  svgHBarRef,
  svgLineRef,
  refSectionHeader,
  refKpiRow,
  refInsightPanel,
  refNarrative,
  refNarrativeBlocks,
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
  getCtxBlocks,
  getCtxHeading,
  getCtxTitle,
  isPreviewMode,
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
  cash_flow?: { as_of: string; sections: { name: string; net_cash: number; lines: { label: string; amount: number; is_subtotal: boolean }[] }[]; net_cash_change: number; cash_at_end: number } | null;
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

function buildBoardAgendaPage(report: BuiltReport, headerFn: HeaderFn): string {
  const agenda = [
    "1. Call to Order and Quorum Confirmation",
    "2. Approval of Prior Meeting Minutes",
    "3. Executive Financial Summary — Revenue, Profitability, and Cash",
    "4. Entity Performance Review — Portfolio Comparison",
    "5. Key Performance Indicator Trends",
    "6. Profit and Loss — Revenue and Margin Review",
    "7. Cash and Liquidity Position",
    "8. Forecast versus Actual (if available)",
    "9. Risk Register — Material Exceptions",
    "10. Opportunities and Growth Initiatives",
    "11. Management Commentary",
    "12. Decisions Required from Board",
    "13. Appendix — Supporting Financial Data",
    "14. Questions and Adjournment",
  ];

  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(null, "MEETING AGENDA", "Board Meeting Agenda")}
    <div style="margin:10pt 0;">
      ${agenda.map((item) => `<div style="padding:6pt 0;border-bottom:1px solid #f3f4f6;font-size:9.5pt;color:#1e293b;">${escHtml(item)}</div>`).join("")}
    </div>
    ${refSmallNote(`Package prepared for ${escHtml(report.period)} board meeting. All financial data sourced from QuickBooks Online via FinanceOS.`)}
  `);
}

function buildBoardExecSummary(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const pl = first.fin.monthly_pl ?? [];
  const cur = pl[pl.length - 1] ?? null;

  const kpis = refKpiRow([
    { label: "Revenue YTD", value: fmtCurrency(first.m.revenue_ytd), change: "", changeClass: "neu" },
    { label: "Gross Margin", value: fmtPercent(first.m.gross_margin_pct), change: "", changeClass: "neu" },
    { label: "Net Income YTD", value: first.m.net_income_ytd < 0 ? `(${fmtCurrency(Math.abs(first.m.net_income_ytd))})` : fmtCurrency(first.m.net_income_ytd), sub: `${fmtPercent(Math.abs(first.m.net_margin_pct))} ${first.m.net_income_ytd < 0 ? "loss" : "margin"}`, change: "", changeClass: "neu" },
    { label: "Cash on Hand", value: first.m.cash_on_hand < 0 ? `(${fmtCurrency(Math.abs(first.m.cash_on_hand))})` : fmtCurrency(first.m.cash_on_hand), change: "", changeClass: "neu" },
    { label: "Open AR", value: fmtCurrency(first.m.open_ar), change: "", changeClass: "neu" },
    { label: "Open AP", value: fmtCurrency(first.m.open_ap), change: "", changeClass: "neu" },
  ]);

  const p1 = `${first.m.entity} reports ${fmtCurrency(first.m.revenue_ytd)} in year-to-date revenue with ${fmtPercent(first.m.gross_margin_pct)} gross margin and ${first.m.net_income_ytd < 0 ? `a net loss of (${fmtCurrency(Math.abs(first.m.net_income_ytd))})` : `net income of ${fmtCurrency(first.m.net_income_ytd)}`} on a ${first.m.basis}-basis. Cash on hand is ${first.m.cash_on_hand < 0 ? `a deficit of (${fmtCurrency(Math.abs(first.m.cash_on_hand))})` : fmtCurrency(first.m.cash_on_hand)}.`;

  const execBlocks  = getCtxBlocks(report, "executive_summary", [p1]);
  const execHeading = getCtxHeading(report, "executive_summary", "Executive Financial Summary");

  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(null, "EXECUTIVE SUMMARY", execHeading)}
    ${refNarrativeBlocks(execBlocks, isPreviewMode(report))}
    ${kpis}
  `);
}

function buildBoardPerformancePage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const revBars = svgHBarRef(
    entities.map(({ m }) => ({ label: m.entity, value: m.revenue_ytd, color: entityColor(m.slug) })),
    { width: 520 },
  );

  const rows = entities.map(({ m }) =>
    tr(td(m.entity), tdRaw(ac(m.revenue_ytd), "right"), td(fmtPercent(m.gross_margin_pct), "right"),
      tdRaw(ac(m.net_income_ytd), "right"), td(fmtPercent(m.net_margin_pct), "right"), tdRaw(ac(m.cash_on_hand), "right")),
  ).join("");

  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(1, "ENTITY PERFORMANCE", "Entity Performance Comparison")}
    ${refSubHeading("Year-to-Date Revenue by Entity")}
    <div style="margin:10pt 0;">${revBars}</div>
    ${refSubHeading("Performance Summary")}
    ${refTable(tr(th("Entity"), th("Revenue YTD", "right"), th("GM %", "right"), th("Net Income", "right"), th("NM %", "right"), th("Cash", "right")), rows)}
  `);
}

function buildBoardKPITrendsPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const pl = first.fin.monthly_pl ?? [];

  const revenueChart = pl.length >= 2
    ? svgGroupedBars(
        pl.map((x) => fmtMonthShort(x.month)),
        [
          { label: "Revenue", color: "#00d4b8", values: pl.map((x) => x.revenue) },
          { label: "Gross Profit", color: "#10b981", values: pl.map((x) => x.gross_profit) },
          { label: "Net Income", color: "#6366f1", values: pl.map((x) => x.net_income) },
        ],
        { width: 520, height: 200, title: "Revenue, Gross Profit & Net Income — Monthly" },
      )
    : emptyState("Insufficient monthly data for trend chart.");

  const cashHistory = first.fin.cash_history ?? [];
  const cashChart = cashHistory.length >= 2
    ? svgLineRef(cashHistory, { width: 520, height: 155, color: first.m.cash_on_hand < 0 ? "#ef4444" : "#00d4b8", title: "Cash Balance Trend" })
    : "";

  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(2, "KPI TRENDS", "Key Performance Indicator Trends")}
    <div style="margin:14pt 0 8pt;">${revenueChart}</div>
    ${cashChart ? `<div style="margin:14pt 0 8pt;">${cashChart}</div>` : ""}
  `);
}

function buildBoardPLPage(
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
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(3, "PROFIT AND LOSS", "Revenue and Profitability")}
    ${refNarrative(`Year-to-date income statement for ${first.m.entity} on a ${first.m.basis}-basis as of ${report.period}.`)}
    ${refTable(tr(th("Line Item"), th("Year to Date", "right")), rows)}
    ${refSmallNote("Not an audited financial statement. Source: QuickBooks Online via FinanceOS.")}
  `);
}

function buildBoardCashPage(
  report: BuiltReport,
  entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[],
  headerFn: HeaderFn,
): string {
  const first = entities[0]!;
  const cash = first.m.cash_on_hand;
  const isNeg = cash < 0;

  const warningPanel = isNeg
    ? refInsightPanel("Cash Deficit — Board Awareness Required",
        `Cash on hand is (${fmtCurrency(Math.abs(cash))}). The entity requires immediate liquidity action. Accounts receivable of ${fmtCurrency(first.m.open_ar)} is the most accessible source.`,
        "red", "CRITICAL", "amber")
    : "";

  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(4, "CASH AND LIQUIDITY", "Cash Position and Runway")}
    ${warningPanel}
    ${refKpiRow([
      { label: "Cash on Hand", value: cash < 0 ? `(${fmtCurrency(Math.abs(cash))})` : fmtCurrency(cash), change: "", changeClass: "neu" },
      { label: "Open AR", value: fmtCurrency(first.m.open_ar), sub: `${fmtPercent(first.m.ar_overdue_pct)} overdue`, change: "", changeClass: "neu" },
      { label: "Open AP", value: fmtCurrency(first.m.open_ap), change: "", changeClass: "neu" },
    ])}
    ${refNarrative(
      `Cash on hand as of the reporting date is ${cash < 0 ? `a deficit of (${fmtCurrency(Math.abs(cash))})` : fmtCurrency(cash)}. Accounts receivable total ${fmtCurrency(first.m.open_ar)}, of which ${fmtPercent(first.m.ar_overdue_pct)} is overdue.`,
    )}
  `);
}

function buildBoardForecastPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(5, "FORECAST VS ACTUAL", "Forecast Versus Actual")}
    ${emptyState("Forecast data is not available in the current reporting pipeline. Coordinate with management to provide a budget or forecast file for comparison in future packages.")}
  `);
}

function buildBoardRisksPage(report: BuiltReport, alerts: Alert[], headerFn: HeaderFn): string {
  const critical = alerts.filter((a) => a.severity === "critical" || a.severity === "high");
  const panels = critical.length > 0
    ? critical.map((a) => {
        const variant: "red" | "amber" | "blue" | "gray" = a.severity === "critical" ? "red" : "amber";
        const badgeLabel = a.severity === "critical" ? "CRITICAL" : "HIGH";
        return refInsightPanel(a.title, `${a.description} Entity: ${a.entity}.`, variant, badgeLabel, "amber");
      })
    : [refInsightPanel("No Material Risks", "No critical or high-priority risks were identified this period.", "green", "CLEAR", "green")];

  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(6, "RISK REGISTER", "Major Risks and Exceptions")}
    ${panels.join("\n")}
  `);
}

function buildBoardOpportunitiesPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(7, "OPPORTUNITIES", "Growth Opportunities")}
    ${refNarrative(
      "Management identified the following opportunities for board consideration. These are indicative and subject to further analysis before board-level commitment.",
      "Revenue Expansion: Assess pricing model review for highest-margin service lines to capture additional value from existing client base.",
      "Working Capital Improvement: AR collection acceleration can improve cash conversion cycle and reduce reliance on credit.",
      "Operational Leverage: As revenue scales, fixed operating cost ratio should decline — monitor operating leverage trajectory quarterly.",
    )}
  `);
}

function buildBoardCommentaryPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(8, "MANAGEMENT COMMENTARY", "Management Commentary")}
    ${refNarrative(
      `Management presents this package for the ${report.period} board review. All financial data is derived from QuickBooks Online and reflects the management accounts as of the reporting date.`,
      "The business is being managed in accordance with the operating plan. Key items requiring board awareness are documented in the Risk Register section. Management is actively monitoring the items identified and will report progress at the next review.",
    )}
  `);
}

function buildBoardDecisionsPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader(9, "DECISIONS REQUIRED", "Decisions Required from the Board")}
    ${refNarrative("The following items require board discussion or formal resolution during this meeting:")}
    <div style="margin:10pt 0;">
      ${["Review and acceptance of financial results presented in this package.", "Discussion of risk register items and management response plans.", "Guidance on capital allocation priorities for the upcoming period.", "Any other business raised by board members."]
        .map((item, i) => `<div style="padding:8pt 0;border-bottom:1px solid #f3f4f6;font-size:9.5pt;"><span style="font-weight:600;color:#374151;">${i + 1}.</span> ${escHtml(item)}</div>`)
        .join("")}
    </div>
  `);
}

function buildBoardAppendixPage(report: BuiltReport, headerFn: HeaderFn): string {
  return wrapPage(`
    ${headerFn(`${report.period} Board Package`)}
    ${refSectionHeader("A", "APPENDIX", "Supporting Financial Data")}
    ${refSubHeading("Data Source and Basis")}
    ${refNarrative(
      `All financial data sourced from QuickBooks Online via FinanceOS as of the reporting date. Entity count: ${report.metadata.entityCount}. This package is an internal management report and has not been audited or reviewed by independent accountants.`,
      "The information presented is based on management accounts and may differ from final audited results. Recipients should not use this package as the sole basis for material financial decisions without corroborating the underlying QuickBooks data.",
    )}
  `);
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function renderBoardPackage(report: BuiltReport): string {
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
      eyebrow: isPortfolio ? "PORTFOLIO BOARD PACKAGE" : "BOARD PACKAGE",
      subtitle: "Board of Directors — Financial Review",
    }),
    buildBoardAgendaPage(report, headerFn),
    buildBoardExecSummary(report, focusEntities, headerFn),
    buildBoardPerformancePage(report, entities, headerFn),
    buildBoardKPITrendsPage(report, focusEntities, headerFn),
    buildBoardPLPage(report, focusEntities, headerFn),
    buildBoardCashPage(report, focusEntities, headerFn),
    buildBoardForecastPage(report, headerFn),
    buildBoardRisksPage(report, alerts, headerFn),
    buildBoardOpportunitiesPage(report, headerFn),
    buildBoardCommentaryPage(report, headerFn),
    buildBoardDecisionsPage(report, headerFn),
    buildBoardAppendixPage(report, headerFn),
  ];

  return buildReportHtml({
    title: getCtxTitle(report, `${primaryName} — ${report.period} Board Package`),
    accent,
    pages,
    extraStyles: SHELL_EXTRA_STYLES,
  });
}
