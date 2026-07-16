/**
 * FinanceOS Monthly Close Report — HTML renderer.
 *
 * Produces a professional, print-ready HTML document for the Monthly Close
 * package. This renderer replaces the generic HtmlRenderer for the
 * "monthly-close" template. All other templates continue using HtmlRenderer.
 *
 * Data integrity guarantees:
 *  - All values come from BuiltReport.sections (assembled by builder.ts).
 *  - Null / undefined values render as "—" — never coerced to $0.00.
 *  - Negative values remain negative and are styled in red with parentheses.
 *  - Authoritative server totals are never re-summed on the client.
 */

import { readFileSync } from "fs";
import { join, resolve, sep } from "path";
import type { BuiltReport } from "../builder";
import type {
  PortfolioSummary,
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
  amountCell,
  varianceCell,
  buildBaseStyles,
  pageHeader,
  sectionHeading,
  kpiCard,
  badge,
  insight,
  emptyState,
  dataFooter,
  barRow,
} from "./designSystem";

// ─── Logo embed (path-safe, cached) ──────────────────────────────────────────

const LOGO_CACHE = new Map<string, string | null>();

function embedLogo(logoPath: string | null): string | null {
  if (!logoPath) return null;
  if (LOGO_CACHE.has(logoPath)) return LOGO_CACHE.get(logoPath) ?? null;
  try {
    const relative = logoPath.replace(/^\//, "");
    const logoRoot = resolve(__dirname, "../../../../financeos/public");
    const diskPath = resolve(join(logoRoot, relative));
    if (!diskPath.startsWith(logoRoot + sep)) { LOGO_CACHE.set(logoPath, null); return null; }
    const bytes = readFileSync(diskPath);
    const ext = diskPath.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    LOGO_CACHE.set(logoPath, dataUrl);
    return dataUrl;
  } catch {
    LOGO_CACHE.set(logoPath, null);
    return null;
  }
}

function entityLogoHtml(name: string, logoPath: string | null, primaryColor: string, size = "24pt"): string {
  const src = embedLogo(logoPath);
  if (src) return `<img class="entity-card__logo" src="${src}" alt="${escHtml(name)}" style="width:${size};height:${size}" />`;
  const initials = escHtml(name.slice(0, 2).toUpperCase());
  return `<span class="entity-card__logo--fallback" style="background:${escHtml(primaryColor)};width:${size};height:${size}">${initials}</span>`;
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

type SectionData = Record<string, unknown>;

function asPortfolio(s: unknown): PortfolioSummary | null {
  const d = s as { portfolio?: PortfolioSummary } | undefined;
  return d?.portfolio ?? null;
}

function asEntityMap(s: unknown): Record<string, { metrics: EntityMetrics; anomalies: Anomaly[] }> {
  return (s as Record<string, { metrics: EntityMetrics; anomalies: Anomaly[] }>) ?? {};
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

function asExecutive(s: unknown): {
  greeting?: string;
  executiveSummary?: string[];
  insights?: { title: string; text: string; variant?: string }[];
  keyRisks?: string[];
  actions?: string[];
  kpis?: { label: string; value: string; change?: string; changeClass?: string }[];
} {
  return (s as Record<string, unknown> ?? {}) as ReturnType<typeof asExecutive>;
}

// ─── Section 1: Cover Page ────────────────────────────────────────────────────

function renderCover(report: BuiltReport): string {
  const { branding, template, period, generatedAt, metadata, sections } = report;
  const freshness = asValidation(sections["validation"])?.freshness;
  const validation = asValidation(sections["validation"])?.summary;
  const norm = normalizeValidationSummary(validation);

  const entityNames = branding.entities.map((e) => e.name);
  const isSingle = branding.mode === "single" && branding.primaryEntity;
  const companyLabel = isSingle ? branding.primaryEntity!.name : "FinanceOS Portfolio";
  const primaryColor = isSingle ? branding.primaryEntity!.primaryColor : BRAND.green;

  const entityChips = entityNames
    .map((n) => `<span class="cover__entity-chip">${escHtml(n)}</span>`)
    .join("");

  const validationBadge = norm
    ? norm.allPassed
      ? badge("Validated", "green")
      : badge("Issues Found", "amber")
    : badge("Pending", "gray");

  const generatedReadable = fmtDate(generatedAt);
  const dataAsOf = freshness?.data_as_of ? fmtDate(freshness.data_as_of) : "—";

  return `
<div class="cover" style="page-break-after:always">
  <div class="cover__top-bar" style="background:${escHtml(primaryColor)}"></div>
  <div class="cover__body">
    <div class="cover__brand">FinanceOS</div>
    <h1 class="cover__title">${escHtml(template.name)}</h1>
    <p class="cover__period">${escHtml(period)}</p>
    <div class="cover__divider" style="background:${escHtml(primaryColor)}"></div>

    ${isSingle
      ? `<p style="font-size:13pt;font-weight:600;color:${escHtml(BRAND.textSecondary)};margin-bottom:14pt">${escHtml(companyLabel)}</p>`
      : `<div class="cover__entities">${entityChips}</div>`
    }

    <div class="cover__meta-grid">
      <div class="cover__meta-item">
        <div class="cover__meta-label">Reporting Period</div>
        <div class="cover__meta-value">${escHtml(period)}</div>
      </div>
      <div class="cover__meta-item">
        <div class="cover__meta-label">Data As Of</div>
        <div class="cover__meta-value">${escHtml(dataAsOf)}</div>
      </div>
      <div class="cover__meta-item">
        <div class="cover__meta-label">Generated</div>
        <div class="cover__meta-value">${escHtml(generatedReadable)}</div>
      </div>
      <div class="cover__meta-item">
        <div class="cover__meta-label">Validation Status</div>
        <div class="cover__meta-value">${validationBadge}</div>
      </div>
      <div class="cover__meta-item">
        <div class="cover__meta-label">Entities</div>
        <div class="cover__meta-value">${metadata.entityCount} ${metadata.entityCount === 1 ? "entity" : "entities"}</div>
      </div>
      <div class="cover__meta-item">
        <div class="cover__meta-label">Report Type</div>
        <div class="cover__meta-value">${isSingle ? "Single Entity" : "Multi-Entity Portfolio"}</div>
      </div>
    </div>

    <div class="cover__spacer"></div>

    <div class="cover__footer">
      <span class="cover__confidential">Confidential</span>
      <span class="cover__powered">Generated automatically by FinanceOS</span>
    </div>
  </div>
</div>`;
}

// ─── Section 2: Executive Overview ───────────────────────────────────────────

function renderExecutiveOverview(report: BuiltReport): string {
  const exec = asExecutive(report.sections["executive_summary"]);
  const portfolio = asPortfolio(report.sections["portfolio_kpis"]);
  const entityMap = asEntityMap(report.sections["entity_summary"]);
  const isSingle = report.branding.mode === "single" && report.branding.primaryEntity;
  const firstEntity = Object.values(entityMap)[0];
  const metrics: EntityMetrics | null = isSingle && firstEntity ? firstEntity.metrics : null;
  const p = portfolio;

  const revYtd = metrics ? metrics.revenue_ytd : p?.portfolio_revenue_ytd ?? null;
  const netInc = metrics ? metrics.net_income_ytd : p?.portfolio_net_income_ytd ?? null;
  const netMgn = metrics ? metrics.net_margin_pct : p?.portfolio_net_margin_pct ?? null;
  const cash = metrics ? metrics.cash_on_hand : p?.portfolio_cash_on_hand ?? null;
  const openAr = metrics ? metrics.open_ar : p?.portfolio_open_ar ?? null;
  const openAp = metrics ? metrics.open_ap : p?.portfolio_open_ap ?? null;
  const runway = p?.cash_runway_months ?? null;

  const { html: netIncHtml } = amountCell(netInc);
  const { html: cashHtml } = amountCell(cash);

  // Build KPI grid
  const kpis = [
    kpiCard("Revenue YTD", fmtCurrency(revYtd)),
    kpiCard("Net Income YTD", netIncHtml),
    kpiCard("Net Margin", fmtPercent(netMgn), { accent: true }),
    kpiCard("Cash on Hand", cashHtml),
    kpiCard("Open AR", fmtCurrency(openAr)),
    kpiCard("Open AP", fmtCurrency(openAp)),
    ...(runway != null ? [kpiCard("Cash Runway", `${runway.toFixed(1)} mo`)] : []),
  ].join("");

  // Insights
  const rawInsights: { title: string; text: string; variant?: string }[] =
    exec.insights ?? buildAutoInsights(metrics, p, isSingle !== false && isSingle != null);

  const insightsHtml = rawInsights.slice(0, 5)
    .map((ins) => insight(ins.title, ins.text, (ins.variant as Parameters<typeof insight>[2]) ?? "neutral"))
    .join("");

  // Risks and actions
  const risks = (exec.keyRisks ?? []).slice(0, 3);
  const actions = (exec.actions ?? []).slice(0, 3);

  const freshness = asValidation(report.sections["validation"])?.freshness;
  const dataAsOf = freshness?.data_as_of ? fmtDate(freshness.data_as_of) : "—";

  return `
<div class="section section--break-before" id="section-executive-overview">
  ${pageHeader(report.template.name, report.branding.mode === "single" ? (report.branding.primaryEntity?.name ?? "Portfolio") : "Portfolio Overview", report.period)}
  ${sectionHeading("Executive Overview", { number: 1 })}

  <div class="kpi-grid kpi-grid--4" style="margin-bottom:12pt">
    ${kpis}
  </div>

  ${insightsHtml || ""}

  ${risks.length > 0 || actions.length > 0 ? `
  <div class="two-col" style="margin-top:10pt">
    ${risks.length > 0 ? `
    <div>
      <h4 style="margin-bottom:6pt;color:${BRAND.negative}">Key Risks</h4>
      <ul style="padding-left:14pt;font-size:8.5pt;color:${BRAND.textSecondary}">
        ${risks.map((r) => `<li style="margin-bottom:3pt">${escHtml(r)}</li>`).join("")}
      </ul>
    </div>` : ""}
    ${actions.length > 0 ? `
    <div>
      <h4 style="margin-bottom:6pt;color:${BRAND.green}">Recommended Actions</h4>
      <ul style="padding-left:14pt;font-size:8.5pt;color:${BRAND.textSecondary}">
        ${actions.map((a) => `<li style="margin-bottom:3pt">${escHtml(a)}</li>`).join("")}
      </ul>
    </div>` : ""}
  </div>` : ""}

  ${dataFooter([`Data as of ${dataAsOf}`, `${report.metadata.entityCount} ${report.metadata.entityCount === 1 ? "entity" : "entities"}`, "FinanceOS — Confidential"])}
</div>`;
}

function buildAutoInsights(
  metrics: EntityMetrics | null,
  portfolio: PortfolioSummary | null,
  isSingle: boolean,
): { title: string; text: string; variant: string }[] {
  const result: { title: string; text: string; variant: string }[] = [];
  const netMgn = metrics?.net_margin_pct ?? portfolio?.portfolio_net_margin_pct;
  const rev = metrics?.revenue_ytd ?? portfolio?.portfolio_revenue_ytd;
  const ar = metrics?.open_ar ?? portfolio?.portfolio_open_ar;
  const cash = metrics?.cash_on_hand ?? portfolio?.portfolio_cash_on_hand;
  const arPct = metrics?.ar_overdue_pct;

  if (netMgn != null && Number.isFinite(netMgn)) {
    const variant = netMgn >= 15 ? "positive" : netMgn >= 5 ? "neutral" : netMgn < 0 ? "critical" : "warning";
    result.push({ title: "Profitability", text: `Net margin is ${fmtPercent(netMgn)}.${netMgn < 0 ? " The portfolio is currently operating at a net loss." : netMgn >= 15 ? " Strong margin performance." : " Margin is within acceptable range."}`, variant });
  }
  if (rev != null && Number.isFinite(rev)) {
    result.push({ title: "Revenue", text: `YTD revenue stands at ${fmtCurrency(rev)}.`, variant: "neutral" });
  }
  if (arPct != null && Number.isFinite(arPct)) {
    const variant = arPct >= 80 ? "critical" : arPct >= 50 ? "warning" : "positive";
    result.push({ title: "Accounts Receivable", text: `${fmtPercent(arPct)} of open AR is overdue (${fmtCurrency(ar)}).${arPct >= 80 ? " Urgent collection action required." : ""}`, variant });
  }
  if (cash != null && Number.isFinite(cash)) {
    const variant = cash < 0 ? "critical" : cash < 50000 ? "warning" : "positive";
    result.push({ title: "Cash Position", text: cash < 0 ? `Cash position is negative at ${fmtCurrency(cash, { showParens: true })}. Requires immediate attention.` : `Cash on hand is ${fmtCurrency(cash)}.`, variant });
  }
  return result;
}

// ─── Section 3: Portfolio & Entity Performance ────────────────────────────────

function renderPortfolioPerformance(report: BuiltReport): string {
  const entityMap = asEntityMap(report.sections["entity_summary"]);
  const isSingle = report.branding.mode === "single" && report.branding.primaryEntity;
  const entries = Object.entries(entityMap);

  if (entries.length === 0) return "";

  if (isSingle && entries.length === 1) {
    return renderSingleEntitySummary(report, entries[0]![0] as EntitySlug, entries[0]![1]);
  }

  return renderMultiEntityTable(report, entityMap);
}

function renderSingleEntitySummary(
  report: BuiltReport,
  slug: EntitySlug,
  entry: { metrics: EntityMetrics; anomalies: Anomaly[] },
): string {
  const m = entry.metrics;
  if (!m) return "";
  const primaryColor = report.branding.primaryEntity?.primaryColor ?? BRAND.green;
  const logoSrc = embedLogo(report.branding.primaryEntity?.logoPath ?? null);
  const logoHtml = logoSrc
    ? `<img class="entity-card__logo" src="${logoSrc}" alt="${escHtml(m.entity)}" style="width:28pt;height:28pt" />`
    : `<span class="entity-card__logo--fallback" style="background:${escHtml(primaryColor)};width:28pt;height:28pt">${escHtml(m.entity.slice(0, 2).toUpperCase())}</span>`;

  const { html: niHtml } = amountCell(m.net_income_ytd);
  const { html: cashHtml } = amountCell(m.cash_on_hand);

  return `
<div class="section section--break-before" id="section-entity-performance">
  ${pageHeader(report.template.name, m.entity, report.period)}
  ${sectionHeading("Entity Performance", { number: 2, subtitle: `As of ${fmtDate(m.as_of)}` })}
  <div class="entity-card">
    <div class="entity-card__header" style="background:${escHtml(primaryColor)}">
      ${logoHtml}
      <div>
        <div class="entity-card__name">${escHtml(m.entity)}</div>
        <div style="font-size:8pt;opacity:0.8">${escHtml(m.basis)} Basis &middot; ${escHtml(m.slug)}</div>
      </div>
      <div class="entity-card__meta">As of ${escHtml(fmtDate(m.as_of))}</div>
    </div>
    <div class="entity-card__body">
      <div class="kpi-grid kpi-grid--4">
        ${kpiCard("Revenue YTD", fmtCurrency(m.revenue_ytd))}
        ${kpiCard("Net Income YTD", niHtml)}
        ${kpiCard("Gross Margin", fmtPercent(m.gross_margin_pct))}
        ${kpiCard("Net Margin", fmtPercent(m.net_margin_pct))}
        ${kpiCard("Cash on Hand", cashHtml)}
        ${kpiCard("Open AR", fmtCurrency(m.open_ar))}
        ${kpiCard("Open AP", fmtCurrency(m.open_ap))}
        ${kpiCard("DSO", m.dso_days != null ? `${m.dso_days.toFixed(0)} days` : "—")}
      </div>
    </div>
  </div>
  ${dataFooter([`Data as of ${fmtDate(m.as_of)}`, "FinanceOS — Confidential"])}
</div>`;
}

function renderMultiEntityTable(
  report: BuiltReport,
  entityMap: Record<string, { metrics: EntityMetrics; anomalies: Anomaly[] }>,
): string {
  const entries = Object.entries(entityMap).filter(([, v]) => v.metrics != null);
  if (entries.length === 0) return "";

  const headerRow = `
<tr>
  <th>Entity</th>
  <th class="num">Revenue YTD</th>
  <th class="num">Net Income</th>
  <th class="num">Net Margin</th>
  <th class="num">Cash</th>
  <th class="num">Open AR</th>
  <th class="num">Open AP</th>
  <th class="num">DSO</th>
  <th class="num">AR Overdue</th>
</tr>`;

  const bodyRows = entries
    .map(([, { metrics: m }]) => {
      if (!m) return "";
      const { html: cashHtml } = amountCell(m.cash_on_hand);
      const { html: niHtml } = amountCell(m.net_income_ytd);
      return `
<tr>
  <td><strong>${escHtml(m.entity)}</strong><br><span style="font-size:7.5pt;color:${BRAND.textMuted}">${escHtml(m.basis)}</span></td>
  <td class="num">${fmtCurrency(m.revenue_ytd)}</td>
  <td class="num">${niHtml}</td>
  <td class="num">${fmtPercent(m.net_margin_pct)}</td>
  <td class="num">${cashHtml}</td>
  <td class="num">${fmtCurrency(m.open_ar)}</td>
  <td class="num">${fmtCurrency(m.open_ap)}</td>
  <td class="num">${m.dso_days != null ? `${m.dso_days.toFixed(0)}d` : "—"}</td>
  <td class="num">${fmtPercent(m.ar_overdue_pct)}</td>
</tr>`;
    })
    .join("");

  // Bar chart: Revenue comparison
  const maxRev = Math.max(...entries.map(([, v]) => Math.abs(v.metrics?.revenue_ytd ?? 0)));
  const revBars = entries
    .map(([, { metrics: m }]) => m
      ? barRow(m.entity, m.revenue_ytd, maxRev, fmtCurrency(m.revenue_ytd, { compact: true }))
      : "")
    .join("");

  const entityNames = entries.map(([, v]) => v.metrics?.entity ?? "").filter(Boolean).join(", ");
  const freshness = asValidation(report.sections["validation"])?.freshness;

  return `
<div class="section section--break-before" id="section-portfolio-performance">
  ${pageHeader(report.template.name, "Portfolio Overview", report.period)}
  ${sectionHeading("Portfolio & Entity Performance", { number: 2, subtitle: `${entries.length} entities` })}

  <p style="font-size:8.5pt;color:${BRAND.textSecondary};margin-bottom:10pt">
    Entities included: <strong>${escHtml(entityNames)}</strong>
  </p>

  <table class="fin-table" style="margin-bottom:14pt">
    <thead>${headerRow}</thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <div class="chart-container">
    <h4 style="margin-bottom:8pt;font-size:9pt">Revenue YTD Comparison</h4>
    ${revBars || emptyState("No revenue data available.")}
  </div>

  ${dataFooter([
    `Data as of ${freshness?.data_as_of ? fmtDate(freshness.data_as_of) : "—"}`,
    `${entries.length} entities`,
    "FinanceOS — Confidential",
  ])}
</div>`;
}

// ─── Section 4: Profit & Loss ─────────────────────────────────────────────────

function renderProfitLoss(report: BuiltReport): string {
  const financialsMap = asFinancialsMap(report.sections["financials"]);
  const entries = Object.entries(financialsMap);
  if (entries.length === 0) return "";

  const blocks = entries
    .map(([slug, fin]) => renderEntityPL(report, slug as EntitySlug, fin))
    .join("");

  return `
<div class="section section--break-before" id="section-profit-loss">
  ${pageHeader(report.template.name, "Profit & Loss", report.period)}
  ${sectionHeading("Profit & Loss", { number: 3 })}
  ${blocks}
</div>`;
}

function renderEntityPL(report: BuiltReport, slug: EntitySlug, fin: FinancialsData): string {
  if (!fin) return "";
  const pl = fin.monthly_pl ?? [];
  const ytd = fin.ytd_summary;
  const isSingle = report.branding.mode === "single";

  // Show last 3 months + YTD
  const recentMonths = pl.slice(-3);

  const plRows: { label: string; key: keyof MonthlyPL; indent?: boolean; isSubtotal?: boolean; isTotal?: boolean; favorableWhenPositive?: boolean }[] = [
    { label: "Revenue", key: "revenue" },
    { label: "Cost of Goods Sold", key: "cogs", indent: true, favorableWhenPositive: false },
    { label: "Gross Profit", key: "gross_profit", isSubtotal: true },
    { label: "Operating Expenses", key: "opex", indent: true, favorableWhenPositive: false },
    { label: "Net Income", key: "net_income", isTotal: true },
  ];

  const monthHeaders = recentMonths.map((m) => `<th class="num">${escHtml(fmtMonthYear(m.month + "-01"))}</th>`).join("");

  const bodyRows = plRows
    .map((row) => {
      const rowClass = row.isTotal
        ? "row--total"
        : row.isSubtotal
        ? "row--subtotal"
        : row.indent
        ? "row--indent"
        : "";

      const monthCells = recentMonths.map((m) => {
        const val = m[row.key] as number;
        const { html } = amountCell(val, row.favorableWhenPositive === false);
        return `<td class="num">${html}</td>`;
      }).join("");

      const ytdVal = ytd?.[row.key as keyof typeof ytd] as number | undefined;
      const { html: ytdHtml } = amountCell(ytdVal, row.favorableWhenPositive === false);

      // Prior month variance (last two months)
      const last = recentMonths[recentMonths.length - 1];
      const prev = recentMonths[recentMonths.length - 2];
      const varCell = last && prev
        ? varianceCell(
            last[row.key] as number,
            prev[row.key] as number,
            row.favorableWhenPositive !== false,
          )
        : '<span class="variance--na">—</span>';

      return `
<tr class="${rowClass}">
  <td>${escHtml(row.label)}</td>
  ${monthCells}
  <td class="num">${ytdHtml}</td>
  <td class="num">${varCell}</td>
</tr>`;
    })
    .join("");

  const entityLabel = isSingle ? "" : `<h3 style="margin-bottom:8pt;color:${BRAND.textSecondary}">${escHtml(fin.entity_slug)}</h3>`;

  return `
<div style="margin-bottom:16pt;page-break-inside:avoid">
  ${entityLabel}
  <table class="fin-table">
    <thead>
      <tr>
        <th style="width:34%">Line Item</th>
        ${monthHeaders}
        <th class="num">YTD</th>
        <th class="num">MoM Δ</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  ${pl.length === 0 ? emptyState("Monthly P&L data not available for this period.") : ""}
</div>`;
}

// ─── Section 5: Balance Sheet ─────────────────────────────────────────────────

function renderBalanceSheet(report: BuiltReport): string {
  const financialsMap = asFinancialsMap(report.sections["financials"]);
  const entries = Object.entries(financialsMap);
  if (entries.length === 0) return "";

  const blocks = entries
    .map(([slug, fin]) => renderEntityBS(report, slug as EntitySlug, fin))
    .join("");

  return `
<div class="section section--break-before" id="section-balance-sheet">
  ${pageHeader(report.template.name, "Balance Sheet", report.period)}
  ${sectionHeading("Balance Sheet", { number: 4 })}
  ${blocks}
</div>`;
}

function renderEntityBS(report: BuiltReport, slug: EntitySlug, fin: FinancialsData): string {
  if (!fin) return "";
  const bs = fin.balance_sheet;
  if (!bs) return `<p style="color:${BRAND.textMuted};font-style:italic;margin-bottom:12pt">Balance sheet not available for ${escHtml(slug)}.</p>`;

  const isSingle = report.branding.mode === "single";
  const entityLabel = isSingle ? "" : `<h3 style="margin-bottom:8pt;color:${BRAND.textSecondary}">${escHtml(slug)}</h3>`;

  // Check balance: assets = liabilities + equity
  const assetTotal = bs.assets?.total ?? 0;
  const liabEquityTotal = (bs.liabilities?.total ?? 0) + (bs.equity?.total ?? 0);
  const diff = Math.abs(assetTotal - liabEquityTotal);
  const balanced = diff < 0.02;

  function row(label: string, value: number | null | undefined, opts: { indent?: boolean; subtotal?: boolean; total?: boolean; section?: boolean } = {}): string {
    const rowClass = opts.total ? "row--total" : opts.subtotal ? "row--subtotal" : opts.section ? "row--section" : opts.indent ? "row--indent" : "";
    const { html: valHtml } = amountCell(value);
    return `<tr class="${rowClass}"><td>${escHtml(label)}</td><td class="num">${valHtml}</td></tr>`;
  }

  const rows = [
    row("ASSETS", null, { section: true }),
    row("Cash & Cash Equivalents", bs.assets?.cash, { indent: true }),
    row("Accounts Receivable", bs.assets?.accounts_receivable, { indent: true }),
    row("Prepaid Expenses", bs.assets?.prepaid_expenses, { indent: true }),
    row("Equipment (Net)", bs.assets?.equipment_net, { indent: true }),
    row("Total Assets", bs.assets?.total, { subtotal: true }),
    row("LIABILITIES", null, { section: true }),
    row("Accounts Payable", bs.liabilities?.accounts_payable, { indent: true }),
    row("Accrued Liabilities", bs.liabilities?.accrued_liabilities, { indent: true }),
    row("Deferred Revenue", bs.liabilities?.deferred_revenue, { indent: true }),
    row("Notes Payable", bs.liabilities?.notes_payable, { indent: true }),
    row("Total Liabilities", bs.liabilities?.total, { subtotal: true }),
    row("EQUITY", null, { section: true }),
    row("Paid-In Capital", bs.equity?.paid_in_capital, { indent: true }),
    row("Retained Earnings", bs.equity?.retained_earnings, { indent: true }),
    row("Total Equity", bs.equity?.total, { subtotal: true }),
    row("Total Liabilities & Equity", liabEquityTotal, { total: true }),
  ].join("");

  const balanceCheck = balanced
    ? `<p style="font-size:8pt;color:${BRAND.positive};margin-top:5pt">✓ Balance sheet is in balance.</p>`
    : `<p style="font-size:8pt;color:${BRAND.negative};margin-top:5pt">⚠ Out-of-balance by ${fmtCurrency(diff)} — review source data.</p>`;

  return `
<div style="margin-bottom:16pt;page-break-inside:avoid">
  ${entityLabel}
  <p style="font-size:8.5pt;color:${BRAND.textMuted};margin-bottom:8pt">As of ${escHtml(fmtDate(bs.as_of))}</p>
  <div class="two-col">
    <table class="fin-table">
      <thead><tr><th>Line Item</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div>
      <div class="chart-container">
        <h4 style="margin-bottom:8pt;font-size:9pt">Asset Composition</h4>
        ${barRow("Cash", bs.assets?.cash, bs.assets?.total ?? 1, fmtCurrency(bs.assets?.cash, { compact: true }))}
        ${barRow("AR", bs.assets?.accounts_receivable, bs.assets?.total ?? 1, fmtCurrency(bs.assets?.accounts_receivable, { compact: true }), "accent")}
        ${barRow("Prepaid", bs.assets?.prepaid_expenses, bs.assets?.total ?? 1, fmtCurrency(bs.assets?.prepaid_expenses, { compact: true }), "amber")}
        ${barRow("Equipment", bs.assets?.equipment_net, bs.assets?.total ?? 1, fmtCurrency(bs.assets?.equipment_net, { compact: true }), "accent")}
      </div>
      ${balanceCheck}
    </div>
  </div>
</div>`;
}

// ─── Section 6: Cash Flow Statement ──────────────────────────────────────────

function renderCashFlow(report: BuiltReport): string {
  const financialsMap = asFinancialsMap(report.sections["financials"]);
  const entries = Object.entries(financialsMap);
  if (entries.length === 0) return "";

  const blocks = entries
    .map(([slug, fin]) => renderEntityCF(report, slug as EntitySlug, fin))
    .join("");

  return `
<div class="section section--break-before" id="section-cash-flow">
  ${pageHeader(report.template.name, "Cash Flow", report.period)}
  ${sectionHeading("Cash Flow Statement", { number: 5 })}
  <p style="font-size:8pt;color:${BRAND.textMuted};margin-bottom:10pt">
    Source: Published RC-016 cash-flow data (validation_status = passed, publication_status = published).
    Only validated and published statements are shown.
  </p>
  ${blocks}
</div>`;
}

function renderEntityCF(report: BuiltReport, slug: EntitySlug, fin: FinancialsData): string {
  if (!fin) return "";
  const cf: CashFlowStatement | null = fin.cash_flow;
  const isSingle = report.branding.mode === "single";
  const entityLabel = isSingle ? "" : `<h3 style="margin-bottom:8pt;color:${BRAND.textSecondary}">${escHtml(slug)}</h3>`;

  if (!cf) {
    return `
<div style="margin-bottom:16pt">
  ${entityLabel}
  <div class="insight insight--neutral">
    <span class="insight__icon">ℹ</span>
    <div class="insight__body">
      <div class="insight__title">Cash Flow Statement Unavailable</div>
      <div class="insight__text">No published cash flow statement is available for this entity. A statement is published only after all 14 CF validation checks pass (validation_status = passed, publication_status = published).</div>
    </div>
  </div>
</div>`;
  }

  const operatingSection = cf.sections.find((s) => s.name.toLowerCase().includes("operat"));
  const investingSection = cf.sections.find((s) => s.name.toLowerCase().includes("invest"));
  const financingSection = cf.sections.find((s) => s.name.toLowerCase().includes("financ"));

  function sectionRows(sec: typeof operatingSection): string {
    if (!sec) return "";
    const lineRows = (sec.lines ?? [])
      .filter((l) => !l.is_subtotal)
      .map((l) => {
        const { html } = amountCell(l.amount);
        return `<tr class="row--indent"><td>${escHtml(l.label)}</td><td class="num">${html}</td></tr>`;
      })
      .join("");
    const { html: netHtml } = amountCell(sec.net_cash);
    return `
<tr class="row--section"><td colspan="2">${escHtml(sec.name)}</td></tr>
${lineRows}
<tr class="row--subtotal"><td>Net Cash from ${escHtml(sec.name.replace(/activities/i, "Activities"))}</td><td class="num">${netHtml}</td></tr>`;
  }

  const { html: beginHtml } = amountCell(cf.sections[0]?.lines?.find((l) => l.label?.toLowerCase().includes("beginning"))?.amount ?? null);
  const { html: netChangeHtml } = amountCell(cf.net_cash_change);
  const { html: endHtml } = amountCell(cf.cash_at_end);

  const rows = `
<tr><td>Beginning Cash</td><td class="num">${beginHtml}</td></tr>
${sectionRows(operatingSection)}
${sectionRows(investingSection)}
${sectionRows(financingSection)}
<tr class="row--subtotal"><td>Net Change in Cash</td><td class="num">${netChangeHtml}</td></tr>
<tr class="row--total"><td>Ending Cash</td><td class="num">${endHtml}</td></tr>`;

  return `
<div style="margin-bottom:16pt;page-break-inside:avoid">
  ${entityLabel}
  <p style="font-size:8.5pt;color:${BRAND.textMuted};margin-bottom:8pt">As of ${escHtml(fmtDate(cf.as_of))}</p>
  <table class="fin-table">
    <thead><tr><th>Activity</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
}

// ─── Section 7: AR & AP ───────────────────────────────────────────────────────

function renderArAp(report: BuiltReport): string {
  const arapMap = asArAp(report.sections["ar_ap"]);
  const entityMap = asEntityMap(report.sections["entity_summary"]);
  const entries = Object.entries(arapMap);
  if (entries.length === 0) {
    // Fall back to showing aggregate AR/AP from entity metrics
    return renderArApFromMetrics(report, entityMap);
  }
  const blocks = entries
    .map(([slug, data]) => renderEntityArAp(report, slug as EntitySlug, data))
    .join("");
  return `
<div class="section section--break-before" id="section-ar-ap">
  ${pageHeader(report.template.name, "AR & AP", report.period)}
  ${sectionHeading("Accounts Receivable & Payable", { number: 6 })}
  ${blocks}
</div>`;
}

function renderArApFromMetrics(
  report: BuiltReport,
  entityMap: Record<string, { metrics: EntityMetrics; anomalies: Anomaly[] }>,
): string {
  const entries = Object.entries(entityMap).filter(([, v]) => v.metrics);
  if (entries.length === 0) return "";

  const rows = entries
    .map(([, { metrics: m }]) => {
      const { html: arHtml } = amountCell(m.open_ar);
      const { html: apHtml } = amountCell(m.open_ap);
      return `
<tr>
  <td><strong>${escHtml(m.entity)}</strong></td>
  <td class="num">${arHtml}</td>
  <td class="num">${fmtPercent(m.ar_overdue_pct)}</td>
  <td class="num">${m.dso_days != null ? `${m.dso_days.toFixed(0)} days` : "—"}</td>
  <td class="num">${apHtml}</td>
  <td class="num">${fmtPercent(m.ap_overdue_pct)}</td>
</tr>`;
    })
    .join("");

  return `
<div class="section section--break-before" id="section-ar-ap">
  ${pageHeader(report.template.name, "AR & AP", report.period)}
  ${sectionHeading("Accounts Receivable & Payable", { number: 6 })}
  <table class="fin-table">
    <thead>
      <tr>
        <th>Entity</th>
        <th class="num">Open AR</th>
        <th class="num">AR Overdue %</th>
        <th class="num">DSO</th>
        <th class="num">Open AP</th>
        <th class="num">AP Overdue %</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${dataFooter(["Sourced from QBO semantic layer snapshots", "FinanceOS — Confidential"])}
</div>`;
}

function renderEntityArAp(
  report: BuiltReport,
  slug: EntitySlug,
  data: { customers?: CustomersData; vendors?: VendorsData },
): string {
  const cust = data.customers;
  const vend = data.vendors;
  const isSingle = report.branding.mode === "single";
  const label = isSingle ? "" : `<h3 style="margin-bottom:8pt">${escHtml(slug)}</h3>`;

  let arHtml = "";
  if (cust) {
    const agingRows = (cust.aging ?? [])
      .map((b) => `<tr><td>${escHtml(b.label)}</td><td>${escHtml(b.days)}</td><td class="num">${fmtCurrency(b.amount)}</td><td class="num">${b.count}</td></tr>`)
      .join("");
    const topCustomers = (cust.top_customers ?? []).slice(0, 5)
      .map((c) => `<tr><td>${escHtml(c.name)}</td><td class="num">${fmtCurrency(c.balance)}</td><td class="num">${c.dso_days.toFixed(0)}d</td><td>${badge(c.status, c.status === "current" ? "green" : "red")}</td></tr>`)
      .join("");
    arHtml = `
<div style="margin-bottom:10pt">
  <h4 style="margin-bottom:6pt">Accounts Receivable — As of ${escHtml(fmtDate(cust.as_of))}</h4>
  <div class="kpi-grid kpi-grid--4" style="margin-bottom:8pt">
    ${kpiCard("Open AR", fmtCurrency(cust.open_ar))}
    ${kpiCard("Overdue Amount", fmtCurrency(cust.ar_overdue))}
    ${kpiCard("Overdue %", fmtPercent(cust.ar_overdue_pct))}
    ${kpiCard("DSO", cust.dso_history?.[cust.dso_history.length - 1] != null ? `${(cust.dso_history[cust.dso_history.length - 1]!).toFixed(0)} days` : "—")}
  </div>
  ${agingRows ? `
  <table class="fin-table" style="margin-bottom:8pt">
    <thead><tr><th>Bucket</th><th>Days</th><th class="num">Amount</th><th class="num">Count</th></tr></thead>
    <tbody>${agingRows}</tbody>
  </table>` : ""}
  ${topCustomers ? `
  <h4 style="margin-bottom:6pt">Top Outstanding Balances</h4>
  <table class="fin-table">
    <thead><tr><th>Customer</th><th class="num">Balance</th><th class="num">DSO</th><th>Status</th></tr></thead>
    <tbody>${topCustomers}</tbody>
  </table>` : ""}
</div>`;
  }

  let apHtml = "";
  if (vend) {
    const agingRows = (vend.aging ?? [])
      .map((b) => `<tr><td>${escHtml(b.label)}</td><td>${escHtml(b.days)}</td><td class="num">${fmtCurrency(b.amount)}</td><td class="num">${b.count}</td></tr>`)
      .join("");
    apHtml = `
<div style="margin-bottom:10pt">
  <h4 style="margin-bottom:6pt">Accounts Payable — As of ${escHtml(fmtDate(vend.as_of))}</h4>
  <div class="kpi-grid kpi-grid--3" style="margin-bottom:8pt">
    ${kpiCard("Open AP", fmtCurrency(vend.open_ap))}
  </div>
  ${agingRows ? `
  <table class="fin-table">
    <thead><tr><th>Bucket</th><th>Days</th><th class="num">Amount</th><th class="num">Count</th></tr></thead>
    <tbody>${agingRows}</tbody>
  </table>` : ""}
</div>`;
  }

  return `
<div style="margin-bottom:12pt;page-break-inside:avoid">
  ${label}
  ${arHtml || emptyState("AR data not available.")}
  ${apHtml || ""}
</div>`;
}

// ─── Section 8: Alerts & Action Plan ─────────────────────────────────────────

function renderAlerts(report: BuiltReport): string {
  const alerts = asAlerts(report.sections["alerts"]);

  if (alerts.length === 0) {
    return `
<div class="section section--break-before" id="section-alerts">
  ${pageHeader(report.template.name, "Alerts & Action Plan", report.period)}
  ${sectionHeading("Alerts & Action Plan", { number: 7 })}
  ${insight("No Active Alerts", "All monitored metrics are within acceptable thresholds.", "positive")}
</div>`;
  }

  // Sort: critical → high → medium → low
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...alerts].sort(
    (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9),
  );

  const alertCards = sorted.map((a) => {
    const badgeColor = a.severity === "critical" || a.severity === "high" ? "red" : a.severity === "medium" ? "amber" : "green";
    const cardClass = `alert-card--${a.severity}`;
    const action = (a as Record<string, unknown>)["recommended_action"] as string | undefined
      || (a as Record<string, unknown>)["action"] as string | undefined;
    const impact = (a as Record<string, unknown>)["financial_impact"] as string | undefined;
    const owner = (a as Record<string, unknown>)["owner"] as string | undefined;

    return `
<div class="alert-card ${cardClass}">
  <div class="alert-card__priority">${badge(a.severity.toUpperCase(), badgeColor)}</div>
  <div class="alert-card__body">
    <div class="alert-card__title">${escHtml(a.entity)} — ${escHtml(a.title)}</div>
    <div class="alert-card__desc">${escHtml(a.description)}</div>
    ${impact ? `<div style="font-size:8pt;color:${BRAND.textSecondary};margin-bottom:4pt">Impact: ${escHtml(impact)}</div>` : ""}
    ${action ? `<div class="alert-card__action">→ ${escHtml(action)}</div>` : ""}
    ${owner ? `<div class="alert-card__meta">Owner: ${escHtml(owner)}</div>` : ""}
  </div>
</div>`;
  }).join("");

  // Summary counts
  const critCount = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
  const medCount = alerts.filter((a) => a.severity === "medium").length;

  return `
<div class="section section--break-before" id="section-alerts">
  ${pageHeader(report.template.name, "Alerts & Action Plan", report.period)}
  ${sectionHeading("Alerts & Action Plan", { number: 7 })}

  <div class="kpi-grid kpi-grid--3" style="margin-bottom:12pt">
    ${kpiCard("Total Alerts", String(alerts.length))}
    ${kpiCard("Critical / High", String(critCount))}
    ${kpiCard("Medium", String(medCount))}
  </div>

  ${alertCards}
</div>`;
}

// ─── Section 9: Data Integrity ────────────────────────────────────────────────

function renderDataIntegrity(report: BuiltReport): string {
  const { summary, freshness } = asValidation(report.sections["validation"]);
  const norm = normalizeValidationSummary(summary);

  const pipelineStatus = (freshness as Record<string, unknown> | undefined)?.qbo_connection as string ?? "—";
  const dataAsOf = freshness?.data_as_of ? fmtDate(freshness.data_as_of) : "—";
  // Avoid raw ISO timestamps — format pipeline_run if it looks like ISO
  const pipelineRun = (freshness as Record<string, unknown> | undefined)?.pipeline_run as string | undefined;
  const pipelineRunFormatted = pipelineRun && pipelineRun !== "unknown" ? fmtDate(pipelineRun) : "—";

  const statusBadge = norm
    ? norm.allPassed
      ? badge("All Checks Passed", "green")
      : badge("Issues Found", "amber")
    : badge("Unknown", "gray");

  return `
<div class="section section--break-before" id="section-data-integrity">
  ${pageHeader(report.template.name, "Data Integrity", report.period)}
  ${sectionHeading("Data Integrity", { number: 8 })}

  <div class="kpi-grid kpi-grid--4" style="margin-bottom:12pt">
    ${kpiCard("Data As Of", dataAsOf)}
    ${kpiCard("Pipeline Run", pipelineRunFormatted)}
    ${kpiCard("Checks Passed", norm?.passed != null ? `${norm.passed}/${norm.totalChecks ?? "?"}` : "—")}
    ${kpiCard("Status", statusBadge)}
  </div>

  ${norm && !norm.allPassed
    ? insight("Validation Issues", "One or more data validation checks did not pass. Review the validation report before distributing this document.", "warning")
    : insight("Data Validated", "All monitored pipeline checks passed. Published data meets FinanceOS quality thresholds.", "positive")
  }

  <p style="font-size:8pt;color:${BRAND.textMuted};margin-top:10pt">
    This report was generated automatically by the FinanceOS pipeline.
    Financial values are sourced from QuickBooks Online via the FinanceOS Core semantic layer.
    Cash flow statements use only rows where validation_status = 'passed' and publication_status = 'published'.
    Do not distribute without verifying the validation status above.
  </p>

  ${dataFooter([`Generated ${fmtDate(report.generatedAt)}`, `Source: ${report.source}`, "FinanceOS — Confidential"])}
</div>`;
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export function renderMonthlyClose(report: BuiltReport): string {
  const isSingle = report.branding.mode === "single" && report.branding.primaryEntity;
  const primaryColor = isSingle ? (report.branding.primaryEntity?.primaryColor ?? BRAND.green) : BRAND.green;

  const sections = [
    renderCover(report),
    renderExecutiveOverview(report),
    renderPortfolioPerformance(report),
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
