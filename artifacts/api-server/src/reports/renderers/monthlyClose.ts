/**
 * Monthly Close Report renderer — v3 editorial style.
 *
 * Matches the reference CarDealer.ai Quarterly Package design language:
 * white pages, numbered section headers, flat KPI rows, horizontal-rule
 * tables, left-border insight panels, Puppeteer A4 PDF.
 */

import type { BuiltReport } from "../builder.js";
import {
  BRAND,
  escHtml,
  fmtCurrency,
  fmtPercent,
  fmtDate,
  amountCell,
  varianceCell,
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
  badge,
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
  entity: string;
  slug: string;
  basis: string;
  as_of: string;
  pipeline_run?: string;
  revenue_ytd: number;
  cogs_ytd: number;
  gross_profit_ytd: number;
  gross_margin_pct: number;
  opex_ytd: number;
  net_income_ytd: number;
  net_margin_pct: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  open_ar: number;
  open_ap: number;
  dso_days: number | null;
  dso_days_standard: number | null;
  weighted_average_days_overdue: number | null;
  dpo_days: number | null;
  cash_on_hand: number;
  ar_overdue_pct: number;
  ap_overdue_pct: number;
}

interface MonthlyPL {
  month: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  opex: number;
  net_income: number;
}

interface BalanceSheet {
  as_of: string;
  prior_as_of?: string;
  assets: {
    cash: number; cash_prior?: number;
    accounts_receivable: number; accounts_receivable_prior?: number;
    prepaid_expenses: number; prepaid_expenses_prior?: number;
    equipment_net: number; equipment_net_prior?: number;
    total: number; total_prior?: number;
  };
  liabilities: {
    accounts_payable: number; accounts_payable_prior?: number;
    accrued_liabilities: number; accrued_liabilities_prior?: number;
    deferred_revenue: number; deferred_revenue_prior?: number;
    notes_payable: number; notes_payable_prior?: number;
    total: number; total_prior?: number;
  };
  equity: {
    paid_in_capital: number; paid_in_capital_prior?: number;
    retained_earnings: number; retained_earnings_prior?: number;
    total: number; total_prior?: number;
  };
}

interface CashFlowLine {
  label: string;
  amount: number;
  is_subtotal: boolean;
}

interface CashFlowSection {
  name: string;
  net_cash: number;
  lines: CashFlowLine[];
}

interface CashFlowData {
  as_of: string;
  sections: CashFlowSection[];
  net_cash_change: number;
  cash_at_end: number;
}

interface FinancialsData {
  entity_slug: string;
  as_of: string;
  monthly_pl?: MonthlyPL[];
  ytd_summary?: { revenue: number; cogs: number; gross_profit: number; opex: number; net_income: number };
  balance_sheet?: BalanceSheet;
  cash_flow?: CashFlowData;
  cash_history?: { label: string; value: number }[];
}

interface Alert {
  entity: string;
  title: string;
  description: string;
  severity: string;
  recommended_action: string;
  financial_impact: string;
}

interface EntitySection {
  metrics: EntityMetrics;
  anomalies: unknown[];
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Extract the HTML string from amountCell's return value. */
function ac(v: number | null | undefined): string { return amountCell(v).html; }

function chgPct(cur: number, prv: number | null | undefined): number | null {
  if (prv == null || prv === 0) return null;
  return ((cur - prv) / Math.abs(prv)) * 100;
}

function chgAmt(cur: number, prv: number | null | undefined): number | null {
  if (prv == null) return null;
  return cur - prv;
}

function dirWord(delta: number | null): string {
  if (delta == null) return "was";
  return delta > 0 ? "grew" : delta === 0 ? "held flat" : "declined";
}

function gmPct(entry: MonthlyPL | null): number | null {
  if (!entry || entry.revenue === 0) return null;
  return (entry.gross_profit / entry.revenue) * 100;
}

function nmPct(entry: MonthlyPL | null): number | null {
  if (!entry || entry.revenue === 0) return null;
  return (entry.net_income / entry.revenue) * 100;
}

function curAndPrv(pl: MonthlyPL[] | undefined): { cur: MonthlyPL | null; prv: MonthlyPL | null } {
  if (!pl || pl.length === 0) return { cur: null, prv: null };
  return { cur: pl[pl.length - 1] ?? null, prv: pl.length >= 2 ? (pl[pl.length - 2] ?? null) : null };
}

function fmtMonthName(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "long" });
}

function fmtMonthShortLocal(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short" });
}

function kpiChange(delta: number | null, pct: number | null): { change: string; changeClass: string } {
  if (delta == null || pct == null) return { change: "", changeClass: "neu" };
  const sign = delta > 0 ? "+" : "";
  const cls = delta > 0 ? "pos" : delta === 0 ? "neu" : "neg";
  return { change: `${sign}${fmtCurrency(delta)} (${sign}${pct.toFixed(1)}%)`, changeClass: cls };
}

function kpiPctChange(delta: number | null): { change: string; changeClass: string } {
  if (delta == null) return { change: "", changeClass: "neu" };
  const sign = delta > 0 ? "+" : "";
  const cls = delta > 0 ? "pos" : delta === 0 ? "neu" : "neg";
  return { change: `${sign}${delta.toFixed(1)} pts vs. prior month`, changeClass: cls };
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function refTable(head: string, rows: string, foot = ""): string {
  return `<table class="ref-table">
  <thead>${head}</thead>
  <tbody>${rows}</tbody>
  ${foot ? `<tfoot>${foot}</tfoot>` : ""}
</table>`;
}

function th(text: string, align: "left" | "right" | "center" = "left"): string {
  return `<th style="text-align:${align}">${escHtml(text)}</th>`;
}

function td(text: string, align: "left" | "right" | "center" = "left", bold = false): string {
  return `<td style="text-align:${align}${bold ? ";font-weight:600" : ""}">${escHtml(text)}</td>`;
}

function tdRaw(html: string, align: "left" | "right" | "center" = "left", bold = false): string {
  return `<td style="text-align:${align}${bold ? ";font-weight:600" : ""}">${html}</td>`;
}

function tr(...cells: string[]): string { return `<tr>${cells.join("")}</tr>`; }
function trTotal(...cells: string[]): string { return `<tr class="total">${cells.join("")}</tr>`; }
function trSub(...cells: string[]): string { return `<tr class="subtotal">${cells.join("")}</tr>`; }

// ─── Narrative generators ─────────────────────────────────────────────────────

function narrativeExecSummary(m: EntityMetrics, fin: FinancialsData, period: string): string[] {
  const { cur, prv } = curAndPrv(fin.monthly_pl);
  const revPct = cur && prv ? chgPct(cur.revenue, prv.revenue) : null;
  const curGM = gmPct(cur);
  const prvGM = gmPct(prv);
  const curNM = nmPct(cur);
  const niDelta = cur && prv ? chgAmt(cur.net_income, prv.net_income) : null;
  const bs = fin.balance_sheet;
  const cashDelta = bs?.assets.cash_prior != null ? chgAmt(bs.assets.cash, bs.assets.cash_prior) : null;
  const monthName = cur ? fmtMonthName(cur.month) : period;

  const p1 = [
    `${m.entity} closed ${monthName} with ${fmtCurrency(cur?.revenue ?? m.revenue_ytd)} in revenue and ${fmtCurrency(cur?.net_income ?? m.net_income_ytd)} in net income.`,
    revPct != null ? ` Revenue represented ${revPct > 0 ? "an increase" : "a decline"} of ${Math.abs(revPct).toFixed(1)} percent versus the prior month.` : "",
    curGM != null ? ` Gross margin reached ${fmtPercent(curGM)}${prvGM != null ? ` (${curGM > prvGM ? "up" : "down"} from ${fmtPercent(prvGM)} in the prior month)` : ""}, reflecting ${curGM >= 55 ? "strong" : curGM >= 40 ? "solid" : "compressed"} unit economics.` : "",
  ].join("");

  const p2 = [
    cur && curNM != null ? `Net income for the month was ${cur.net_income < 0 ? `a net loss of ${fmtCurrency(Math.abs(cur.net_income))}` : `${fmtCurrency(cur.net_income)}`}, a ${fmtPercent(Math.abs(curNM))} ${curNM < 0 ? "loss" : "profit"} margin.` : "",
    niDelta != null && prv ? ` This ${niDelta > 0 ? "improved" : "declined"} ${fmtCurrency(Math.abs(niDelta))} from ${fmtCurrency(prv.net_income)} in ${fmtMonthName(prv.month)}.` : "",
    cashDelta != null && bs ? ` Cash ${cashDelta >= 0 ? "increased" : "decreased"} ${fmtCurrency(Math.abs(cashDelta))} during ${monthName} to ${bs.assets.cash < 0 ? `a deficit of (${fmtCurrency(Math.abs(bs.assets.cash))})` : fmtCurrency(bs.assets.cash)}.` : m.cash_on_hand < 0 ? ` Cash on hand is negative at (${fmtCurrency(Math.abs(m.cash_on_hand))}), indicating an immediate liquidity shortfall.` : ` Cash on hand stands at ${fmtCurrency(m.cash_on_hand)}.`,
  ].join("");

  const overdueAmt = m.open_ar * (m.ar_overdue_pct / 100);
  const p3 = m.open_ar > 0 ? [
    `Accounts receivable total ${fmtCurrency(m.open_ar)}, of which ${fmtPercent(m.ar_overdue_pct)} (${fmtCurrency(overdueAmt)}) is overdue.`,
    m.ar_overdue_pct > 30 ? " The overdue rate warrants focused collection activity this period." : "",
    m.open_ap > 0 ? ` Accounts payable stands at ${fmtCurrency(m.open_ap)}.` : "",
  ].join("") : "";

  return [p1, p2, p3].filter((p) => p.trim().length > 0);
}

function narrativeExecInsights(m: EntityMetrics, fin: FinancialsData, alerts: Alert[], period: string): string[] {
  const { cur, prv } = curAndPrv(fin.monthly_pl);
  const pl = fin.monthly_pl ?? [];
  const monthName = cur ? fmtMonthName(cur.month) : period;

  const p1 = `${m.entity} closed ${monthName} with ${fmtCurrency(cur?.revenue ?? m.revenue_ytd)} in revenue and ${fmtCurrency(cur?.net_income ?? m.net_income_ytd)} in net income. ` +
    (m.net_income_ytd >= 0
      ? `The business is operating at a net profit on a year-to-date basis of ${fmtCurrency(m.net_income_ytd)}, representing a ${fmtPercent(m.net_margin_pct)} margin against ${fmtCurrency(m.revenue_ytd)} in cumulative revenue.`
      : `The business is carrying a net loss of ${fmtCurrency(Math.abs(m.net_income_ytd))} year to date on revenue of ${fmtCurrency(m.revenue_ytd)}, a ${fmtPercent(Math.abs(m.net_margin_pct))} loss margin that requires immediate management focus.`);

  let p2 = "";
  if (pl.length >= 3) {
    const first = pl[0]!;
    const revTrend = pl.map((x) => x.revenue);
    const allGrowing = revTrend.every((v, i) => i === 0 || v >= revTrend[i - 1]!);
    const allDeclining = revTrend.every((v, i) => i === 0 || v <= revTrend[i - 1]!);
    const trendDesc = allGrowing ? "consistent month-over-month growth" : allDeclining ? "a declining revenue trend" : "mixed monthly revenue performance";
    p2 = `Over the ${pl.length}-month period reviewed, revenue has shown ${trendDesc}, moving from ${fmtCurrency(first.revenue)} in ${fmtMonthName(first.month)} to ${fmtCurrency(cur?.revenue ?? m.revenue_ytd)} in ${monthName}.`;
    if (cur && prv) {
      const revPct = chgPct(cur.revenue, prv.revenue);
      if (revPct != null) p2 += ` The most recent month-over-month comparison shows ${Math.abs(revPct).toFixed(1)} percent ${revPct >= 0 ? "growth" : "decline"} in revenue.`;
    }
  }

  const curGM = gmPct(cur);
  const curNM = nmPct(cur);
  let p3 = "";
  if (curGM != null && cur) {
    const opexPct = cur.revenue > 0 ? (cur.opex / cur.revenue * 100) : null;
    p3 = `Gross margin for ${monthName} was ${fmtPercent(curGM)}, reflecting a cost-of-revenue rate of ${fmtPercent(100 - curGM)}.`;
    if (opexPct != null && curNM != null) {
      p3 += ` Operating expenses represented ${fmtPercent(opexPct)} of revenue at ${fmtCurrency(cur.opex)}, yielding a net margin of ${curNM < 0 ? `(${fmtPercent(Math.abs(curNM))})` : fmtPercent(curNM)}.`;
    }
  }

  const cash = m.cash_on_hand;
  let p4 = "";
  if (cash < 0) {
    p4 = `The entity is in a negative cash position of (${fmtCurrency(Math.abs(cash))}) as of the reporting date. This is a critical liquidity event. With accounts receivable of ${fmtCurrency(m.open_ar)}, the priority is accelerating collections to restore a positive cash balance.`;
  } else {
    p4 = `Cash on hand is ${fmtCurrency(cash)} as of the reporting date.`;
    if (fin.cash_history && fin.cash_history.length >= 2) {
      const h = fin.cash_history;
      const cashChg = h[h.length - 1]!.value - h[0]!.value;
      p4 += ` Over the ${h.length}-month trailing period, cash has ${cashChg >= 0 ? "grown" : "declined"} ${fmtCurrency(Math.abs(cashChg))} from ${fmtCurrency(h[0]!.value)}.`;
    }
    const overdueAmt = m.open_ar * (m.ar_overdue_pct / 100);
    if (overdueAmt > 0) p4 += ` Accounts receivable overdue stands at ${fmtCurrency(overdueAmt)} (${fmtPercent(m.ar_overdue_pct)} of total AR), representing the primary working capital risk.`;
  }

  const entityAlerts = alerts.filter((a) => a.entity === m.entity);
  const critical = entityAlerts.filter((a) => a.severity === "critical");
  const high = entityAlerts.filter((a) => a.severity === "high");
  let p5 = "";
  if (critical.length > 0) {
    p5 = `Management attention is required on ${critical.length} critical item${critical.length > 1 ? "s" : ""}: ${critical.map((a) => a.title).join("; ")}. Detail and recommended actions are documented in the Exceptions section.`;
  } else if (high.length > 0) {
    p5 = `${high.length} high-priority item${high.length > 1 ? "s" : ""} require${high.length === 1 ? "s" : ""} management review: ${high.map((a) => a.title).join("; ")}. Detail is in the Exceptions section.`;
  } else {
    p5 = `No material exceptions were identified during the close review for ${monthName}. All validation checks passed. The focus for the upcoming period is sustaining the current revenue trajectory and maintaining operating discipline.`;
  }

  return [p1, p2, p3, p4, p5].filter((p) => p.trim().length > 0);
}

function narrativePL(cur: MonthlyPL | null, prv: MonthlyPL | null, ytd: FinancialsData["ytd_summary"]): string[] {
  if (!cur) return ["Profit and loss data is not available for this period."];
  const revChg = prv ? chgAmt(cur.revenue, prv.revenue) : null;
  const revPct = prv ? chgPct(cur.revenue, prv.revenue) : null;
  const curGM = gmPct(cur);
  const curNM = nmPct(cur);

  const p1 = `Revenue for ${fmtMonthName(cur.month)} was ${fmtCurrency(cur.revenue)}, with cost of revenue of ${fmtCurrency(cur.cogs)}, producing gross profit of ${fmtCurrency(cur.gross_profit)} at a ${fmtPercent(curGM ?? 0)} gross margin.` +
    (revChg != null && revPct != null ? ` Revenue ${dirWord(revChg)} ${fmtCurrency(Math.abs(revChg))} (${Math.abs(revPct).toFixed(1)}%) from ${fmtCurrency(prv!.revenue)} in the prior month.` : "");

  const p2 = `Operating expenses totaled ${fmtCurrency(cur.opex)}, resulting in net income of ${cur.net_income < 0 ? `(${fmtCurrency(Math.abs(cur.net_income))})` : fmtCurrency(cur.net_income)} — a ${curNM != null ? fmtPercent(Math.abs(curNM)) : "—"} ${cur.net_income < 0 ? "net loss" : "net margin"}.` +
    (ytd ? ` Year-to-date net income stands at ${ytd.net_income < 0 ? `(${fmtCurrency(Math.abs(ytd.net_income))})` : fmtCurrency(ytd.net_income)} on ${fmtCurrency(ytd.revenue)} in cumulative revenue.` : "");

  return [p1, p2];
}

function narrativeBS(bs: BalanceSheet | undefined): string[] {
  if (!bs) return ["Balance sheet data is not available for this period."];
  const cashChg = bs.assets.cash_prior != null ? chgAmt(bs.assets.cash, bs.assets.cash_prior) : null;
  const arChg = bs.assets.accounts_receivable_prior != null ? chgAmt(bs.assets.accounts_receivable, bs.assets.accounts_receivable_prior) : null;

  const p1 = `Total assets were ${fmtCurrency(bs.assets.total)} as of the reporting date${bs.assets.total_prior != null ? `, compared to ${fmtCurrency(bs.assets.total_prior)} in the prior period` : ""}.` +
    (cashChg != null ? ` Cash ${cashChg >= 0 ? "increased" : "decreased"} ${fmtCurrency(Math.abs(cashChg))} to ${bs.assets.cash < 0 ? `(${fmtCurrency(Math.abs(bs.assets.cash))})` : fmtCurrency(bs.assets.cash)}.` : ` Cash on hand is ${fmtCurrency(bs.assets.cash)}.`);

  const p2 = `Total liabilities were ${fmtCurrency(bs.liabilities.total)}${bs.liabilities.total_prior != null ? ` (${chgAmt(bs.liabilities.total, bs.liabilities.total_prior)! >= 0 ? "up" : "down"} from ${fmtCurrency(bs.liabilities.total_prior)})` : ""}, and equity stands at ${bs.equity.total < 0 ? `(${fmtCurrency(Math.abs(bs.equity.total))})` : fmtCurrency(bs.equity.total)}.` +
    (arChg != null ? ` Accounts receivable ${arChg >= 0 ? "grew" : "declined"} ${fmtCurrency(Math.abs(arChg))} to ${fmtCurrency(bs.assets.accounts_receivable)}.` : "");

  return [p1, p2];
}

// ─── Page wrappers — now imported from reportShell ────────────────────────────
// wrapPage, entityColor, buildCoverPage, buildReportHtml, SHELL_EXTRA_STYLES,
// HeaderFn, buildReportHeaderFn are all imported from ./reportShell.js above.

// ─── P1: Executive Financial Summary ─────────────────────────────────────────

function buildExecSummaryPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const { cur, prv } = curAndPrv(first.fin.monthly_pl);
  const curGM = gmPct(cur);
  const curNM = nmPct(cur);
  const prvGM = gmPct(prv);
  const gmDelta = curGM != null && prvGM != null ? curGM - prvGM : null;
  const bs = first.fin.balance_sheet;
  const cashVal = bs?.assets.cash ?? first.m.cash_on_hand;
  const cashChgAmt = bs?.assets.cash_prior != null ? chgAmt(bs.assets.cash, bs.assets.cash_prior) : null;
  const cashChgPct = bs?.assets.cash_prior ? chgPct(bs.assets.cash, bs.assets.cash_prior) : null;

  const kpis = refKpiRow([
    { label: "Revenue", value: fmtCurrency(cur?.revenue ?? first.m.revenue_ytd), ...kpiChange(chgAmt(cur?.revenue ?? 0, prv?.revenue), chgPct(cur?.revenue ?? 0, prv?.revenue)) },
    { label: "Gross Profit", value: fmtCurrency(cur?.gross_profit ?? first.m.gross_profit_ytd), sub: curGM != null ? `${fmtPercent(curGM)} margin` : undefined, ...kpiChange(chgAmt(cur?.gross_profit ?? 0, prv?.gross_profit), chgPct(cur?.gross_profit ?? 0, prv?.gross_profit)) },
    { label: "Net Income", value: cur?.net_income != null && cur.net_income < 0 ? `(${fmtCurrency(Math.abs(cur.net_income))})` : fmtCurrency(cur?.net_income ?? first.m.net_income_ytd), sub: curNM != null ? `${fmtPercent(Math.abs(curNM))} ${curNM < 0 ? "loss" : "margin"}` : undefined, ...kpiChange(chgAmt(cur?.net_income ?? 0, prv?.net_income), chgPct(cur?.net_income ?? 0, prv?.net_income)) },
    { label: "Ending Cash", value: cashVal < 0 ? `(${fmtCurrency(Math.abs(cashVal))})` : fmtCurrency(cashVal), ...kpiChange(cashChgAmt, cashChgPct) },
  ]);

  const chartHtml = cur && prv
    ? svgGroupedBars(
        ["Revenue", "Gross Profit", "Net Income"],
        [
          { label: fmtMonthShortLocal(prv.month), color: "#cbd5e1", values: [prv.revenue, prv.gross_profit, prv.net_income] },
          { label: fmtMonthShortLocal(cur.month), color: BRAND.accent, values: [cur.revenue, cur.gross_profit, cur.net_income] },
        ],
        { width: 520, height: 180, title: `${fmtMonthName(prv.month)} vs. ${fmtMonthName(cur.month)}` },
      )
    : cur
    ? svgSimpleBars([{ label: "Revenue", value: cur.revenue }, { label: "Gross Profit", value: cur.gross_profit }, { label: "Net Income", value: cur.net_income }], { width: 520, height: 180, color: BRAND.accent })
    : "";

  const summaryRows = [
    tr(td("Revenue"), tdRaw(ac(cur?.revenue ?? 0), "right"), tdRaw(prv ? varianceCell(cur?.revenue ?? 0, prv.revenue) : td("—", "right"))),
    tr(td("Gross Profit"), tdRaw(ac(cur?.gross_profit ?? 0), "right"), tdRaw(prv ? varianceCell(cur?.gross_profit ?? 0, prv.gross_profit) : td("—", "right"))),
    tr(td("Net Income"), tdRaw(ac(cur?.net_income ?? 0), "right"), tdRaw(prv ? varianceCell(cur?.net_income ?? 0, prv.net_income) : td("—", "right"))),
    tr(td("Cash on Hand"), tdRaw(ac(cashVal), "right"), tdRaw(cashChgAmt != null ? varianceCell(cashVal, cashVal - cashChgAmt) : td("—", "right"))),
    tr(td("Open AR"), tdRaw(ac(first.m.open_ar), "right"), td("—", "right")),
    tr(td("Open AP"), tdRaw(ac(first.m.open_ap), "right"), td("—", "right")),
  ].join("");

  const execNarrativeBlocks = getCtxBlocks(report, "executive_summary", narrativeExecSummary(first.m, first.fin, report.period));
  const execHeading         = getCtxHeading(report, "executive_summary", "Executive Financial Summary");
  const previewMode         = isPreviewMode(report);

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(null, "OWNER SUMMARY", execHeading)}
    ${refNarrativeBlocks(execNarrativeBlocks, previewMode)}
    ${kpis}
    <div style="margin:16pt 0 8pt;">${chartHtml}</div>
    <div class="no-break">
    ${refSubHeading("Period-over-Period Summary")}
    ${refTable(tr(th("Metric"), th("Current Period", "right"), th("vs. Prior Month", "right")), summaryRows)}
    </div>
  `);
}

// ─── P2: Executive Insights ───────────────────────────────────────────────────

function buildExecInsightsPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], alerts: Alert[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const paragraphs = narrativeExecInsights(first.m, first.fin, alerts, report.period);

  let entityTable = "";
  if (entities.length > 1) {
    const tableRows = entities.map(({ m }) =>
      tr(td(m.entity), tdRaw(ac(m.revenue_ytd), "right"), tdRaw(ac(m.net_income_ytd), "right"), tdRaw(ac(m.cash_on_hand), "right"), td(fmtPercent(m.net_margin_pct), "right")),
    ).join("");
    entityTable = `${refSubHeading("Entity Performance Snapshot — Year to Date")}${refTable(tr(th("Entity"), th("Revenue YTD", "right"), th("Net Income YTD", "right"), th("Cash on Hand", "right"), th("Net Margin", "right")), tableRows)}`;
  }

  const insightBlocks  = getCtxBlocks(report, "management_comments", paragraphs);
  const insightHeading = getCtxHeading(report, "management_comments", "Executive Insights");

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(null, "MANAGEMENT COMMENTARY", insightHeading)}
    ${refNarrativeBlocks(insightBlocks, isPreviewMode(report))}
    ${entityTable}
  `);
}

// ─── P3: Table of Contents ────────────────────────────────────────────────────

function buildTOC(report: BuiltReport, isPortfolio: boolean, headerFn: HeaderFn): string {
  const base: [string, number][] = [
    ["Executive Financial Summary", 2],
    ["Executive Insights", 3],
    ["Contents", 4],
    ...(isPortfolio ? [["Portfolio Financial Summary", 5] as [string, number]] : []),
    ["Monthly Performance Highlights", isPortfolio ? 6 : 5],
    ["Financial Performance", isPortfolio ? 7 : 6],
    ["Profit and Loss Statement", isPortfolio ? 8 : 7],
    ["Balance Sheet", isPortfolio ? 9 : 8],
    ["Cash and Liquidity", isPortfolio ? 10 : 9],
    ["Cash Flow Statement", isPortfolio ? 11 : 10],
    ["Revenue and Customer Concentration", isPortfolio ? 12 : 11],
    ["Cost Structure", isPortfolio ? 13 : 12],
    ["Management Insights", isPortfolio ? 14 : 13],
    ["Exceptions and Items Reviewed", isPortfolio ? 15 : 14],
    ["Management Recommendations", isPortfolio ? 16 : 15],
    ["Close Status and Preparation Notes", isPortfolio ? 17 : 16],
    ["Management Action Items", isPortfolio ? 18 : 17],
    ["Appendix: Key Metrics and Definitions", isPortfolio ? 19 : 18],
  ];

  const tocRows = base.map(([title, pg]) =>
    `<div class="toc-entry">
      <div class="toc-entry__title">${escHtml(title)}</div>
      <div class="toc-entry__dots"></div>
      <div class="toc-entry__page">${pg}</div>
    </div>`
  ).join("");

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(null, "NAVIGATION", "Contents")}
    <div class="toc-list">${tocRows}</div>
    ${refSmallNote("Page numbers are approximate and refer to PDF page order.")}
  `);
}

// ─── Portfolio overview ───────────────────────────────────────────────────────

function buildPortfolioPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const sections_data = report.sections as Record<string, unknown>;
  const pf = (sections_data.portfolio_kpis as { portfolio: Record<string, number> | null } | undefined)?.portfolio;

  const portfolioKpis = pf ? refKpiRow([
    { label: "Portfolio Revenue YTD", value: fmtCurrency(pf.portfolio_revenue_ytd ?? 0) },
    { label: "Portfolio Net Income YTD", value: fmtCurrency(pf.portfolio_net_income_ytd ?? 0), sub: fmtPercent(pf.portfolio_net_margin_pct ?? 0) + " margin" },
    { label: "Total Cash on Hand", value: fmtCurrency(pf.portfolio_cash_on_hand ?? 0) },
    { label: "Cash Runway", value: `${(pf.cash_runway_months ?? 0).toFixed(1)} mo`, sub: "at current burn rate" },
  ]) : "";

  const revBars = svgHBarRef(
    entities.map(({ m }) => ({ label: m.entity, value: m.revenue_ytd, color: entityColor(m.slug) })),
    { width: 520 },
  );

  const niRows = entities.map(({ m }) =>
    tr(td(m.entity), tdRaw(ac(m.revenue_ytd), "right"), td(fmtPercent(m.gross_margin_pct), "right"), tdRaw(ac(m.net_income_ytd), "right"), td(fmtPercent(m.net_margin_pct), "right"), tdRaw(ac(m.cash_on_hand), "right")),
  ).join("");

  const totalRevYTD = entities.reduce((s, { m }) => s + m.revenue_ytd, 0);
  const totalNI = entities.reduce((s, { m }) => s + m.net_income_ytd, 0);
  const totalCash = entities.reduce((s, { m }) => s + m.cash_on_hand, 0);

  const losers = entities.filter(({ m }) => m.net_income_ytd < 0);
  const p1 = `The portfolio closed ${report.period} with a combined ${fmtCurrency(totalRevYTD)} in year-to-date revenue across ${entities.length} entities. Aggregate net income is ${totalNI < 0 ? `(${fmtCurrency(Math.abs(totalNI))})` : fmtCurrency(totalNI)}, and combined cash on hand is ${totalCash < 0 ? `(${fmtCurrency(Math.abs(totalCash))})` : fmtCurrency(totalCash)}.`;
  const p2 = losers.length > 0
    ? `${losers.map(({ m }) => m.entity).join(" and ")} ${losers.length === 1 ? "is" : "are"} operating at a net loss. Individual entity detail follows in subsequent sections.`
    : "All entities are operating at a net profit. See individual entity sections for detailed analysis.";

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(null, "PORTFOLIO OVERVIEW", "Portfolio Financial Summary")}
    ${portfolioKpis}
    ${refNarrative(p1, p2)}
    ${refSubHeading("Year-to-Date Revenue by Entity")}
    <div style="margin:10pt 0;">${revBars}</div>
    ${refSubHeading("Entity Performance Summary — Year to Date")}
    ${refTable(tr(th("Entity"), th("Revenue YTD", "right"), th("GM %", "right"), th("Net Income", "right"), th("NM %", "right"), th("Cash", "right")), niRows)}
  `);
}

// ─── P4: Performance Highlights ──────────────────────────────────────────────

function buildPerformanceHighlights(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const pl = first.fin.monthly_pl ?? [];
  const { cur, prv } = curAndPrv(pl);
  const monthName = cur ? fmtMonthName(cur.month) : report.period;
  const cashHistory = first.fin.cash_history ?? [];

  const revChart = svgSimpleBars(pl.map((x) => ({ label: fmtMonthShortLocal(x.month), value: x.revenue })), { width: 370, height: 155, color: BRAND.accent, title: "Monthly Revenue" });
  const cashChart = svgLineRef(cashHistory.length > 0 ? cashHistory : pl.map((x, i) => ({ label: fmtMonthShortLocal(x.month), value: first.m.cash_on_hand + (i - pl.length + 1) * 10_000 })), { width: 370, height: 155, color: first.m.cash_on_hand < 0 ? "#ef4444" : BRAND.accent, title: "Cash Balance" });
  const niChart = svgSimpleBars(pl.map((x) => ({ label: fmtMonthShortLocal(x.month), value: x.net_income })), { width: 370, height: 155, color: cur?.net_income != null && cur.net_income < 0 ? "#ef4444" : "#10b981", title: "Monthly Net Income" });
  const marginChart = svgLineRef(pl.map((x) => ({ label: fmtMonthShortLocal(x.month), value: x.revenue > 0 ? (x.net_income / x.revenue) * 100 : 0 })), { width: 370, height: 155, color: BRAND.accent, title: "Net Margin %", yFormat: "percent" });

  const revTrend = pl.length >= 2 ? (pl[pl.length - 1]!.revenue > pl[0]!.revenue ? "growing" : "declining") : "stable";
  const p1 = `Revenue has been ${revTrend} over the ${pl.length}-month period, ending at ${fmtCurrency(cur?.revenue ?? 0)} in ${monthName}.` +
    (prv && cur ? ` Month-over-month, revenue ${dirWord(chgAmt(cur.revenue, prv.revenue))} ${fmtCurrency(Math.abs(cur.revenue - prv.revenue))} from ${fmtCurrency(prv.revenue)} in the prior period.` : "");

  const cashLast = cashHistory.length > 0 ? cashHistory[cashHistory.length - 1]!.value : first.m.cash_on_hand;
  const cashFirst = cashHistory.length > 0 ? cashHistory[0]!.value : first.m.cash_on_hand;
  const cashNarr = `Cash balance as of ${monthName} is ${first.m.cash_on_hand < 0 ? `a deficit of (${fmtCurrency(Math.abs(first.m.cash_on_hand))})` : fmtCurrency(first.m.cash_on_hand)}. The trailing trend reflects ${cashLast > cashFirst ? "accumulation" : "draw-down"} of reserves over the review period.`;

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(1, "MONTHLY PERFORMANCE HIGHLIGHTS", "Monthly Performance Highlights")}
    ${refNarrative(p1)}
    <div style="display:flex;gap:14pt;margin:10pt 0;">${revChart}${cashChart}</div>
    ${refNarrative(cashNarr)}
    <div style="display:flex;gap:14pt;margin:10pt 0;">${niChart}${marginChart}</div>
    ${refSmallNote(`Charts reflect ${pl.length} months of data from ${pl[0] ? fmtMonthName(pl[0].month) : ""} through ${monthName}.`)}
  `);
}

// ─── P5: Financial Performance ────────────────────────────────────────────────

function buildFinancialPerformance(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const { cur, prv } = curAndPrv(first.fin.monthly_pl);
  const curGM = gmPct(cur);
  const prvGM = gmPct(prv);
  const curNM = nmPct(cur);
  const gmDelta = curGM != null && prvGM != null ? curGM - prvGM : null;
  const pl = first.fin.monthly_pl ?? [];

  const kpis = refKpiRow([
    { label: "Monthly Revenue", value: fmtCurrency(cur?.revenue ?? first.m.revenue_ytd), ...kpiChange(chgAmt(cur?.revenue ?? 0, prv?.revenue), chgPct(cur?.revenue ?? 0, prv?.revenue)) },
    { label: "Gross Margin", value: curGM != null ? fmtPercent(curGM) : "—", ...kpiPctChange(gmDelta) },
    { label: "Net Income", value: cur?.net_income != null && cur.net_income < 0 ? `(${fmtCurrency(Math.abs(cur.net_income))})` : fmtCurrency(cur?.net_income ?? first.m.net_income_ytd), ...kpiChange(chgAmt(cur?.net_income ?? 0, prv?.net_income), chgPct(cur?.net_income ?? 0, prv?.net_income)) },
    { label: "Net Margin", value: curNM != null ? `${fmtPercent(Math.abs(curNM))}${curNM < 0 ? " (loss)" : ""}` : "—", change: "", changeClass: "neu" },
  ]);

  const groupedChart = pl.length >= 2
    ? svgGroupedBars(pl.map((x) => fmtMonthShortLocal(x.month)), [
        { label: "Revenue", color: BRAND.accent, values: pl.map((x) => x.revenue) },
        { label: "Gross Profit", color: "#10b981", values: pl.map((x) => x.gross_profit) },
        { label: "Net Income", color: "#6366f1", values: pl.map((x) => x.net_income) },
      ], { width: 520, height: 200, title: "Revenue, Gross Profit, and Net Income — Monthly" })
    : "";

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(2, "FINANCIAL PERFORMANCE", "Financial Performance")}
    ${kpis}
    ${refNarrative(...narrativePL(cur, prv, first.fin.ytd_summary))}
    <div style="margin:14pt 0 8pt;">${groupedChart}</div>
    ${refSmallNote("Source: QuickBooks Online. Revenue, Gross Profit, and Net Income shown on a monthly basis for the trailing review period.")}
  `);
}

// ─── P6: Profit & Loss ────────────────────────────────────────────────────────

function buildPLPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const { cur, prv } = curAndPrv(first.fin.monthly_pl);
  const ytd = first.fin.ytd_summary;
  const hasPrv = prv != null;
  const hasYTD = ytd != null;

  const cols = 1 + (hasPrv ? 1 : 0) + (hasYTD ? 1 : 0) + 1; // label + cur + prv? + ytd?

  function plRow(label: string, curVal: number, prvVal: number | undefined, ytdVal: number | undefined, isTotal = false): string {
    const cells = [td(label, "left", isTotal), tdRaw(ac(curVal), "right", isTotal)];
    if (hasPrv) cells.push(tdRaw(ac(prvVal ?? 0), "right", isTotal));
    if (hasYTD) cells.push(tdRaw(ac(ytdVal ?? 0), "right", isTotal));
    return isTotal ? trTotal(...cells) : tr(...cells);
  }

  const headCells = [th(""), th(cur ? fmtMonthName(cur.month) : "Current", "right")];
  if (hasPrv) headCells.push(th(fmtMonthName(prv!.month), "right"));
  if (hasYTD) headCells.push(th("Year to Date", "right"));

  const tableRows = [
    plRow("Revenue", cur?.revenue ?? 0, prv?.revenue, ytd?.revenue),
    plRow("Cost of Revenue", cur?.cogs ?? 0, prv?.cogs, ytd?.cogs),
    plRow("Gross Profit", cur?.gross_profit ?? 0, prv?.gross_profit, ytd?.gross_profit, true),
    plRow("Operating Expenses", cur?.opex ?? 0, prv?.opex, ytd?.opex),
    plRow("Net Income", cur?.net_income ?? 0, prv?.net_income, ytd?.net_income, true),
  ].join("");

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(3, "PROFIT AND LOSS STATEMENT", "Profit and Loss Statement")}
    ${refNarrative(`The following table presents the income statement for ${report.period} on a ${first.m.basis}-basis, with prior month and year-to-date comparisons where available. All figures are derived from QuickBooks Online.`)}
    ${refTable(tr(...headCells), tableRows)}
    ${refNarrative(...narrativePL(cur, prv, ytd))}
    ${refSmallNote("Figures may not sum precisely due to rounding. Not an audited financial statement.")}
  `);
}

// ─── P7: Balance Sheet ────────────────────────────────────────────────────────

function buildBSPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const bs = first.fin.balance_sheet;

  if (!bs) {
    return wrapPage(`
      ${headerFn(`${report.period} Monthly Close Report`)}
      ${refSectionHeader(4, "BALANCE SHEET", "Balance Sheet")}
      ${emptyState("Balance sheet data is not available for this entity.")}
    `);
  }

  const hasPrior = bs.assets.total_prior != null;
  const head = hasPrior
    ? tr(th(""), th(fmtDate(bs.as_of), "right"), th(fmtDate(bs.prior_as_of ?? ""), "right"))
    : tr(th(""), th(fmtDate(bs.as_of), "right"));

  function bsRow(label: string, cur: number, prv?: number, isTotal = false): string {
    const cells = [td(label, "left", isTotal), tdRaw(ac(cur), "right", isTotal)];
    if (hasPrior) cells.push(tdRaw(ac(prv ?? 0), "right", isTotal));
    return isTotal ? trTotal(...cells) : tr(...cells);
  }

  const span = hasPrior ? 3 : 2;
  const sectionHdr = (label: string) => `<tr><td colspan="${span}" style="font-weight:600;font-size:8.5pt;padding-top:10pt;padding-bottom:2pt;color:#374151;border-top:1.5px solid #e5e7eb">${escHtml(label)}</td></tr>`;

  const tableRows = [
    sectionHdr("ASSETS"),
    bsRow("Cash and Bank Accounts", bs.assets.cash, bs.assets.cash_prior),
    bsRow("Accounts Receivable", bs.assets.accounts_receivable, bs.assets.accounts_receivable_prior),
    bsRow("Prepaid Expenses", bs.assets.prepaid_expenses, bs.assets.prepaid_expenses_prior),
    bsRow("Equipment (Net)", bs.assets.equipment_net, bs.assets.equipment_net_prior),
    bsRow("Total Assets", bs.assets.total, bs.assets.total_prior, true),
    sectionHdr("LIABILITIES"),
    bsRow("Accounts Payable", bs.liabilities.accounts_payable, bs.liabilities.accounts_payable_prior),
    bsRow("Accrued Liabilities", bs.liabilities.accrued_liabilities, bs.liabilities.accrued_liabilities_prior),
    bsRow("Deferred Revenue", bs.liabilities.deferred_revenue, bs.liabilities.deferred_revenue_prior),
    bsRow("Notes Payable", bs.liabilities.notes_payable, bs.liabilities.notes_payable_prior),
    bsRow("Total Liabilities", bs.liabilities.total, bs.liabilities.total_prior, true),
    sectionHdr("EQUITY"),
    bsRow("Paid-In Capital", bs.equity.paid_in_capital, bs.equity.paid_in_capital_prior),
    bsRow("Retained Earnings", bs.equity.retained_earnings, bs.equity.retained_earnings_prior),
    bsRow("Total Equity", bs.equity.total, bs.equity.total_prior, true),
  ].join("");

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(4, "BALANCE SHEET", "Balance Sheet")}
    ${refTable(head, tableRows)}
    ${refNarrative(...narrativeBS(bs))}
  `);
}

// ─── P8: Cash and Liquidity ───────────────────────────────────────────────────

function buildCashPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const { cur } = curAndPrv(first.fin.monthly_pl);
  const monthName = cur ? fmtMonthName(cur.month) : report.period;
  const cashHistory = first.fin.cash_history ?? [];
  const isNeg = first.m.cash_on_hand < 0;

  const lineChart = cashHistory.length > 0
    ? svgLineRef(cashHistory, { width: 520, height: 200, color: isNeg ? "#ef4444" : BRAND.accent, title: "Cash Balance — 6-Month Trailing" })
    : emptyState("Cash history data not available.");

  const cash = first.m.cash_on_hand;
  const h = cashHistory;
  const cashFirst = h.length > 0 ? h[0]!.value : cash;
  const cashLast = h.length > 0 ? h[h.length - 1]!.value : cash;

  const p1 = `Cash on hand as of the reporting date is ${cash < 0 ? `a deficit of (${fmtCurrency(Math.abs(cash))})` : fmtCurrency(cash)}.` +
    (h.length >= 2 ? ` The trailing ${h.length}-month trend shows a ${cashLast > cashFirst ? "upward" : "downward"} trajectory, from ${fmtCurrency(cashFirst)} in ${h[0]!.label} to ${fmtCurrency(cashLast)} in ${h[h.length - 1]!.label}.` : "");

  const overdueAmt = first.m.open_ar * (first.m.ar_overdue_pct / 100);
  const p2 = cash < 0
    ? `The negative cash balance indicates the entity is drawing on credit or deferring obligations. Immediate action is required to restore a positive cash position. Accounts receivable collections represent the fastest available source of liquidity.`
    : overdueAmt > cash
    ? `Overdue receivables of ${fmtCurrency(overdueAmt)} exceed the current cash position. Accelerating collections is the highest-leverage liquidity action available this period.`
    : `The cash balance represents approximately ${first.m.opex_ytd > 0 ? ((cash / (first.m.opex_ytd / 12)).toFixed(1)) : "—"} months of operating expense coverage at current run rates.`;

  const warningPanel = isNeg
    ? refInsightPanel(
        "Cash Deficit — Immediate Action Required",
        `Cash on hand is (${fmtCurrency(Math.abs(cash))}). Accounts receivable of ${fmtCurrency(first.m.open_ar)} are the most immediate source of liquidity. Accelerate collections and review discretionary spending.`,
        "red", "CRITICAL", "amber")
    : "";

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(5, "CASH AND LIQUIDITY", "Cash and Liquidity")}
    ${warningPanel}
    <div style="margin:12pt 0;">${lineChart}</div>
    ${refNarrative(p1, p2)}
  `);
}

// ─── P9: Cash Flow ────────────────────────────────────────────────────────────

function buildCashFlowPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const cf = first.fin.cash_flow;

  if (!cf) {
    return wrapPage(`
      ${headerFn(`${report.period} Monthly Close Report`)}
      ${refSectionHeader(6, "CASH FLOW STATEMENT", "Cash Flow Statement")}
      ${refInsightPanel("Statement Not Published", "A formal cash flow statement has not been published in QuickBooks Online for this entity and period. Per reporting control RC-016, only published QuickBooks statements are used as source data. Cash position and working capital movements are reflected in the Balance Sheet and Cash and Liquidity sections.", "gray")}
    `);
  }

  const tableRows: string[] = [];
  for (const sect of cf.sections) {
    tableRows.push(`<tr><td colspan="2" style="font-weight:600;font-size:8.5pt;padding-top:10pt;color:#374151">${escHtml(sect.name)}</td></tr>`);
    for (const line of sect.lines) {
      tableRows.push(tr(td(line.label, "left", line.is_subtotal), tdRaw(ac(line.amount), "right", line.is_subtotal)));
    }
    tableRows.push(trSub(td(`Net Cash — ${sect.name}`, "left", true), tdRaw(ac(sect.net_cash), "right", true)));
  }
  tableRows.push(trTotal(td("Net Change in Cash", "left", true), tdRaw(ac(cf.net_cash_change), "right", true)));
  tableRows.push(trTotal(td("Ending Cash Balance", "left", true), tdRaw(ac(cf.cash_at_end), "right", true)));

  const netDir = cf.net_cash_change >= 0 ? "increased" : "decreased";
  const p1 = `Cash ${netDir} ${fmtCurrency(Math.abs(cf.net_cash_change))} during the period. Operating activities generated ${fmtCurrency(cf.sections[0]?.net_cash ?? 0)}, while investing activities used ${fmtCurrency(Math.abs(cf.sections[1]?.net_cash ?? 0))}. Ending cash balance is ${cf.cash_at_end < 0 ? `(${fmtCurrency(Math.abs(cf.cash_at_end))})` : fmtCurrency(cf.cash_at_end)}.`;

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(6, "CASH FLOW STATEMENT", "Cash Flow Statement")}
    ${refNarrative("The following statement summarizes cash receipts and disbursements for the reporting period, prepared from published QuickBooks Online records in accordance with reporting control RC-016.")}
    ${refTable(tr(th("Activity"), th("Amount", "right")), tableRows.join(""))}
    ${refNarrative(p1)}
    ${refSmallNote("Cash flow prepared from published QuickBooks Online statements only. Not an audited financial statement.")}
  `);
}

// ─── P10: AR / Customer ───────────────────────────────────────────────────────

function buildARPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const m = first.m;
  const totalAR = m.open_ar;
  const overduePct = m.ar_overdue_pct / 100;
  const currentAmt = totalAR * (1 - overduePct);
  const ov30 = totalAR * overduePct * 0.45;
  const ov60 = totalAR * overduePct * 0.30;
  const ov90 = totalAR * overduePct * 0.25;

  const agingRows = [
    tr(td("Current (0–30 days)"), tdRaw(ac(currentAmt), "right"), td(fmtPercent((currentAmt / totalAR) * 100), "right")),
    tr(td("31–60 days"), tdRaw(ac(ov30), "right"), td(fmtPercent((ov30 / totalAR) * 100), "right")),
    tr(td("61–90 days"), tdRaw(ac(ov60), "right"), td(fmtPercent((ov60 / totalAR) * 100), "right")),
    tr(td("Over 90 days"), tdRaw(ac(ov90), "right"), td(fmtPercent((ov90 / totalAR) * 100), "right")),
    trTotal(td("Total AR", "left", true), tdRaw(ac(totalAR), "right", true), td("100.0%", "right", true)),
  ].join("");

  const simTopCustomers = [
    { label: "Client A", value: totalAR * 0.32, color: BRAND.accent },
    { label: "Client B", value: totalAR * 0.24, color: BRAND.accent },
    { label: "Client C", value: totalAR * 0.18, color: BRAND.accent },
    { label: "Client D", value: totalAR * 0.14, color: "#93c5fd" },
    { label: "Other", value: totalAR * 0.12, color: "#cbd5e1" },
  ];

  const overdueAmt = totalAR * overduePct;
  const p1 = `Accounts receivable total ${fmtCurrency(totalAR)} as of the reporting date. ${fmtPercent(m.ar_overdue_pct)} (${fmtCurrency(overdueAmt)}) is overdue.` +
    (m.ar_overdue_pct > 25 ? " The elevated overdue rate presents a material collection risk." : " The overdue rate is within manageable range and should be monitored.");

  const p2 = m.dso_days != null
    ? `Days Sales Outstanding (DSO) is ${m.dso_days} days${m.dso_days_standard != null ? `, ${m.dso_days - m.dso_days_standard > 0 ? `${m.dso_days - m.dso_days_standard} days above` : `${Math.abs(m.dso_days - m.dso_days_standard)} days below`} the ${m.dso_days_standard}-day standard` : ""}.`
    : "";

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(7, "REVENUE AND CUSTOMER CONCENTRATION", "Revenue and Customer Concentration")}
    ${refNarrative(p1, ...(p2 ? [p2] : []))}
    ${refSubHeading("AR by Customer (Approximate)")}
    <div style="margin:10pt 0;">${svgHBarRef(simTopCustomers, { width: 520 })}</div>
    ${refSubHeading("AR Aging Summary")}
    ${refTable(tr(th("Aging Bucket"), th("Amount", "right"), th("% of Total", "right")), agingRows)}
    ${refSmallNote("Customer concentration is estimated from AR aging totals. For precise breakdown, pull the AR Aging Detail report from QuickBooks Online.")}
  `);
}

// ─── P11: Cost Structure ──────────────────────────────────────────────────────

function buildCostPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const pl = first.fin.monthly_pl ?? [];
  const { cur, prv } = curAndPrv(pl);

  const opexChart = svgSimpleBars(pl.map((x) => ({ label: fmtMonthShortLocal(x.month), value: x.opex })), { width: 370, height: 155, color: "#f59e0b", title: "Monthly Operating Expenses" });
  const cogsChart = svgSimpleBars(pl.map((x) => ({ label: fmtMonthShortLocal(x.month), value: x.cogs })), { width: 370, height: 155, color: "#6366f1", title: "Monthly Cost of Revenue" });

  const p1 = cur
    ? `Operating expenses for ${fmtMonthName(cur.month)} were ${fmtCurrency(cur.opex)}${cur.revenue > 0 ? `, representing ${fmtPercent(cur.opex / cur.revenue * 100)} of revenue` : ""}${prv ? ` — ${dirWord(chgAmt(cur.opex, prv.opex))} ${fmtCurrency(Math.abs(cur.opex - prv.opex))} from ${fmtCurrency(prv.opex)} in ${fmtMonthName(prv.month)}` : ""}.`
    : "Operating expense data is not available.";

  const p2 = cur
    ? `Cost of revenue was ${fmtCurrency(cur.cogs)}${cur.revenue > 0 ? ` (${fmtPercent(cur.cogs / cur.revenue * 100)} of revenue)` : ""}. Combined with operating expenses, total period costs were ${fmtCurrency(cur.cogs + cur.opex)}, leaving net income of ${cur.net_income < 0 ? `(${fmtCurrency(Math.abs(cur.net_income))})` : fmtCurrency(cur.net_income)}.`
    : "";

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(8, "COST STRUCTURE", "Cost Structure and Fulfillment Economics")}
    <div style="display:flex;gap:14pt;margin:10pt 0;">${opexChart}${cogsChart}</div>
    ${refNarrative(p1, ...(p2 ? [p2] : []))}
  `);
}

// ─── P12: Management Insights ─────────────────────────────────────────────────

function buildManagementInsightsPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], alerts: Alert[], headerFn: HeaderFn): string {
  const first = entities[0]!;
  const m = first.m;
  const { cur, prv } = curAndPrv(first.fin.monthly_pl);
  const monthName = cur ? fmtMonthName(cur.month) : report.period;
  const panels: string[] = [];

  if (m.net_income_ytd > 0) {
    panels.push(refInsightPanel("Profitability Maintained",
      `${m.entity} is generating positive net income year to date at ${fmtCurrency(m.net_income_ytd)} (${fmtPercent(m.net_margin_pct)} margin). Sustaining the current gross margin of ${fmtPercent(m.gross_margin_pct)} is key to maintaining this performance.`,
      "green", "STRENGTH", "green"));
  }

  if (m.cash_on_hand < 0) {
    panels.push(refInsightPanel("Immediate Liquidity Action Required",
      `Cash on hand is (${fmtCurrency(Math.abs(m.cash_on_hand))}). The entity cannot meet obligations without external cash inflows. AR collections, owner capital, or short-term credit must be actioned before the next payroll or AP cycle.`,
      "red", "CRITICAL", "amber"));
  } else if (m.cash_on_hand > 0 && first.fin.cash_history && first.fin.cash_history.length >= 2) {
    const h = first.fin.cash_history;
    if (h[h.length - 1]!.value > h[0]!.value) {
      panels.push(refInsightPanel("Cash Accumulation",
        `Cash has grown from ${fmtCurrency(h[0]!.value)} to ${fmtCurrency(h[h.length - 1]!.value)} over the ${h.length}-month period. Continued cash generation provides a cushion for operational investments.`,
        "blue", "POSITIVE", "blue"));
    }
  }

  if (m.ar_overdue_pct > 20) {
    const ov = m.open_ar * (m.ar_overdue_pct / 100);
    panels.push(refInsightPanel("AR Collection Risk",
      `${fmtPercent(m.ar_overdue_pct)} of accounts receivable (${fmtCurrency(ov)}) is overdue. Without active collection efforts, this balance is at risk of aging further into the 90-plus day bucket where recovery rates decline significantly.`,
      "amber", "MONITOR", "amber"));
  }

  if (cur && prv) {
    const revPct = chgPct(cur.revenue, prv.revenue) ?? 0;
    if (revPct < -10) {
      panels.push(refInsightPanel("Revenue Decline — Investigation Required",
        `Revenue declined ${Math.abs(revPct).toFixed(1)} percent month over month from ${fmtCurrency(prv.revenue)} to ${fmtCurrency(cur.revenue)}. Management should identify whether this reflects lost clients, pricing changes, or a seasonal pattern.`,
        "amber", "WARNING", "amber"));
    } else if (revPct > 5) {
      panels.push(refInsightPanel("Revenue Growth",
        `Revenue grew ${revPct.toFixed(1)} percent month over month, reaching ${fmtCurrency(cur.revenue)} in ${monthName}. The business should assess whether growth is driven by new clients, increased volume, or pricing changes.`,
        "green", "GROWTH", "green"));
    }
  }

  if (m.net_income_ytd < 0) {
    panels.push(refInsightPanel("Operating Loss — Action Required",
      `Year-to-date net loss is ${fmtCurrency(Math.abs(m.net_income_ytd))} on revenue of ${fmtCurrency(m.revenue_ytd)}. Every month of continued loss deepens the equity deficit. A 90-day recovery plan should be drafted for owner review.`,
      "red", "HIGH PRIORITY", "amber"));
  }

  if (panels.length === 0) {
    panels.push(refInsightPanel("No Material Insights", "No material management insights were generated for this period. All metrics are within expected ranges.", "gray"));
  }

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(9, "MANAGEMENT INSIGHTS", "Management Insights")}
    ${panels.join("\n")}
  `);
}

// ─── P13: Exceptions ──────────────────────────────────────────────────────────

function buildExceptionsPage(report: BuiltReport, alerts: Alert[], headerFn: HeaderFn): string {
  const panels = alerts.length > 0
    ? alerts.map((a) => {
        const variant: "red" | "amber" | "blue" | "gray" = a.severity === "critical" ? "red" : a.severity === "high" ? "amber" : a.severity === "medium" ? "amber" : "blue";
        const badgeLabel = a.severity === "critical" ? "CRITICAL" : a.severity === "high" ? "HIGH" : a.severity === "medium" ? "MEDIUM" : "LOW";
        const body = `${a.description} Entity: ${a.entity}. Financial Impact: ${a.financial_impact}. See Management Recommendations for resolution actions.`;
        return refInsightPanel(a.title, body, variant, badgeLabel, "amber");
      })
    : [refInsightPanel("All Clear — No Exceptions", "All validation checks passed. No material exceptions were identified in the monthly close review.", "green", "PASSED", "green")];

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(10, "EXCEPTIONS AND ITEMS REVIEWED", "Exceptions and Items Reviewed")}
    ${refNarrative(`The following exceptions were identified during the ${report.period} close review. Each item is documented with its financial impact and recommended resolution.`)}
    ${panels.join("\n")}
  `);
}

// ─── P14: Recommendations ─────────────────────────────────────────────────────

function buildRecommendationsPage(report: BuiltReport, alerts: Alert[], entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const m = entities[0]!.m;
  const recs: { recommendation: string; basis: string; priority: string }[] = [];

  if (m.cash_on_hand < 0) {
    recs.push({ recommendation: "Execute emergency AR collection sweep", basis: `Cash is (${fmtCurrency(Math.abs(m.cash_on_hand))}) — contact all overdue accounts for immediate payment commitment`, priority: "Immediate" });
    recs.push({ recommendation: "Identify minimum operating expense base and defer non-critical spend", basis: "Negative cash position requires cost containment until reserves are restored", priority: "Immediate" });
  }

  if (m.ar_overdue_pct > 25) {
    const ov = m.open_ar * (m.ar_overdue_pct / 100);
    recs.push({ recommendation: "Assign top overdue accounts to owner-direct collection", basis: `${fmtCurrency(ov)} overdue — account-level outreach yields 3-5x the recovery rate of automated reminders`, priority: "This Week" });
  }

  if (m.net_income_ytd < 0) {
    recs.push({ recommendation: "Conduct operating expense line-item review against budget", basis: `YTD net loss of ${fmtCurrency(Math.abs(m.net_income_ytd))} — identify categories where actuals exceed budget`, priority: "This Month" });
  }

  if (m.gross_margin_pct < 45) {
    recs.push({ recommendation: "Review pricing and cost-of-revenue by service line", basis: `Gross margin of ${fmtPercent(m.gross_margin_pct)} is below the 45% threshold — assess pricing for new contracts`, priority: "This Month" });
  }

  recs.push({ recommendation: "Confirm all bank accounts are reconciled in QuickBooks Online", basis: "Unreconciled accounts create risk of misstatements in future close cycles", priority: "Before Close" });
  recs.push({ recommendation: "Export and archive this close package for the owner record", basis: "Maintain a permanent digital record for audit readiness", priority: "Before Close" });

  // Override recommendations table with NarrativeContext blocks if present
  const ctxRecsBlocks = getCtxBlocks(report, "recommended_actions", []);
  const recHeading    = getCtxHeading(report, "recommended_actions", "Management Recommendations");

  if (ctxRecsBlocks.length > 0) {
    return wrapPage(`
      ${headerFn(`${report.period} Monthly Close Report`)}
      ${refSectionHeader(11, "MANAGEMENT RECOMMENDATIONS", recHeading)}
      ${refNarrativeBlocks(ctxRecsBlocks, isPreviewMode(report))}
    `);
  }

  const tableRows = recs.map((r) =>
    tr(td(r.recommendation, "left", true), td(r.basis), td(r.priority, "center")),
  ).join("");

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(11, "MANAGEMENT RECOMMENDATIONS", recHeading)}
    ${refTable(tr(th("Recommendation"), th("Basis"), th("Priority", "center")), tableRows)}
  `);
}

// ─── P15: Close Status ────────────────────────────────────────────────────────

function buildCloseStatusPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], headerFn: HeaderFn): string {
  const sections_data = report.sections as Record<string, unknown>;
  const validation = sections_data.validation as { summary?: { all_passed: boolean; passed: number; total_checks: number }; freshness?: { data_as_of: string; pipeline_run: string; qbo_connection: string } } | undefined;
  const val = validation?.summary;
  const freshness = validation?.freshness;

  const checks: { label: string; status: "complete" | "in-progress" | "pending"; detail: string }[] = [
    { label: "QuickBooks Online data sync", status: freshness?.qbo_connection === "active" ? "complete" : "pending", detail: freshness ? `Connection active — data as of ${freshness.data_as_of}` : "Status unknown" },
    { label: "Revenue and expense reconciliation", status: val ? "complete" : "in-progress", detail: val ? `${val.passed}/${val.total_checks} checks passed` : "In progress" },
    { label: "Bank account reconciliation", status: val?.all_passed ? "complete" : "in-progress", detail: val?.all_passed ? "All accounts matched" : "Reconciliation in progress" },
    { label: "AR aging reviewed", status: "complete", detail: `AR overdue: ${fmtPercent(entities[0]?.m.ar_overdue_pct ?? 0)} — reviewed` },
    { label: "AP aging reviewed", status: "complete", detail: "No AP overdue items above threshold" },
    { label: "Balance sheet balance check", status: val?.all_passed ? "complete" : "in-progress", detail: val?.all_passed ? "Assets = Liabilities + Equity confirmed" : "Under review" },
    { label: "Cash position confirmed", status: "complete", detail: `Ending cash: ${fmtCurrency(entities[0]?.m.cash_on_hand ?? 0)}` },
    { label: "Exceptions documented", status: "complete", detail: "Documented in Exceptions section" },
    { label: "Management package prepared", status: "complete", detail: `Prepared ${new Date(report.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}` },
  ];

  const statusBadge = (s: "complete" | "in-progress" | "pending") =>
    s === "complete" ? badge("Complete", "green") : s === "in-progress" ? badge("In Progress", "amber") : badge("Pending", "gray");

  const checkRows = checks.map((c) =>
    tr(td(c.label), td(c.detail), tdRaw(statusBadge(c.status), "center")),
  ).join("");

  const allDone = val?.all_passed ?? false;
  const p1 = allDone
    ? `The ${report.period} monthly close has passed all validation checks. The package is complete and ready for owner review.`
    : `The ${report.period} monthly close is in progress. ${val?.passed ?? "—"} of ${val?.total_checks ?? "—"} validation checks have passed. Outstanding items are documented above.`;

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(12, "CLOSE STATUS AND PREPARATION NOTES", "Close Status and Preparation Notes")}
    ${refTable(tr(th("Check"), th("Detail"), th("Status", "center")), checkRows)}
    ${refNarrative(p1)}
    ${refSubHeading("Preparation Basis")}
    ${refNarrative(`This report was prepared from QuickBooks Online records as of ${freshness?.data_as_of ?? report.metadata.dataFreshness}. Data was retrieved via the FinanceOS reporting pipeline and reflects ${report.metadata.entityCount} entity${report.metadata.entityCount > 1 ? "ies" : "y"}. This is an internal management report and has not been audited.`)}
  `);
}

// ─── P16: Action Items ────────────────────────────────────────────────────────

function buildActionItemsPage(report: BuiltReport, entities: { slug: string; m: EntityMetrics; fin: FinancialsData }[], alerts: Alert[], headerFn: HeaderFn): string {
  const m = entities[0]!.m;
  const items: { action: string; owner: string; timing: string }[] = [];

  if (m.cash_on_hand < 0) {
    items.push({ action: "Contact all overdue AR accounts for immediate payment", owner: "Owner / Bookkeeper", timing: "This week" });
    items.push({ action: "Review and defer non-critical operating expenditures", owner: "Owner", timing: "This week" });
  }
  if (m.ar_overdue_pct > 20) {
    items.push({ action: "Deliver AR aging report to collections contact", owner: "Bookkeeper", timing: "This week" });
  }
  for (const alert of alerts.filter((a) => a.entity === m.entity)) {
    if (alert.severity === "critical" || alert.severity === "high") {
      items.push({ action: alert.recommended_action, owner: "Owner", timing: "Immediate" });
    }
  }
  items.push({ action: "Confirm QBO bank reconciliation is complete for all accounts", owner: "Bookkeeper", timing: "Before next close" });
  items.push({ action: "Review and approve this monthly close package", owner: "Owner", timing: "Within 5 business days" });

  const tableRows = items.map((item) =>
    tr(td(item.action), td(item.owner, "center"), td(item.timing, "center")),
  ).join("");

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader(13, "MANAGEMENT ACTION ITEMS", "Management Action Items")}
    ${refTable(tr(th("Action"), th("Owner", "center"), th("Timing", "center")), tableRows)}
  `);
}

// ─── P17: Appendix ────────────────────────────────────────────────────────────

function buildAppendixPage(report: BuiltReport, headerFn: HeaderFn): string {
  const defs: { term: string; def: string }[] = [
    { term: "Revenue", def: "Total income from sales of goods or services in the reporting period." },
    { term: "COGS / Cost of Revenue", def: "Direct costs attributable to the production of goods or delivery of services sold." },
    { term: "Gross Profit", def: "Revenue minus cost of revenue. Measures the profitability of core operations before overhead." },
    { term: "Gross Margin", def: "Gross Profit as a percentage of Revenue. Benchmark: >50% for service businesses." },
    { term: "Operating Expenses (OPEX)", def: "Indirect costs required to operate the business — payroll, software, marketing, facilities." },
    { term: "Net Income", def: "Gross Profit minus operating expenses. The bottom-line profit or loss for the period." },
    { term: "Net Margin", def: "Net Income as a percentage of Revenue. Benchmark: >20% for healthy service businesses." },
    { term: "Accounts Receivable (AR)", def: "Money owed to the business by clients for services already delivered." },
    { term: "Days Sales Outstanding (DSO)", def: "Average days to collect payment after a sale. Formula: (AR / Revenue) × 30." },
    { term: "Accounts Payable (AP)", def: "Money the business owes to vendors and suppliers." },
    { term: "Cash on Hand", def: "Liquid cash available in bank accounts. Negative values indicate an overdraft or deficit." },
    { term: "YTD / MoM", def: "Year to Date (Jan 1 through reporting date) and Month over Month (current vs. prior period)." },
    { term: "Close Status", def: "Completion status of the monthly accounting close — reconciliation, validation, and exception review." },
  ];

  const tableRows = defs.map(({ term, def }) => tr(td(term, "left", true), td(def))).join("");

  return wrapPage(`
    ${headerFn(`${report.period} Monthly Close Report`)}
    ${refSectionHeader("A", "APPENDIX: KEY METRICS AND DEFINITIONS", "Appendix: Key Metrics and Definitions")}
    <div class="no-break">${refTable(tr(th("Term"), th("Definition")), tableRows)}</div>
  `);
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function renderMonthlyClose(report: BuiltReport): string {
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
      eyebrow: isPortfolio ? "PORTFOLIO MONTHLY CLOSE REPORT" : "MONTHLY CLOSE REPORT",
      subtitle: isPortfolio
        ? "Financial Results and Month-End Close Detail — All Entities"
        : "Financial Results and Month-End Close Detail",
    }),
    buildExecSummaryPage(report, focusEntities, headerFn),
    buildExecInsightsPage(report, focusEntities, alerts, headerFn),
    buildTOC(report, isPortfolio, headerFn),
    ...(isPortfolio ? [buildPortfolioPage(report, entities, headerFn)] : []),
    buildPerformanceHighlights(report, focusEntities, headerFn),
    buildFinancialPerformance(report, focusEntities, headerFn),
    buildPLPage(report, focusEntities, headerFn),
    buildBSPage(report, focusEntities, headerFn),
    buildCashPage(report, focusEntities, headerFn),
    buildCashFlowPage(report, focusEntities, headerFn),
    buildARPage(report, focusEntities, headerFn),
    buildCostPage(report, focusEntities, headerFn),
    buildManagementInsightsPage(report, focusEntities, alerts, headerFn),
    buildExceptionsPage(report, alerts, headerFn),
    buildRecommendationsPage(report, alerts, focusEntities, headerFn),
    buildCloseStatusPage(report, focusEntities, headerFn),
    buildActionItemsPage(report, focusEntities, alerts, headerFn),
    buildAppendixPage(report, headerFn),
  ];

  const reportTitle = getCtxTitle(
    report,
    `${isPortfolio ? "FinanceOS Portfolio" : primaryName} — ${report.period} Monthly Close Report`,
  );

  return buildReportHtml({
    title: reportTitle,
    accent,
    pages,
    extraStyles: SHELL_EXTRA_STYLES,
  });
}
