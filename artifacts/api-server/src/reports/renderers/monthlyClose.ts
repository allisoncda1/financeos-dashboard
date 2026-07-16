/**
 * FinanceOS Monthly Close Report — Premium HTML Renderer v2
 *
 * Produces a professionally designed, print-ready HTML document suitable for
 * Puppeteer PDF generation. Inspired by Big Four advisory packs and CFO
 * board-ready monthly reports.
 *
 * Data integrity guarantees:
 *  - All values come from BuiltReport.sections — never recalculated here.
 *  - null / undefined → em-dash; never coerced to $0.00.
 *  - Negative values (e.g. Smile More cash deficit) are preserved and styled.
 *  - Cash flow uses only RC-016 published statements.
 */

import type { BuiltReport } from "../builder";
import type {
  EntityMetrics,
  Anomaly,
  FinancialsData,
  MonthlyPL,
  ValidationSummary,
  DataFreshness,
  EntitySlug,
  CashFlowStatement,
  CustomersData,
  VendorsData,
} from "../../lib/types";
import type { Alert } from "../../rules/evaluator";
import { normalizeValidationSummary } from "./validationView";
import {
  BRAND,
  escHtml,
  fmtCurrency,
  fmtPercent,
  fmtDate,
  fmtMonthYear,
  fmtMonthShort,
  amountCell,
  varianceCell,
  variancePill,
  buildBaseStyles,
  pageHeader,
  sectionBanner,
  sectionHeading,
  kpiCard,
  badge,
  insight,
  emptyState,
  dataFooter,
  barRow,
  agingBars,
  legendItems,
  logoImg,
  embedLogoPath,
  svgLineChart,
  svgWaterfallChart,
  svgHBars,
  svgDonut,
} from "./designSystem";
import { ENTITY_DEFINITIONS } from "../../lib/entities";

// ─── Type helpers ─────────────────────────────────────────────────────────────

type EntityEntry = { metrics: EntityMetrics; anomalies: Anomaly[] };

function asEntityMap(s: unknown): Record<string, EntityEntry> {
  return (s as Record<string, EntityEntry>) ?? {};
}
function asFinancialsMap(s: unknown): Record<string, FinancialsData> {
  return (s as Record<string, FinancialsData>) ?? {};
}
function asAlerts(s: unknown): Alert[] {
  return (s as Alert[] | undefined) ?? [];
}
function asArAp(s: unknown): Record<string, { customers?: CustomersData; vendors?: VendorsData }> {
  return (s as Record<string, { customers?: CustomersData; vendors?: VendorsData }>) ?? {};
}
function asValidation(s: unknown): { summary?: ValidationSummary; freshness?: DataFreshness } {
  return (s as { summary?: ValidationSummary; freshness?: DataFreshness }) ?? {};
}
function asPortfolio(s: unknown): Record<string, unknown> {
  const d = s as { portfolio?: Record<string, unknown> } | undefined;
  return d?.portfolio ?? {};
}

function entityDef(slug: string) {
  return ENTITY_DEFINITIONS.find((e) => e.slug === slug);
}

function primaryColorForSlug(slug: string): string {
  return entityDef(slug)?.primaryColor ?? BRAND.darkGreen;
}

function logoPathForSlug(slug: string): string | null {
  return entityDef(slug)?.logo ?? null;
}

// ─── FinanceOS logo embed ─────────────────────────────────────────────────────

function financeosLockupHtml(darkBg = true): string {
  const src = embedLogoPath("/branding/financeos-lockup.png");
  if (src) {
    const filter = darkBg ? "" : "";
    return `<img src="${src}" alt="FinanceOS" style="height:26pt;width:auto;object-fit:contain;display:block${filter ? ";filter:" + filter : ""}" />`;
  }
  return `<span style="font-size:16pt;font-weight:700;color:#fff;font-family:Georgia,serif">FinanceOS</span>`;
}

function financeosIconHtml(size = "24pt"): string {
  const src = embedLogoPath("/branding/financeos-icon.png");
  if (src) {
    return `<img src="${src}" alt="FinanceOS" style="height:${size};width:auto;object-fit:contain;display:block" />`;
  }
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size};height:${size};border-radius:6pt;background:${BRAND.darkGreen};color:#fff;font-weight:700;font-size:12pt;font-family:Georgia,serif">F</span>`;
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function renderCover(report: BuiltReport): string {
  const { branding, template, period, generatedAt, metadata, sections } = report;
  const freshnessData = asValidation(sections["validation"])?.freshness;
  const validation = asValidation(sections["validation"])?.summary;
  const norm = normalizeValidationSummary(validation);

  const isSingle = branding.mode === "single" && branding.primaryEntity;
  const primaryColor = isSingle ? branding.primaryEntity!.primaryColor : BRAND.greenMid;
  const entityLogoPath = isSingle ? branding.primaryEntity!.logoPath : null;
  const entityName = isSingle ? branding.primaryEntity!.name : "FinanceOS Portfolio";
  const entitySlug = isSingle ? branding.primaryEntity!.slug : null;
  const basis = entitySlug ? entityDef(entitySlug)?.accountingBasis ?? "" : "";

  const validBadge = norm
    ? norm.allPassed
      ? badge("Validated", "green")
      : badge("Issues Found", "amber")
    : badge("Pending", "gray");

  const dataAsOf = freshnessData?.data_as_of ? fmtDate(freshnessData.data_as_of) : "—";
  const generatedReadable = fmtDate(generatedAt);

  // Entity logo or chip strip
  let entityDisplay: string;
  if (isSingle) {
    const src = embedLogoPath(entityLogoPath);
    if (src) {
      entityDisplay = `<img src="${src}" alt="${escHtml(entityName)}" style="height:44pt;width:auto;max-width:160pt;object-fit:contain;display:block;margin-bottom:6pt" />`;
    } else {
      entityDisplay = `<div style="width:52pt;height:52pt;border-radius:10pt;background:${escHtml(primaryColor)};display:flex;align-items:center;justify-content:center;font-size:20pt;font-weight:700;color:#fff;margin-bottom:6pt">${escHtml(entityName.slice(0,2).toUpperCase())}</div>`;
    }
  } else {
    // Multi-entity chip strip with logos
    const chips = branding.entities.map((e) => {
      const def = entityDef(e.slug);
      const logoSrc = embedLogoPath(e.logoPath ?? def?.logo ?? null);
      const entityColor = def?.primaryColor ?? BRAND.darkGreen;
      const logoEl = logoSrc
        ? `<img src="${logoSrc}" alt="${escHtml(e.name)}" style="height:14pt;width:auto;max-width:36pt;object-fit:contain" />`
        : `<span style="display:inline-flex;align-items:center;justify-content:center;width:16pt;height:16pt;border-radius:3pt;background:${entityColor};color:#fff;font-weight:700;font-size:8pt">${escHtml(e.name.slice(0,2).toUpperCase())}</span>`;
      return `<div class="cover__entity-chip">${logoEl}<span>${escHtml(e.name)}</span></div>`;
    }).join("");
    entityDisplay = `<div class="cover__entity-chips mb-8">${chips}</div>`;
  }

  return `
<div class="cover">
  <!-- Hero header bar -->
  <div class="cover__hero">
    <div class="cover__hero-pattern"></div>
    <div style="margin-bottom:auto">${financeosLockupHtml(true)}</div>
    <div style="margin-top:16pt">
      <div class="cover__tagline">Financial Intelligence Platform</div>
      <div class="cover__report-type">${escHtml(template.name)}</div>
    </div>
  </div>

  <!-- Entity accent strip -->
  <div class="cover__accent-bar" style="background:${escHtml(primaryColor)}"></div>

  <!-- Document body -->
  <div class="cover__body">
    <!-- Entity identity -->
    <div class="cover__entity-row">
      <div>
        ${entityDisplay}
        <div class="cover__entity-name">${escHtml(entityName)}</div>
        ${isSingle && basis ? `<div class="cover__entity-sub">${escHtml(basis)} Basis</div>` : ""}
      </div>
    </div>

    <!-- Period -->
    <div class="cover__period">Reporting Period: ${escHtml(period)}</div>

    <!-- Metadata grid -->
    <div class="cover__meta-grid">
      <div class="cover__meta-cell" style="border-left-color:${escHtml(primaryColor)}">
        <div class="cover__meta-label">Data As Of</div>
        <div class="cover__meta-value">${escHtml(dataAsOf)}</div>
      </div>
      <div class="cover__meta-cell" style="border-left-color:${escHtml(primaryColor)}">
        <div class="cover__meta-label">Generated</div>
        <div class="cover__meta-value">${escHtml(generatedReadable)}</div>
      </div>
      <div class="cover__meta-cell" style="border-left-color:${escHtml(primaryColor)}">
        <div class="cover__meta-label">Validation Status</div>
        <div class="cover__meta-value">${validBadge}</div>
      </div>
      <div class="cover__meta-cell" style="border-left-color:${escHtml(primaryColor)}">
        <div class="cover__meta-label">Entities</div>
        <div class="cover__meta-value">${metadata.entityCount} ${metadata.entityCount === 1 ? "Entity" : "Entities"}</div>
      </div>
      <div class="cover__meta-cell" style="border-left-color:${escHtml(primaryColor)}">
        <div class="cover__meta-label">Report Type</div>
        <div class="cover__meta-value">${isSingle ? "Single Entity" : "Portfolio"}</div>
      </div>
      ${norm ? `<div class="cover__meta-cell" style="border-left-color:${escHtml(primaryColor)}">
        <div class="cover__meta-label">Checks Passed</div>
        <div class="cover__meta-value">${norm.passed ?? "—"} / ${norm.totalChecks ?? "—"}</div>
      </div>` : ""}
    </div>

    <!-- Footer -->
    <div class="cover__footer">
      <div style="display:flex;align-items:center;gap:8pt">
        ${financeosIconHtml("14pt")}
        <span>Prepared by FinanceOS &middot; Automated Financial Intelligence</span>
      </div>
      <div class="cover__confidential">Confidential</div>
    </div>
  </div>
</div>`;
}

// ─── Helper: build per-page branding opts ─────────────────────────────────────

function hdrOpts(report: BuiltReport): Parameters<typeof pageHeader>[0] {
  const isSingle = report.branding.mode === "single" && report.branding.primaryEntity;
  return {
    reportTitle: report.template.name,
    entityName: isSingle ? report.branding.primaryEntity!.name : "Portfolio",
    period: report.period,
    logoPath: isSingle ? report.branding.primaryEntity!.logoPath : "/branding/financeos-icon.png",
    primaryColor: isSingle ? report.branding.primaryEntity!.primaryColor : BRAND.darkGreen,
  };
}

// ─── Section 1: Executive Overview ───────────────────────────────────────────

function renderExecutiveOverview(report: BuiltReport): string {
  const entityMap = asEntityMap(report.sections["entity_summary"]);
  const portfolio = asPortfolio(report.sections["portfolio_kpis"]);
  const isSingle = report.branding.mode === "single" && report.branding.primaryEntity;
  const entries = Object.entries(entityMap);
  const firstMetrics: EntityMetrics | null = entries.length > 0 ? entries[0]![1].metrics : null;

  const rev = firstMetrics?.revenue_ytd ?? (portfolio["portfolio_revenue_ytd"] as number | null);
  const ni = firstMetrics?.net_income_ytd ?? (portfolio["portfolio_net_income_ytd"] as number | null);
  const netMgn = firstMetrics?.net_margin_pct ?? (portfolio["portfolio_net_margin_pct"] as number | null);
  const grossMgn = firstMetrics?.gross_margin_pct ?? null;
  const cash = firstMetrics?.cash_on_hand ?? (portfolio["portfolio_cash_on_hand"] as number | null);
  const ar = firstMetrics?.open_ar ?? (portfolio["portfolio_open_ar"] as number | null);
  const ap = firstMetrics?.open_ap ?? (portfolio["portfolio_open_ap"] as number | null);
  const arOverdue = firstMetrics?.ar_overdue_pct ?? null;
  const dso = firstMetrics?.dso_days ?? null;
  const runway = portfolio["cash_runway_months"] as number | null ?? null;

  const { html: niHtml } = amountCell(ni);
  const { html: cashHtml } = amountCell(cash);

  // KPI variant logic
  const niVariant = ni === null ? "default" : ni < 0 ? "negative" : ni > 0 ? "positive" : "default";
  const cashVariant = cash === null ? "default" : cash < 0 ? "negative" : "default";
  const arVariant = arOverdue !== null && arOverdue >= 80 ? "negative" : arOverdue !== null && arOverdue >= 40 ? "warning" : "default";

  // Trend sparkline from monthly P&L
  const allFin = asFinancialsMap(report.sections["financials"]);
  const firstFin = Object.values(allFin)[0];
  const revTrend = (firstFin?.monthly_pl ?? []).map((m) => m.revenue);
  const niTrend  = (firstFin?.monthly_pl ?? []).map((m) => m.net_income);
  const labels   = (firstFin?.monthly_pl ?? []).map((m) => fmtMonthShort(m.month + "-01"));

  const revChart = revTrend.length >= 2
    ? `<div class="chart-box" style="margin-bottom:0">
        <div class="chart-box__title">Revenue Trend</div>
        ${svgLineChart(revTrend, { width: 240, height: 65, color: BRAND.darkGreen, labels, showDots: true, fillOpacity: 0.1 })}
      </div>`
    : "";

  const niChart = niTrend.length >= 2
    ? `<div class="chart-box" style="margin-bottom:0">
        <div class="chart-box__title">Net Income Trend</div>
        ${svgLineChart(niTrend, { width: 240, height: 65, color: ni !== null && ni < 0 ? BRAND.negative : BRAND.positive, labels, showDots: true, fillOpacity: 0.1 })}
      </div>`
    : "";

  // Close status
  const validData = asValidation(report.sections["validation"]);
  const norm = normalizeValidationSummary(validData.summary);
  const closeStatus = norm?.allPassed
    ? insight("Close Status: Complete", `All ${norm.totalChecks ?? ""} validation checks passed. Data is publication-ready.`, "positive")
    : norm
    ? insight("Close Status: Review Required", `${norm.failed ?? "?"} of ${norm.totalChecks ?? "?"} validation checks failed. Review data integrity section.`, "warning")
    : insight("Close Status: Unknown", "Validation results not available.", "neutral");

  // Auto-insights
  const autoInsights: { title: string; text: string; variant: "positive" | "warning" | "critical" | "info" | "neutral" }[] = [];
  if (netMgn !== null && Number.isFinite(netMgn)) {
    if (netMgn < 0) autoInsights.push({ title: "Net Loss", text: `Portfolio is operating at a net loss of ${fmtPercent(Math.abs(netMgn))} YTD. Operating expenses exceed revenue — immediate review required.`, variant: "critical" });
    else if (netMgn < 5) autoInsights.push({ title: "Thin Margins", text: `Net margin of ${fmtPercent(netMgn)} is below the 5% watch threshold. Monitor opex closely.`, variant: "warning" });
    else autoInsights.push({ title: "Profitability", text: `Net margin of ${fmtPercent(netMgn)} is within healthy range.`, variant: "positive" });
  }
  if (cash !== null && Number.isFinite(cash) && cash < 0) {
    autoInsights.push({ title: "Negative Cash Position", text: `Cash on hand is ${fmtCurrency(cash, { showParens: true })}. Immediate liquidity action is required.`, variant: "critical" });
  }
  if (arOverdue !== null && arOverdue >= 60) {
    autoInsights.push({ title: "AR Collection Risk", text: `${fmtPercent(arOverdue)} of accounts receivable is overdue. Collection action required.`, variant: "warning" });
  }

  const freshness = validData.freshness;

  return `
<div class="section section--break" id="section-executive-overview">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Executive Overview", { number: 1, bgColor: BRAND.sectionExec, accentColor: BRAND.greenMid })}

  <!-- KPI grid row 1 -->
  <div class="kpi-grid kpi-grid--4 mb-12">
    ${kpiCard("Revenue YTD", fmtCurrency(rev), { variant: "primary" })}
    ${kpiCard("Net Income YTD", niHtml, { variant: niVariant as "positive" | "negative" | "default" })}
    ${kpiCard("Net Margin", fmtPercent(netMgn), { variant: netMgn !== null && netMgn < 0 ? "negative" : netMgn !== null && netMgn >= 15 ? "positive" : "default" })}
    ${kpiCard("Gross Margin", fmtPercent(grossMgn))}
  </div>

  <div class="kpi-grid kpi-grid--4 mb-12">
    ${kpiCard("Cash on Hand", cashHtml, { variant: cashVariant as "negative" | "default" })}
    ${kpiCard("Open AR", fmtCurrency(ar), { variant: arVariant as "negative" | "warning" | "default" })}
    ${kpiCard("Open AP", fmtCurrency(ap))}
    ${runway !== null ? kpiCard("Cash Runway", `${runway.toFixed(1)} mo`) : kpiCard("DSO", dso != null ? `${dso.toFixed(0)} days` : "—")}
  </div>

  <!-- Trend charts + insights -->
  ${revChart || niChart ? `
  <div class="two-col mb-12">
    <div>${revChart}</div>
    <div>${niChart}</div>
  </div>` : ""}

  <!-- Insights -->
  ${autoInsights.map((ins) => insight(ins.title, ins.text, ins.variant)).join("")}

  <!-- Close status -->
  ${closeStatus}

  ${dataFooter([`Data as of ${freshness?.data_as_of ? fmtDate(freshness.data_as_of) : "—"}`, `${report.metadata.entityCount} ${report.metadata.entityCount === 1 ? "entity" : "entities"}`, "FinanceOS — Confidential"])}
</div>`;
}

// ─── Section 2: Entity Performance ───────────────────────────────────────────

function renderEntityPerformance(report: BuiltReport): string {
  const entityMap = asEntityMap(report.sections["entity_summary"]);
  const entries = Object.entries(entityMap).filter(([, v]) => v.metrics);
  if (entries.length === 0) return "";

  const isSingle = report.branding.mode === "single" && report.branding.primaryEntity;
  return isSingle && entries.length === 1
    ? renderSingleScorecard(report, entries[0]![0] as EntitySlug, entries[0]![1])
    : renderMultiEntityTable(report, entries);
}

function renderSingleScorecard(report: BuiltReport, slug: EntitySlug, entry: EntityEntry): string {
  const m = entry.metrics;
  if (!m) return "";
  const def = entityDef(slug);
  const primaryColor = def?.primaryColor ?? BRAND.darkGreen;
  const logoPath = def?.logo ?? null;

  const { html: niHtml } = amountCell(m.net_income_ytd);
  const { html: cashHtml } = amountCell(m.cash_on_hand);

  // Cash bar (vs zero)
  const maxForBar = Math.max(Math.abs(m.cash_on_hand ?? 0), Math.abs(m.open_ar ?? 0), Math.abs(m.open_ap ?? 0), 1);

  const allFin = asFinancialsMap(report.sections["financials"]);
  const fin = allFin[slug];
  const revTrend = (fin?.monthly_pl ?? []).map((m) => m.revenue);
  const mgnTrend = (fin?.monthly_pl ?? []).map((m) => m.net_income && m.revenue ? (m.net_income / m.revenue) * 100 : null);
  const labels   = (fin?.monthly_pl ?? []).map((m) => fmtMonthShort(m.month + "-01"));

  return `
<div class="section section--break" id="section-entity-performance">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Entity Performance", { number: 2, bgColor: BRAND.sectionPerf, accentColor: "#3b82f6" })}

  <div class="scorecard no-break">
    <div class="scorecard__header" style="background:${escHtml(primaryColor)}">
      ${logoImg(logoPath, m.entity, primaryColor, { height: "40pt" })}
      <div>
        <div class="scorecard__name">${escHtml(m.entity)}</div>
        <div class="scorecard__sub">${escHtml(m.basis)} Basis &middot; As of ${escHtml(fmtDate(m.as_of))} &middot; ${escHtml(m.slug)}</div>
      </div>
    </div>
    <div class="scorecard__body">
      <div class="kpi-grid kpi-grid--4 mb-12">
        ${kpiCard("Revenue YTD", fmtCurrency(m.revenue_ytd), { variant: "primary" })}
        ${kpiCard("Net Income YTD", niHtml, { variant: m.net_income_ytd < 0 ? "negative" : m.net_income_ytd > 0 ? "positive" : "default" })}
        ${kpiCard("Gross Margin", fmtPercent(m.gross_margin_pct))}
        ${kpiCard("Net Margin", fmtPercent(m.net_margin_pct), { variant: m.net_margin_pct < 0 ? "negative" : "default" })}
      </div>
      <div class="kpi-grid kpi-grid--4 mb-12">
        ${kpiCard("Cash on Hand", cashHtml, { variant: (m.cash_on_hand ?? 0) < 0 ? "negative" : "default" })}
        ${kpiCard("Open AR", fmtCurrency(m.open_ar))}
        ${kpiCard("Open AP", fmtCurrency(m.open_ap))}
        ${kpiCard("DSO", m.dso_days != null ? `${m.dso_days.toFixed(0)} days` : "—")}
      </div>

      ${revTrend.length >= 2 ? `
      <div class="two-col">
        <div class="chart-box">
          <div class="chart-box__title">Revenue Trend</div>
          ${svgLineChart(revTrend, { width: 240, height: 60, color: primaryColor, labels, showDots: true, fillOpacity: 0.1 })}
        </div>
        <div class="chart-box">
          <div class="chart-box__title">Net Margin Trend (%)</div>
          ${svgLineChart(mgnTrend, { width: 240, height: 60, color: BRAND.info, labels, showDots: true, fillOpacity: 0.08 })}
        </div>
      </div>` : ""}

      <!-- Working capital bars -->
      <div class="chart-box" style="margin-bottom:0">
        <div class="chart-box__title">Working Capital Overview</div>
        ${barRow("Cash on Hand", m.cash_on_hand, maxForBar, fmtCurrency(m.cash_on_hand, { compact: true }), primaryColor)}
        ${barRow("Open AR", m.open_ar, maxForBar, fmtCurrency(m.open_ar, { compact: true }), BRAND.info)}
        ${barRow("Open AP", m.open_ap, maxForBar, fmtCurrency(m.open_ap, { compact: true }), BRAND.warning)}
      </div>
    </div>
  </div>

  ${dataFooter([`As of ${fmtDate(m.as_of)}`, "FinanceOS — Confidential"])}
</div>`;
}

function renderMultiEntityTable(
  report: BuiltReport,
  entries: [string, EntityEntry][],
): string {
  // Find best / worst for conditional formatting
  const revVals = entries.map(([, v]) => v.metrics?.revenue_ytd ?? 0);
  const maxRev = Math.max(...revVals);

  const headerRow = `
<tr>
  <th style="width:28pt"></th>
  <th>Entity</th>
  <th class="num">Revenue YTD</th>
  <th class="num">Net Income</th>
  <th class="num">Net Margin</th>
  <th class="num">Gross Margin</th>
  <th class="num">Cash</th>
  <th class="num">Open AR</th>
  <th class="num">DSO</th>
  <th class="num">AR Overdue</th>
</tr>`;

  const bodyRows = entries.map(([slug, { metrics: m }]) => {
    if (!m) return "";
    const def = entityDef(slug);
    const primaryColor = def?.primaryColor ?? BRAND.darkGreen;
    const logoSrc = embedLogoPath(def?.logo ?? null);
    const logoEl = logoSrc
      ? `<img src="${logoSrc}" alt="${escHtml(m.entity)}" style="height:16pt;width:auto;max-width:36pt;object-fit:contain;display:block" />`
      : `<span style="display:inline-flex;align-items:center;justify-content:center;width:18pt;height:18pt;border-radius:3pt;background:${primaryColor};color:#fff;font-weight:700;font-size:7pt">${escHtml(m.entity.slice(0,2).toUpperCase())}</span>`;

    const { html: niHtml } = amountCell(m.net_income_ytd);
    const { html: cashHtml } = amountCell(m.cash_on_hand);
    const mgnColor = m.net_margin_pct < 0 ? BRAND.negative : m.net_margin_pct >= 15 ? BRAND.positive : BRAND.textPrimary;
    const arOvColor = m.ar_overdue_pct >= 80 ? BRAND.negative : m.ar_overdue_pct >= 40 ? BRAND.warning : BRAND.positive;
    const isMaxRev = Math.abs((m.revenue_ytd ?? 0) - maxRev) < 0.01;

    return `
<tr>
  <td class="entity-logo-cell">${logoEl}</td>
  <td class="entity-name-cell">
    <strong>${escHtml(m.entity)}</strong>
    <div style="font-size:7pt;color:${BRAND.textFaint}">${escHtml(m.basis)}</div>
  </td>
  <td class="num" style="${isMaxRev ? `font-weight:700;color:${BRAND.darkGreen}` : ""}">${fmtCurrency(m.revenue_ytd)}</td>
  <td class="num">${niHtml}</td>
  <td class="num" style="color:${mgnColor};font-weight:600">${fmtPercent(m.net_margin_pct)}</td>
  <td class="num">${fmtPercent(m.gross_margin_pct)}</td>
  <td class="num">${cashHtml}</td>
  <td class="num">${fmtCurrency(m.open_ar)}</td>
  <td class="num">${m.dso_days != null ? `${m.dso_days.toFixed(0)}d` : "—"}</td>
  <td class="num" style="color:${arOvColor};font-weight:600">${fmtPercent(m.ar_overdue_pct)}</td>
</tr>`;
  }).join("");

  // Revenue comparison bars
  const revBarsHtml = svgHBars(
    entries.map(([slug, { metrics: m }]) => ({
      label: m?.entity ?? slug,
      value: m?.revenue_ytd ?? 0,
      color: entityDef(slug)?.primaryColor ?? BRAND.darkGreen,
    })),
    { width: 340, maxValue: maxRev, unit: "$" },
  );

  const freshnessData = asValidation(report.sections["validation"])?.freshness;

  return `
<div class="section section--break" id="section-entity-performance">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Portfolio & Entity Performance", { number: 2, bgColor: BRAND.sectionPerf, accentColor: "#3b82f6" })}

  <table class="fin-table entity-table mb-12">
    <thead>${headerRow}</thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="col-55-45">
    <div class="chart-box">
      <div class="chart-box__title">Revenue YTD — Entity Comparison</div>
      ${revBarsHtml}
      ${legendItems(entries.map(([slug, { metrics: m }]) => ({ label: m?.entity ?? slug, color: entityDef(slug)?.primaryColor ?? BRAND.darkGreen })))}
    </div>
    <div class="chart-box">
      <div class="chart-box__title">Net Margin by Entity</div>
      ${svgHBars(
        entries.map(([slug, { metrics: m }]) => ({
          label: m?.entity ?? slug,
          value: m?.net_margin_pct ?? 0,
          color: (m?.net_margin_pct ?? 0) < 0 ? BRAND.negative : (entityDef(slug)?.primaryColor ?? BRAND.darkGreen),
        })),
        { width: 260 },
      )}
    </div>
  </div>

  ${dataFooter([`Data as of ${freshnessData?.data_as_of ? fmtDate(freshnessData.data_as_of) : "—"}`, `${entries.length} entities`, "FinanceOS — Confidential"])}
</div>`;
}

// ─── Section 3: Profit & Loss ─────────────────────────────────────────────────

function renderProfitLoss(report: BuiltReport): string {
  const financialsMap = asFinancialsMap(report.sections["financials"]);
  const entries = Object.entries(financialsMap);
  if (entries.length === 0) return "";

  const blocks = entries.map(([slug, fin]) => renderEntityPL(report, slug as EntitySlug, fin)).join("");

  return `
<div class="section section--break" id="section-profit-loss">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Profit & Loss Statement", { number: 3, bgColor: BRAND.sectionPnL, accentColor: "#60a5fa" })}
  ${blocks}
</div>`;
}

function renderEntityPL(report: BuiltReport, slug: EntitySlug, fin: FinancialsData): string {
  if (!fin) return "";
  const pl = fin.monthly_pl ?? [];
  const ytd = fin.ytd_summary;
  const isSingle = report.branding.mode === "single";
  const def = entityDef(slug);
  const primaryColor = def?.primaryColor ?? BRAND.darkGreen;

  const recentMonths = pl.slice(-3);

  type PLKey = "revenue" | "cogs" | "gross_profit" | "opex" | "net_income";
  const plRows: {
    label: string; key: PLKey; indent?: boolean; subtotal?: boolean; total?: boolean; section?: boolean; section_key?: boolean;
    isCost?: boolean;
  }[] = [
    { label: "Revenue", key: "revenue", section_key: true },
    { label: "Cost of Goods Sold", key: "cogs", indent: true, isCost: true },
    { label: "Gross Profit", key: "gross_profit", subtotal: true },
    { label: "Operating Expenses", key: "opex", indent: true, isCost: true },
    { label: "Net Income", key: "net_income", total: true },
  ];

  const monthHeaders = recentMonths.map((m) => `<th class="num">${escHtml(fmtMonthYear(m.month + "-01"))}</th>`).join("");

  const bodyRows = plRows.map((row) => {
    const rowClass = row.total ? "row--total" : row.subtotal ? "row--subtotal" : row.indent ? "row--indent" : "";

    const monthCells = recentMonths.map((m) => {
      const val = m[row.key] as number;
      const { html } = amountCell(val, row.isCost === true);
      return `<td class="num">${html}</td>`;
    }).join("");

    const ytdVal = ytd?.[row.key as keyof typeof ytd] as number | undefined;
    const { html: ytdHtml } = amountCell(ytdVal, row.isCost === true);

    const last = recentMonths[recentMonths.length - 1];
    const prev = recentMonths[recentMonths.length - 2];
    const varCell = last && prev
      ? varianceCell(last[row.key] as number, prev[row.key] as number, row.isCost !== true)
      : '<span class="variance--na">—</span>';

    return `<tr class="${rowClass}"><td>${escHtml(row.label)}</td>${monthCells}<td class="num">${ytdHtml}</td><td class="num nowrap">${varCell}</td></tr>`;
  }).join("");

  // Gross margin row
  const gmRow = recentMonths.map((m) => {
    const gm = m.revenue && m.revenue !== 0 ? ((m.gross_profit ?? 0) / m.revenue) * 100 : null;
    return `<td class="num" style="color:${BRAND.textMuted}">${fmtPercent(gm)}</td>`;
  }).join("");
  const ytdGm = ytd && ytd.revenue && ytd.revenue !== 0 ? ((ytd.gross_profit ?? 0) / ytd.revenue) * 100 : null;

  // Net margin row
  const nmRow = recentMonths.map((m) => {
    const nm = m.revenue && m.revenue !== 0 ? ((m.net_income ?? 0) / m.revenue) * 100 : null;
    const color = nm !== null && nm < 0 ? BRAND.negative : BRAND.textMuted;
    return `<td class="num" style="color:${color}">${fmtPercent(nm)}</td>`;
  }).join("");
  const ytdNm = ytd && ytd.revenue && ytd.revenue !== 0 ? ((ytd.net_income ?? 0) / ytd.revenue) * 100 : null;
  const ytdNmColor = ytdNm !== null && ytdNm < 0 ? BRAND.negative : BRAND.textMuted;

  const entityLabel = isSingle
    ? ""
    : `<div style="display:flex;align-items:center;gap:8pt;margin-bottom:8pt">
        ${logoImg(def?.logo ?? null, fin.entity_slug, primaryColor, { height: "18pt" })}
        <span style="font-size:10pt;font-weight:700;color:${BRAND.textSecondary}">${escHtml(fin.entity_slug)}</span>
      </div>`;

  return `
<div style="margin-bottom:16pt;page-break-inside:avoid">
  ${entityLabel}
  <table class="fin-table">
    <thead>
      <tr>
        <th style="width:38%">Line Item</th>
        ${monthHeaders}
        <th class="num">YTD</th>
        <th class="num">MoM Δ</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      <tr class="row--spacer"><td colspan="${3 + recentMonths.length}"></td></tr>
      <tr style="background:${BRAND.bgMid}">
        <td style="font-size:7.5pt;color:${BRAND.textMuted};padding-left:9pt;font-style:italic">Gross Margin %</td>
        ${gmRow}
        <td class="num" style="color:${BRAND.textMuted}">${fmtPercent(ytdGm)}</td>
        <td class="num">—</td>
      </tr>
      <tr style="background:${BRAND.bgMid}">
        <td style="font-size:7.5pt;color:${ytdNmColor};padding-left:9pt;font-style:italic">Net Margin %</td>
        ${nmRow}
        <td class="num" style="color:${ytdNmColor}">${fmtPercent(ytdNm)}</td>
        <td class="num">—</td>
      </tr>
    </tbody>
  </table>
  ${pl.length === 0 ? emptyState("Monthly P&L data not available for this period.") : ""}
</div>`;
}

// ─── Section 4: Balance Sheet ─────────────────────────────────────────────────

function renderBalanceSheet(report: BuiltReport): string {
  const financialsMap = asFinancialsMap(report.sections["financials"]);
  const entries = Object.entries(financialsMap);
  if (entries.length === 0) return "";

  const blocks = entries.map(([slug, fin]) => renderEntityBS(report, slug as EntitySlug, fin)).join("");

  return `
<div class="section section--break" id="section-balance-sheet">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Balance Sheet", { number: 4, bgColor: BRAND.sectionBS, accentColor: "#818cf8" })}
  ${blocks}
</div>`;
}

function renderEntityBS(report: BuiltReport, slug: EntitySlug, fin: FinancialsData): string {
  if (!fin) return "";
  const bs = fin.balance_sheet;
  const isSingle = report.branding.mode === "single";
  const def = entityDef(slug);
  const primaryColor = def?.primaryColor ?? BRAND.darkGreen;

  if (!bs) return `<p style="color:${BRAND.textMuted};font-style:italic;margin-bottom:12pt">Balance sheet not available for ${escHtml(slug)}.</p>`;

  const totalLiabEquity = (bs.liabilities?.total ?? 0) + (bs.equity?.total ?? 0);
  const diff = Math.abs((bs.assets?.total ?? 0) - totalLiabEquity);
  const balanced = diff < 0.02;

  function bsRow(label: string, value: number | null | undefined, type: "normal" | "indent" | "subtotal" | "total" | "section" = "normal"): string {
    const rowClass = type === "total" ? "row--total" : type === "subtotal" ? "row--subtotal" : type === "section" ? "row--section" : type === "indent" ? "row--indent" : "";
    const { html: valHtml } = amountCell(value);
    return `<tr class="${rowClass}"><td>${escHtml(label)}</td><td class="num">${valHtml}</td></tr>`;
  }

  const bsRows = [
    bsRow("ASSETS", undefined, "section"),
    bsRow("Cash & Cash Equivalents", bs.assets?.cash, "indent"),
    bsRow("Accounts Receivable", bs.assets?.accounts_receivable, "indent"),
    bsRow("Prepaid Expenses", bs.assets?.prepaid_expenses, "indent"),
    bsRow("Equipment (Net)", bs.assets?.equipment_net, "indent"),
    bsRow("Total Assets", bs.assets?.total, "subtotal"),
    bsRow("", undefined, "section"),
    bsRow("LIABILITIES", undefined, "section"),
    bsRow("Accounts Payable", bs.liabilities?.accounts_payable, "indent"),
    bsRow("Accrued Liabilities", bs.liabilities?.accrued_liabilities, "indent"),
    bsRow("Deferred Revenue", bs.liabilities?.deferred_revenue, "indent"),
    bsRow("Notes Payable", bs.liabilities?.notes_payable, "indent"),
    bsRow("Total Liabilities", bs.liabilities?.total, "subtotal"),
    bsRow("EQUITY", undefined, "section"),
    bsRow("Paid-In Capital", bs.equity?.paid_in_capital, "indent"),
    bsRow("Retained Earnings", bs.equity?.retained_earnings, "indent"),
    bsRow("Total Equity", bs.equity?.total, "subtotal"),
    bsRow("Total Liabilities & Equity", totalLiabEquity, "total"),
  ].join("");

  // Asset composition donut
  const assetSegments = [
    { label: "Cash", value: bs.assets?.cash ?? 0, color: primaryColor },
    { label: "AR", value: bs.assets?.accounts_receivable ?? 0, color: "#60a5fa" },
    { label: "Prepaid", value: bs.assets?.prepaid_expenses ?? 0, color: "#a78bfa" },
    { label: "Equipment", value: bs.assets?.equipment_net ?? 0, color: "#34d399" },
  ].filter((s) => s.value > 0);

  const totalAssetsCompact = fmtCurrency(bs.assets?.total, { compact: true });
  const donutChart = svgDonut(assetSegments, { size: 110, centerLabel: totalAssetsCompact, centerSub: "Total Assets" });

  const entityLabel = isSingle
    ? ""
    : `<div style="display:flex;align-items:center;gap:8pt;margin-bottom:8pt">
        ${logoImg(def?.logo ?? null, fin.entity_slug, primaryColor, { height: "18pt" })}
        <span style="font-size:10pt;font-weight:700;color:${BRAND.textSecondary}">${escHtml(fin.entity_slug)}</span>
      </div>`;

  const balanceCheckHtml = balanced
    ? `<div class="status-block status-block--pass" style="margin-top:8pt"><span class="status-block__icon">✓</span><div><div class="status-block__title">Balance Sheet Balanced</div><div class="status-block__sub">Assets = Liabilities + Equity</div></div></div>`
    : `<div class="status-block status-block--fail" style="margin-top:8pt"><span class="status-block__icon">⚠</span><div><div class="status-block__title">Out-of-Balance by ${fmtCurrency(diff)}</div><div class="status-block__sub">Review source data</div></div></div>`;

  return `
<div style="margin-bottom:16pt;page-break-inside:avoid">
  ${entityLabel}
  <p style="font-size:8pt;color:${BRAND.textMuted};margin-bottom:8pt">As of ${escHtml(fmtDate(bs.as_of))}</p>
  <div class="col-60-40">
    <table class="fin-table">
      <thead><tr><th>Line Item</th><th class="num">Amount</th></tr></thead>
      <tbody>${bsRows}</tbody>
    </table>
    <div>
      <div class="chart-box" style="text-align:center">
        <div class="chart-box__title">Asset Composition</div>
        ${donutChart}
        <div style="margin-top:8pt">
          ${legendItems(assetSegments.map((s) => ({ label: s.label, color: s.color })))}
        </div>
      </div>
      ${balanceCheckHtml}
    </div>
  </div>
</div>`;
}

// ─── Section 5: Cash Flow ─────────────────────────────────────────────────────

function renderCashFlow(report: BuiltReport): string {
  const financialsMap = asFinancialsMap(report.sections["financials"]);
  const entries = Object.entries(financialsMap);
  if (entries.length === 0) return "";

  const blocks = entries.map(([slug, fin]) => renderEntityCF(report, slug as EntitySlug, fin)).join("");

  return `
<div class="section section--break" id="section-cash-flow">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Cash Flow Statement", { number: 5, bgColor: BRAND.sectionCF, accentColor: "#2dd4bf" })}
  <p style="font-size:8pt;color:${BRAND.textMuted};margin-bottom:12pt">
    Cash flow data sourced from RC-016 validated and published statements only
    (validation_status = 'passed', publication_status = 'published').
    Entities without a published statement display an explanatory notice.
  </p>
  ${blocks}
</div>`;
}

function renderEntityCF(report: BuiltReport, slug: EntitySlug, fin: FinancialsData): string {
  if (!fin) return "";
  const cf: CashFlowStatement | null = fin.cash_flow;
  const isSingle = report.branding.mode === "single";
  const def = entityDef(slug);
  const primaryColor = def?.primaryColor ?? BRAND.darkGreen;

  const entityLabel = isSingle ? ""
    : `<div style="display:flex;align-items:center;gap:8pt;margin-bottom:8pt">
        ${logoImg(def?.logo ?? null, slug, primaryColor, { height: "18pt" })}
        <span style="font-size:10pt;font-weight:700;color:${BRAND.textSecondary}">${escHtml(slug)}</span>
      </div>`;

  if (!cf) {
    return `
<div style="margin-bottom:12pt">
  ${entityLabel}
  ${insight("Cash Flow Statement Unavailable", "No published cash flow statement is available for this entity. A statement is published only after all 14 RC-016 validation checks pass. Check the Data Integrity section for details.", "neutral")}
</div>`;
  }

  const operatingSection = cf.sections.find((s) => s.name.toLowerCase().includes("operat"));
  const investingSection = cf.sections.find((s) => s.name.toLowerCase().includes("invest"));
  const financingSection = cf.sections.find((s) => s.name.toLowerCase().includes("financ"));

  function cfRow(label: string, value: number | null | undefined, type: "normal" | "indent" | "subtotal" | "total" | "section" = "normal", isCost = false): string {
    const rowClass = type === "total" ? "row--total" : type === "subtotal" ? "row--subtotal" : type === "section" ? "row--section" : type === "indent" ? "row--indent" : "";
    const { html: valHtml } = amountCell(value, isCost);
    return `<tr class="${rowClass}"><td>${escHtml(label)}</td><td class="num">${valHtml}</td></tr>`;
  }

  function sectionRows(sec: typeof operatingSection): string {
    if (!sec) return "";
    const detail = (sec.lines ?? [])
      .filter((l) => !l.is_subtotal)
      .map((l) => cfRow(l.label ?? "", l.amount, "indent"))
      .join("");
    return `
      ${cfRow(sec.name, undefined, "section")}
      ${detail}
      ${cfRow(`Net Cash from ${sec.name}`, sec.net_cash, "subtotal")}`;
  }

  // Beginning cash — look in first section lines
  const beginningAmount = cf.sections[0]?.lines?.find((l) => l.label?.toLowerCase().includes("beginning"))?.amount ?? null;

  const rows = `
    ${cfRow("Beginning Cash Balance", beginningAmount)}
    ${sectionRows(operatingSection)}
    ${sectionRows(investingSection)}
    ${sectionRows(financingSection)}
    ${cfRow("Net Change in Cash", cf.net_cash_change, "subtotal")}
    ${cfRow("Ending Cash Balance", cf.cash_at_end, "total")}`;

  // Waterfall chart data
  const waterfallBars: { label: string; value: number; isTotal?: boolean; color?: string }[] = [];
  if (beginningAmount != null) waterfallBars.push({ label: "Begin", value: beginningAmount, isTotal: true, color: BRAND.darkGreen });
  if (operatingSection?.net_cash != null) waterfallBars.push({ label: "Ops", value: operatingSection.net_cash });
  if (investingSection?.net_cash != null) waterfallBars.push({ label: "Invest", value: investingSection.net_cash });
  if (financingSection?.net_cash != null) waterfallBars.push({ label: "Finance", value: financingSection.net_cash });
  if (cf.cash_at_end != null) waterfallBars.push({ label: "End", value: cf.cash_at_end, isTotal: true, color: BRAND.darkGreen });

  const waterfallSvg = waterfallBars.length >= 2
    ? `<div class="chart-box">
        <div class="chart-box__title">Cash Flow Waterfall</div>
        ${svgWaterfallChart(waterfallBars, { width: 340, height: 130 })}
      </div>`
    : "";

  // Reconciliation indicator
  const expectedEnd = (beginningAmount ?? 0) + (cf.net_cash_change ?? 0);
  const reconciliationOk = cf.cash_at_end !== null && Math.abs(expectedEnd - (cf.cash_at_end ?? 0)) < 0.02;

  return `
<div style="margin-bottom:16pt;page-break-inside:avoid">
  ${entityLabel}
  <p style="font-size:8pt;color:${BRAND.textMuted};margin-bottom:8pt">As of ${escHtml(fmtDate(cf.as_of))}</p>
  <div class="col-55-45">
    <table class="fin-table">
      <thead><tr><th>Activity</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div>
      ${waterfallSvg}
      <div class="status-block ${reconciliationOk ? "status-block--pass" : "status-block--warn"}" style="margin-top:0">
        <span class="status-block__icon">${reconciliationOk ? "✓" : "⚠"}</span>
        <div>
          <div class="status-block__title">${reconciliationOk ? "Reconciliation Check Passed" : "Reconciliation Warning"}</div>
          <div class="status-block__sub">Begin + Net Change = Ending Cash</div>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

// ─── Section 6: AR & AP ───────────────────────────────────────────────────────

function renderArAp(report: BuiltReport): string {
  const arapMap = asArAp(report.sections["ar_ap"]);
  const entityMap = asEntityMap(report.sections["entity_summary"]);
  const entries = Object.entries(arapMap);

  const hasRealData = entries.some(([, v]) => v.customers || v.vendors);

  return `
<div class="section section--break" id="section-ar-ap">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Accounts Receivable & Payable", { number: 6, bgColor: BRAND.sectionARAP, accentColor: "#c084fc" })}
  ${hasRealData
    ? entries.map(([slug, data]) => renderEntityArAp(report, slug as EntitySlug, data)).join("")
    : renderArApFromMetrics(report, entityMap)}
</div>`;
}

function renderArApFromMetrics(
  report: BuiltReport,
  entityMap: Record<string, EntityEntry>,
): string {
  const entries = Object.entries(entityMap).filter(([, v]) => v.metrics);
  if (entries.length === 0) return emptyState("No AR/AP data available.");

  const freshnessData = asValidation(report.sections["validation"])?.freshness;

  // Summary cards
  const cards = entries.map(([slug, { metrics: m }]) => {
    const def = entityDef(slug);
    const primaryColor = def?.primaryColor ?? BRAND.darkGreen;
    const arOvColor = m.ar_overdue_pct >= 80 ? BRAND.negative : m.ar_overdue_pct >= 40 ? BRAND.warning : BRAND.positive;

    const { html: arHtml } = amountCell(m.open_ar);
    const { html: apHtml } = amountCell(m.open_ap);
    const { html: cashHtml } = amountCell(m.cash_on_hand);

    return `
<div class="scorecard no-break" style="margin-bottom:12pt">
  <div class="scorecard__header" style="background:${escHtml(primaryColor)}">
    ${logoImg(def?.logo ?? null, m.entity, primaryColor, { height: "28pt" })}
    <div>
      <div class="scorecard__name">${escHtml(m.entity)}</div>
      <div class="scorecard__sub">Working Capital Summary &middot; ${escHtml(m.basis)} Basis</div>
    </div>
  </div>
  <div class="scorecard__body">
    <div class="kpi-grid kpi-grid--4 mb-8">
      ${kpiCard("Open AR", arHtml, { variant: "default" })}
      ${kpiCard("AR Overdue %", `<span style="color:${arOvColor};font-weight:700">${fmtPercent(m.ar_overdue_pct)}</span>`, { variant: m.ar_overdue_pct >= 80 ? "negative" : m.ar_overdue_pct >= 40 ? "warning" : "default" })}
      ${kpiCard("DSO", m.dso_days != null ? `${m.dso_days.toFixed(0)} days` : "—")}
      ${kpiCard("Open AP", apHtml)}
    </div>
    <div class="col-55-45">
      <div class="chart-box">
        <div class="chart-box__title">Working Capital Breakdown</div>
        ${barRow("Open AR", m.open_ar, Math.max(Math.abs(m.open_ar ?? 0), Math.abs(m.open_ap ?? 0), Math.abs(m.cash_on_hand ?? 0), 1), fmtCurrency(m.open_ar, { compact: true }), "#60a5fa")}
        ${barRow("Open AP", m.open_ap, Math.max(Math.abs(m.open_ar ?? 0), Math.abs(m.open_ap ?? 0), Math.abs(m.cash_on_hand ?? 0), 1), fmtCurrency(m.open_ap, { compact: true }), BRAND.warning)}
        ${barRow("Cash on Hand", m.cash_on_hand, Math.max(Math.abs(m.open_ar ?? 0), Math.abs(m.open_ap ?? 0), Math.abs(m.cash_on_hand ?? 0), 1), fmtCurrency(m.cash_on_hand, { compact: true }), primaryColor)}
      </div>
      <div>
        ${m.ar_overdue_pct >= 50
          ? insight("High AR Overdue", `${fmtPercent(m.ar_overdue_pct)} of AR is overdue. Priority collection action recommended.`, "warning")
          : insight("AR Status", `${fmtPercent(m.ar_overdue_pct)} of AR is overdue.`, m.ar_overdue_pct < 20 ? "positive" : "neutral")}
        ${(m.cash_on_hand ?? 0) < 0 ? insight("Cash Deficit", `Cash position is negative at ${fmtCurrency(m.cash_on_hand, { showParens: true })}.`, "critical") : ""}
      </div>
    </div>
  </div>
</div>`;
  }).join("");

  return `
  ${cards}
  ${dataFooter([`Sourced from QBO semantic layer`, `As of ${freshnessData?.data_as_of ? fmtDate(freshnessData.data_as_of) : "—"}`, "FinanceOS — Confidential"])}`;
}

function renderEntityArAp(
  report: BuiltReport,
  slug: EntitySlug,
  data: { customers?: CustomersData; vendors?: VendorsData },
): string {
  const cust = data.customers;
  const vend = data.vendors;
  const def = entityDef(slug);
  const primaryColor = def?.primaryColor ?? BRAND.darkGreen;
  const isSingle = report.branding.mode === "single";

  const label = isSingle ? ""
    : `<div style="display:flex;align-items:center;gap:8pt;margin-bottom:8pt">
        ${logoImg(def?.logo ?? null, slug, primaryColor, { height: "18pt" })}
        <strong>${escHtml(slug)}</strong>
      </div>`;

  let arSection = "";
  if (cust) {
    const agingColors = ["#16a34a", "#f59e0b", "#f97316", "#b91c1c"];
    const buckets = (cust.aging ?? []).map((b, i) => ({
      label: b.label ?? b.days,
      amount: b.amount ?? 0,
      color: agingColors[Math.min(i, agingColors.length - 1)] ?? "#94a3b8",
    }));
    const agingBar = agingBars(buckets);
    const agingRows = buckets.map((b) =>
      `<tr><td>${escHtml(b.label)}</td><td class="num">${fmtCurrency(b.amount)}</td><td class="num">${fmtPercent((b.amount / Math.max(cust.open_ar ?? 1, 1)) * 100)}</td></tr>`
    ).join("");

    const topCustomers = (cust.top_customers ?? []).slice(0, 5).map((c) =>
      `<tr><td>${escHtml(c.name)}</td><td class="num">${fmtCurrency(c.balance)}</td><td class="num">${c.dso_days.toFixed(0)}d</td><td>${badge(c.status, c.status === "current" ? "green" : "red")}</td></tr>`
    ).join("");

    arSection = `
<div class="chart-box mb-12">
  <div class="chart-box__title">Accounts Receivable — As of ${escHtml(fmtDate(cust.as_of))}</div>
  <div class="kpi-grid kpi-grid--4 mb-8">
    ${kpiCard("Open AR", fmtCurrency(cust.open_ar))}
    ${kpiCard("Overdue Amount", fmtCurrency(cust.ar_overdue), { variant: (cust.ar_overdue_pct ?? 0) >= 60 ? "negative" : "default" })}
    ${kpiCard("Overdue %", fmtPercent(cust.ar_overdue_pct), { variant: (cust.ar_overdue_pct ?? 0) >= 60 ? "negative" : "default" })}
    ${kpiCard("DSO", cust.dso_history ? `${(cust.dso_history[cust.dso_history.length - 1] ?? 0).toFixed(0)}d` : "—")}
  </div>
  <div class="two-col">
    <div>
      <div style="font-size:7.5pt;font-weight:700;color:${BRAND.textSecondary};margin-bottom:6pt">AR Aging Distribution</div>
      ${agingBar}
      ${legendItems(buckets.map((b) => ({ label: b.label, color: b.color })))}
      ${agingRows ? `<table class="fin-table mt-8"><thead><tr><th>Bucket</th><th class="num">Amount</th><th class="num">% of AR</th></tr></thead><tbody>${agingRows}</tbody></table>` : ""}
    </div>
    ${topCustomers ? `<div><div style="font-size:7.5pt;font-weight:700;color:${BRAND.textSecondary};margin-bottom:6pt">Top Outstanding Balances</div><table class="fin-table"><thead><tr><th>Customer</th><th class="num">Balance</th><th class="num">DSO</th><th>Status</th></tr></thead><tbody>${topCustomers}</tbody></table></div>` : ""}
  </div>
</div>`;
  }

  let apSection = "";
  if (vend) {
    const apAgingColors = ["#16a34a", "#f59e0b", "#f97316", "#b91c1c"];
    const apBuckets = (vend.aging ?? []).map((b, i) => ({
      label: b.label ?? b.days,
      amount: b.amount ?? 0,
      color: apAgingColors[Math.min(i, apAgingColors.length - 1)] ?? "#94a3b8",
    }));
    const apAgingBar = agingBars(apBuckets);
    const apAgingRows = apBuckets.map((b) =>
      `<tr><td>${escHtml(b.label)}</td><td class="num">${fmtCurrency(b.amount)}</td></tr>`
    ).join("");

    apSection = `
<div class="chart-box">
  <div class="chart-box__title">Accounts Payable — As of ${escHtml(fmtDate(vend.as_of))}</div>
  <div class="kpi-grid kpi-grid--3 mb-8">
    ${kpiCard("Open AP", fmtCurrency(vend.open_ap))}
  </div>
  ${apAgingBar}
  ${apAgingRows ? `<table class="fin-table mt-8"><thead><tr><th>Bucket</th><th class="num">Amount</th></tr></thead><tbody>${apAgingRows}</tbody></table>` : ""}
</div>`;
  }

  return `<div style="margin-bottom:12pt">${label}${arSection}${apSection}</div>`;
}

// ─── Section 7: Alerts & Action Plan ─────────────────────────────────────────

function renderAlerts(report: BuiltReport): string {
  const alerts = asAlerts(report.sections["alerts"]);
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...alerts].sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  const critCount = alerts.filter((a) => a.severity === "critical").length;
  const highCount = alerts.filter((a) => a.severity === "high").length;
  const medCount  = alerts.filter((a) => a.severity === "medium").length;
  const lowCount  = alerts.filter((a) => a.severity === "low").length;

  if (alerts.length === 0) {
    return `
<div class="section section--break" id="section-alerts">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Alerts & Action Plan", { number: 7, bgColor: BRAND.sectionAlerts, accentColor: "#fb923c" })}
  ${insight("No Active Alerts", "All monitored metrics are within acceptable thresholds for this reporting period.", "positive")}
</div>`;
  }

  const alertCards = sorted.map((a) => {
    const sevColor = a.severity === "critical" ? "red" : a.severity === "high" ? "amber" : a.severity === "medium" ? "amber" : "gray";
    const sevBadge = badge(a.severity.toUpperCase(), sevColor as "red" | "amber" | "gray");
    const action = (a as Record<string, unknown>)["recommended_action"] as string | undefined
      || (a as Record<string, unknown>)["action"] as string | undefined;
    const impact  = (a as Record<string, unknown>)["financial_impact"] as string | undefined;
    const owner   = (a as Record<string, unknown>)["owner"] as string | undefined;
    const dueDate = (a as Record<string, unknown>)["due_date"] as string | undefined;

    const entityDef_ = ENTITY_DEFINITIONS.find((e) => e.displayName === a.entity || e.slug === a.entity);
    const logoSrc = embedLogoPath(entityDef_?.logo ?? null);
    const logoEl = logoSrc
      ? `<img src="${logoSrc}" alt="${escHtml(a.entity)}" style="height:14pt;width:auto;max-width:30pt;object-fit:contain;display:inline-block;vertical-align:middle" />`
      : "";

    return `
<div class="alert-card alert-card--${a.severity}">
  <div class="alert-card__severity">${sevBadge}</div>
  <div class="alert-card__body">
    <div class="alert-card__entity">${logoEl} ${escHtml(a.entity)}</div>
    <div class="alert-card__title">${escHtml(a.title)}</div>
    <div class="alert-card__desc">${escHtml(a.description)}</div>
    ${impact ? `<div class="alert-card__meta">Financial Impact: <strong>${escHtml(impact)}</strong></div>` : ""}
    ${action ? `<div class="alert-card__action">→ ${escHtml(action)}</div>` : ""}
    ${owner || dueDate ? `<div class="alert-card__meta" style="margin-top:4pt">${owner ? `Owner: ${escHtml(owner)}` : ""}${owner && dueDate ? " &middot; " : ""}${dueDate ? `Due: ${escHtml(fmtDate(dueDate))}` : ""}</div>` : ""}
  </div>
</div>`;
  }).join("");

  return `
<div class="section section--break" id="section-alerts">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Alerts & Action Plan", { number: 7, bgColor: BRAND.sectionAlerts, accentColor: "#fb923c" })}

  <div class="kpi-grid kpi-grid--4 mb-12">
    ${kpiCard("Total Alerts", String(alerts.length))}
    ${kpiCard("Critical", String(critCount), { variant: critCount > 0 ? "negative" : "default" })}
    ${kpiCard("High / Medium", String(highCount + medCount), { variant: highCount > 0 ? "warning" : "default" })}
    ${kpiCard("Low / Info", String(lowCount))}
  </div>

  ${alertCards}
</div>`;
}

// ─── Section 8: Data Integrity ────────────────────────────────────────────────

function renderDataIntegrity(report: BuiltReport): string {
  const { summary, freshness } = asValidation(report.sections["validation"]);
  const norm = normalizeValidationSummary(summary);

  const dataAsOf = freshness?.data_as_of ? fmtDate(freshness.data_as_of) : "—";
  const pipelineRun = (freshness as Record<string, unknown> | undefined)?.pipeline_run as string | undefined;
  const pipelineRunFmt = pipelineRun ? fmtDate(pipelineRun) : "—";

  const totalChecks = norm?.totalChecks ?? 0;
  const passed = norm?.passed ?? 0;
  const failed = norm?.failed ?? 0;
  const allPassed = norm?.allPassed ?? false;

  const overallStatus = allPassed
    ? `<div class="status-block status-block--pass"><span class="status-block__icon">✓</span><div><div class="status-block__title">Close Complete — All Checks Passed</div><div class="status-block__sub">Published data meets all FinanceOS quality thresholds. Safe to distribute.</div></div></div>`
    : norm
    ? `<div class="status-block status-block--warn"><span class="status-block__icon">⚠</span><div><div class="status-block__title">Review Required — ${failed} Check${failed !== 1 ? "s" : ""} Failed</div><div class="status-block__sub">Review failed checks before distributing this report.</div></div></div>`
    : `<div class="status-block status-block--gray"><span class="status-block__icon">ℹ</span><div><div class="status-block__title">Validation Status Unknown</div><div class="status-block__sub">Validation results were not available at report generation time.</div></div></div>`;

  // Progress-bar style check visualization
  const passBar = totalChecks > 0
    ? `<div style="margin:10pt 0">
        <div style="font-size:7.5pt;color:${BRAND.textSecondary};margin-bottom:4pt">Validation Checks: ${passed}/${totalChecks} passed</div>
        <div style="height:8pt;background:${BRAND.bgMid};border-radius:4pt;overflow:hidden">
          <div style="width:${totalChecks > 0 ? ((passed / totalChecks) * 100).toFixed(1) : "0"}%;height:100%;background:${allPassed ? BRAND.positive : BRAND.warning};border-radius:4pt"></div>
        </div>
      </div>`
    : "";

  return `
<div class="section section--break" id="section-data-integrity">
  ${pageHeader(hdrOpts(report))}
  ${sectionBanner("Data Integrity & Close Status", { number: 8, bgColor: BRAND.sectionInteg, accentColor: "#64748b" })}

  ${overallStatus}
  ${passBar}

  <div class="kpi-grid kpi-grid--4 mb-12">
    ${kpiCard("Data As Of", dataAsOf)}
    ${kpiCard("Pipeline Run", pipelineRunFmt)}
    ${kpiCard("Checks Passed", totalChecks > 0 ? `${passed} / ${totalChecks}` : "—", { variant: allPassed ? "positive" : failed > 0 ? "warning" : "default" })}
    ${kpiCard("Entities Published", String(report.metadata.entityCount))}
  </div>

  <div class="two-col mb-12">
    <div>
      <div style="font-size:8.5pt;font-weight:700;color:${BRAND.textSecondary};margin-bottom:8pt">Source System Coverage</div>
      <div class="status-block status-block--pass" style="margin-bottom:6pt">
        <span class="status-block__icon">✓</span>
        <div><div class="status-block__title">QuickBooks Online</div><div class="status-block__sub">P&L, Balance Sheet, Cash Flow, AR/AP</div></div>
      </div>
      <div class="status-block status-block--pass" style="margin-bottom:6pt">
        <span class="status-block__icon">✓</span>
        <div><div class="status-block__title">FinanceOS Semantic Layer</div><div class="status-block__sub">RC-016 cash flow validation &middot; Entity snapshots</div></div>
      </div>
    </div>
    <div>
      <div style="font-size:8.5pt;font-weight:700;color:${BRAND.textSecondary};margin-bottom:8pt">Data Quality Notes</div>
      <div style="font-size:8pt;color:${BRAND.textSecondary};line-height:1.55">
        <p style="margin-bottom:6pt">Financial values are sourced from QuickBooks Online via the FinanceOS Core semantic layer and have not been manually adjusted.</p>
        <p style="margin-bottom:6pt">Cash flow statements use only rows where <code style="background:${BRAND.bgMid};padding:1pt 3pt;border-radius:2pt;font-size:7pt">validation_status = 'passed'</code> and <code style="background:${BRAND.bgMid};padding:1pt 3pt;border-radius:2pt;font-size:7pt">publication_status = 'published'</code>.</p>
        <p>Data source: <strong>${escHtml(report.source)}</strong></p>
      </div>
    </div>
  </div>

  ${dataFooter([`Generated ${fmtDate(report.generatedAt)}`, `Source: ${report.source}`, "FinanceOS — Confidential — Do not distribute without validation review"])}
</div>`;
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function renderMonthlyClose(report: BuiltReport): string {
  const isSingle = report.branding.mode === "single" && report.branding.primaryEntity;
  const primaryColor = isSingle ? (report.branding.primaryEntity?.primaryColor ?? BRAND.darkGreen) : BRAND.darkGreen;

  const sections = [
    renderCover(report),
    renderExecutiveOverview(report),
    renderEntityPerformance(report),
    renderProfitLoss(report),
    renderBalanceSheet(report),
    renderCashFlow(report),
    renderArAp(report),
    renderAlerts(report),
    renderDataIntegrity(report),
  ].join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(report.template.name)} — ${escHtml(report.period)}</title>
  ${buildBaseStyles(primaryColor)}
</head>
<body>
${sections}
</body>
</html>`;
}
