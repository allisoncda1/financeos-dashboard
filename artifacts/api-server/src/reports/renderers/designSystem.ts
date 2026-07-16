/**
 * FinanceOS Report Design System
 *
 * Reusable component generators and CSS for professional financial reports.
 * All components produce self-contained HTML strings. No external dependencies.
 *
 * Usage:
 *   import { DS } from "./designSystem";
 *   const html = DS.kpiCard("Revenue", "$1,234,567");
 */

// ─── Brand tokens ─────────────────────────────────────────────────────────────

export const BRAND = {
  /** FinanceOS dark green — primary brand color */
  green: "#1a4731",
  greenLight: "#2d6a4f",
  greenMid: "#1e5c3a",
  greenAccent: "#52b788",
  /** Surface colors */
  white: "#ffffff",
  offWhite: "#f8f9fa",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  /** Text */
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  textInverse: "#ffffff",
  /** Semantic */
  positive: "#166534",
  positiveBg: "#dcfce7",
  negative: "#991b1b",
  negativeBg: "#fee2e2",
  warning: "#92400e",
  warningBg: "#fef3c7",
  info: "#1e40af",
  infoBg: "#dbeafe",
  /** Accent */
  amber: "#f59e0b",
  purple: "#7c3aed",
} as const;

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function escHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtCurrency(
  value: number | null | undefined,
  opts: { showParens?: boolean; compact?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  let formatted: string;
  if (opts.compact && abs >= 1_000_000) {
    formatted = `$${(abs / 1_000_000).toFixed(1)}M`;
  } else if (opts.compact && abs >= 1_000) {
    formatted = `$${(abs / 1_000).toFixed(0)}K`;
  } else {
    formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
  }
  if (value < 0) {
    return opts.showParens !== false ? `(${formatted})` : `-${formatted}`;
  }
  return formatted;
}

export function fmtPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

export function fmtMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.length === 7 ? iso + "-01T00:00:00" : iso.length === 10 ? iso + "T00:00:00" : iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  } catch {
    return iso;
  }
}

/** Format a number with color class based on sign */
export function amountCell(
  value: number | null | undefined,
  invertColor = false,
): { html: string; cssClass: string } {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { html: "—", cssClass: "amount--unavailable" };
  }
  const formatted = fmtCurrency(value, { showParens: true });
  const isNegative = value < 0;
  const isGood = invertColor ? isNegative : !isNegative;
  const cssClass = isNegative ? "amount--negative" : "amount--positive";
  return { html: `<span class="${cssClass}">${formatted}</span>`, cssClass };
}

/** Variance column: dollar + percent, color-coded */
export function varianceCell(
  current: number | null | undefined,
  prior: number | null | undefined,
  favorableWhenPositive = true,
): string {
  if (
    current === null || current === undefined || !Number.isFinite(current) ||
    prior === null || prior === undefined || !Number.isFinite(prior)
  ) {
    return '<span class="variance--na">—</span>';
  }
  const diff = current - prior;
  const pct = prior !== 0 ? (diff / Math.abs(prior)) * 100 : null;
  const favorable = favorableWhenPositive ? diff >= 0 : diff <= 0;
  const cssClass = favorable ? "variance--fav" : "variance--unfav";
  const sign = diff >= 0 ? "+" : "";
  const pctStr = pct !== null ? ` (${sign}${pct.toFixed(1)}%)` : "";
  return `<span class="${cssClass}">${sign}${fmtCurrency(diff, { showParens: false })}${pctStr}</span>`;
}

// ─── CSS (base styles for all reports) ───────────────────────────────────────

export function buildBaseStyles(primaryColor: string = BRAND.green): string {
  return `
<style>
  /* ── Reset & base ─────────────────────────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    background: #ffffff !important;
    color: ${BRAND.textPrimary};
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Page setup ──────────────────────────────────────────────────────────── */
  @page {
    size: A4;
    margin: 18mm 15mm 18mm 15mm;
    background: #ffffff;
  }
  @page :first { margin-top: 0; margin-bottom: 0; }

  /* ── Typography ──────────────────────────────────────────────────────────── */
  h1 { font-size: 22pt; font-weight: 700; letter-spacing: -0.5px; color: ${BRAND.textPrimary}; }
  h2 { font-size: 13pt; font-weight: 700; color: ${BRAND.textPrimary}; }
  h3 { font-size: 10pt; font-weight: 600; color: ${BRAND.textSecondary}; }
  h4 { font-size: 9pt; font-weight: 600; color: ${BRAND.textSecondary}; }
  p  { font-size: 10pt; color: ${BRAND.textPrimary}; }

  /* ── Layout utilities ────────────────────────────────────────────────────── */
  .page { width: 100%; background: #ffffff; }
  .page--cover {
    min-height: 297mm;
    width: 210mm;
    margin: 0;
    padding: 0;
    background: #ffffff;
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }
  .section {
    margin-bottom: 20pt;
    page-break-inside: avoid;
  }
  .section--break-before { page-break-before: always; }
  .section--no-break { page-break-inside: avoid; }
  .section--break-after { page-break-after: always; }

  /* ── Section headings ────────────────────────────────────────────────────── */
  .section-heading {
    display: flex;
    align-items: center;
    gap: 8pt;
    margin-bottom: 10pt;
    padding-bottom: 6pt;
    border-bottom: 2pt solid ${primaryColor};
    page-break-after: avoid;
  }
  .section-heading__number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18pt;
    height: 18pt;
    background: ${primaryColor};
    color: #fff;
    font-size: 8pt;
    font-weight: 700;
    border-radius: 3pt;
    flex-shrink: 0;
  }
  .section-heading__title {
    font-size: 12pt;
    font-weight: 700;
    color: ${BRAND.textPrimary};
    margin: 0;
  }
  .section-heading__subtitle {
    font-size: 9pt;
    color: ${BRAND.textSecondary};
    margin: 0;
    margin-left: auto;
  }

  /* ── KPI grid ────────────────────────────────────────────────────────────── */
  .kpi-grid { display: grid; gap: 8pt; }
  .kpi-grid--3 { grid-template-columns: repeat(3, 1fr); }
  .kpi-grid--4 { grid-template-columns: repeat(4, 1fr); }
  .kpi-grid--5 { grid-template-columns: repeat(5, 1fr); }
  .kpi-grid--6 { grid-template-columns: repeat(6, 1fr); }
  .kpi-grid--2 { grid-template-columns: repeat(2, 1fr); }

  .kpi-card {
    background: ${BRAND.offWhite};
    border: 1pt solid ${BRAND.border};
    border-radius: 4pt;
    padding: 8pt 10pt;
    page-break-inside: avoid;
  }
  .kpi-card--accent {
    background: ${primaryColor};
    border-color: ${primaryColor};
  }
  .kpi-card--accent .kpi-card__label { color: rgba(255,255,255,0.75); }
  .kpi-card--accent .kpi-card__value { color: #fff; }
  .kpi-card__label {
    font-size: 7pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${BRAND.textSecondary};
    margin-bottom: 3pt;
  }
  .kpi-card__value {
    font-size: 14pt;
    font-weight: 700;
    color: ${BRAND.textPrimary};
    line-height: 1.2;
  }
  .kpi-card__value--sm { font-size: 11pt; }
  .kpi-card__change {
    font-size: 8pt;
    color: ${BRAND.textMuted};
    margin-top: 2pt;
  }
  .kpi-card__change--pos { color: ${BRAND.positive}; }
  .kpi-card__change--neg { color: ${BRAND.negative}; }

  /* ── Status badges ───────────────────────────────────────────────────────── */
  .badge {
    display: inline-block;
    padding: 1pt 6pt;
    border-radius: 2pt;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    vertical-align: middle;
  }
  .badge--green  { background: ${BRAND.positiveBg}; color: ${BRAND.positive}; }
  .badge--red    { background: ${BRAND.negativeBg}; color: ${BRAND.negative}; }
  .badge--amber  { background: ${BRAND.warningBg};  color: ${BRAND.warning}; }
  .badge--blue   { background: ${BRAND.infoBg};     color: ${BRAND.info}; }
  .badge--gray   { background: ${BRAND.borderLight}; color: ${BRAND.textSecondary}; }

  /* ── Insight callout ──────────────────────────────────────────────────────── */
  .insight {
    display: flex;
    align-items: flex-start;
    gap: 8pt;
    padding: 7pt 10pt;
    border-radius: 4pt;
    margin-bottom: 5pt;
    page-break-inside: avoid;
  }
  .insight--positive { background: ${BRAND.positiveBg}; border-left: 3pt solid ${BRAND.positive}; }
  .insight--warning  { background: ${BRAND.warningBg};  border-left: 3pt solid ${BRAND.amber}; }
  .insight--critical { background: ${BRAND.negativeBg}; border-left: 3pt solid ${BRAND.negative}; }
  .insight--info     { background: ${BRAND.infoBg};     border-left: 3pt solid ${BRAND.info}; }
  .insight--neutral  { background: ${BRAND.offWhite};   border-left: 3pt solid ${BRAND.border}; }
  .insight__icon { font-size: 10pt; flex-shrink: 0; margin-top: 1pt; }
  .insight__body { flex: 1; }
  .insight__title { font-size: 9pt; font-weight: 700; margin-bottom: 1pt; }
  .insight__text  { font-size: 8.5pt; color: ${BRAND.textSecondary}; }

  /* ── Tables ──────────────────────────────────────────────────────────────── */
  .fin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-bottom: 10pt;
    page-break-inside: auto;
  }
  .fin-table thead {
    display: table-header-group;
  }
  .fin-table thead th {
    background: ${primaryColor};
    color: #fff;
    padding: 5pt 8pt;
    text-align: left;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .fin-table thead th.num { text-align: right; }
  .fin-table tbody tr { page-break-inside: avoid; }
  .fin-table tbody td {
    padding: 4pt 8pt;
    border-bottom: 0.5pt solid ${BRAND.borderLight};
    vertical-align: middle;
  }
  .fin-table tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .fin-table tbody tr:nth-child(even) { background: ${BRAND.offWhite}; }
  .fin-table tbody tr.row--section {
    background: #eef2f7;
    font-weight: 700;
  }
  .fin-table tbody tr.row--section td { font-size: 8.5pt; }
  .fin-table tbody tr.row--subtotal td {
    font-weight: 700;
    border-top: 1pt solid ${BRAND.border};
    border-bottom: 1pt solid ${BRAND.border};
  }
  .fin-table tbody tr.row--total td {
    font-weight: 700;
    font-size: 9.5pt;
    border-top: 2pt solid ${primaryColor};
    background: ${BRAND.offWhite};
  }
  .fin-table tbody tr.row--indent td:first-child { padding-left: 18pt; }
  .fin-table tbody tr.row--indent2 td:first-child { padding-left: 30pt; }
  .fin-table tbody tr.row--unavailable td { color: ${BRAND.textMuted}; font-style: italic; }

  /* ── Amount colors ───────────────────────────────────────────────────────── */
  .amount--negative { color: ${BRAND.negative}; }
  .amount--positive { color: ${BRAND.textPrimary}; }
  .amount--unavailable { color: ${BRAND.textMuted}; }
  .variance--fav   { color: ${BRAND.positive}; font-size: 8pt; }
  .variance--unfav { color: ${BRAND.negative}; font-size: 8pt; }
  .variance--na    { color: ${BRAND.textMuted}; font-size: 8pt; }

  /* ── Entity summary card ─────────────────────────────────────────────────── */
  .entity-card {
    border: 1pt solid ${BRAND.border};
    border-radius: 5pt;
    overflow: hidden;
    page-break-inside: avoid;
    margin-bottom: 8pt;
  }
  .entity-card__header {
    background: ${primaryColor};
    color: #fff;
    padding: 7pt 10pt;
    display: flex;
    align-items: center;
    gap: 8pt;
  }
  .entity-card__logo {
    width: 24pt;
    height: 24pt;
    border-radius: 3pt;
    object-fit: contain;
    background: rgba(255,255,255,0.15);
    padding: 2pt;
  }
  .entity-card__logo--fallback {
    width: 24pt;
    height: 24pt;
    border-radius: 3pt;
    background: rgba(255,255,255,0.2);
    color: #fff;
    font-weight: 700;
    font-size: 9pt;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .entity-card__name { font-size: 11pt; font-weight: 700; }
  .entity-card__meta { font-size: 8pt; opacity: 0.8; margin-left: auto; }
  .entity-card__body { padding: 8pt 10pt; background: #fff; }

  /* ── Alert/action card ───────────────────────────────────────────────────── */
  .alert-card {
    border: 1pt solid ${BRAND.border};
    border-radius: 4pt;
    padding: 8pt 10pt;
    margin-bottom: 6pt;
    display: flex;
    gap: 10pt;
    align-items: flex-start;
    page-break-inside: avoid;
    background: #fff;
  }
  .alert-card--critical { border-left: 3pt solid ${BRAND.negative}; }
  .alert-card--high     { border-left: 3pt solid ${BRAND.amber}; }
  .alert-card--medium   { border-left: 3pt solid #f59e0b; }
  .alert-card--low      { border-left: 3pt solid ${BRAND.greenAccent}; }
  .alert-card__priority { flex-shrink: 0; }
  .alert-card__body { flex: 1; }
  .alert-card__title { font-size: 9.5pt; font-weight: 700; margin-bottom: 2pt; }
  .alert-card__desc  { font-size: 8.5pt; color: ${BRAND.textSecondary}; margin-bottom: 4pt; }
  .alert-card__action {
    font-size: 8.5pt;
    color: ${primaryColor};
    font-weight: 600;
    padding: 3pt 8pt;
    background: rgba(26,71,49,0.07);
    border-radius: 3pt;
    display: inline-block;
  }
  .alert-card__meta { font-size: 7.5pt; color: ${BRAND.textMuted}; margin-top: 3pt; }

  /* ── Data-source footer ──────────────────────────────────────────────────── */
  .data-footer {
    font-size: 7.5pt;
    color: ${BRAND.textMuted};
    padding-top: 5pt;
    border-top: 0.5pt solid ${BRAND.border};
    margin-top: 8pt;
  }

  /* ── Empty state ──────────────────────────────────────────────────────────── */
  .empty-state {
    text-align: center;
    padding: 20pt 0;
    color: ${BRAND.textMuted};
    font-size: 9pt;
    font-style: italic;
  }

  /* ── Cover page styles ───────────────────────────────────────────────────── */
  .cover {
    min-height: 100vh;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    page-break-after: always;
  }
  .cover__top-bar {
    height: 8pt;
    background: ${primaryColor};
  }
  .cover__body {
    flex: 1;
    padding: 30mm 20mm;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .cover__brand {
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${primaryColor};
    margin-bottom: 18pt;
  }
  .cover__title {
    font-size: 26pt;
    font-weight: 700;
    color: ${BRAND.textPrimary};
    line-height: 1.15;
    margin-bottom: 6pt;
  }
  .cover__period {
    font-size: 14pt;
    color: ${BRAND.textSecondary};
    font-weight: 400;
    margin-bottom: 28pt;
  }
  .cover__divider {
    width: 40pt;
    height: 3pt;
    background: ${primaryColor};
    margin-bottom: 20pt;
    border-radius: 1.5pt;
  }
  .cover__entities {
    display: flex;
    flex-wrap: wrap;
    gap: 6pt;
    margin-bottom: 20pt;
  }
  .cover__entity-chip {
    padding: 3pt 8pt;
    border: 1pt solid ${primaryColor};
    border-radius: 12pt;
    font-size: 8.5pt;
    font-weight: 600;
    color: ${primaryColor};
  }
  .cover__meta-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8pt;
    margin-bottom: 20pt;
  }
  .cover__meta-item { }
  .cover__meta-label {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${BRAND.textMuted};
    margin-bottom: 2pt;
  }
  .cover__meta-value {
    font-size: 9.5pt;
    font-weight: 600;
    color: ${BRAND.textPrimary};
  }
  .cover__spacer { flex: 1; }
  .cover__footer {
    border-top: 1pt solid ${BRAND.border};
    padding-top: 12pt;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cover__confidential {
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${BRAND.textMuted};
    border: 1pt solid ${BRAND.border};
    padding: 2pt 8pt;
    border-radius: 2pt;
  }
  .cover__powered {
    font-size: 7.5pt;
    color: ${BRAND.textMuted};
  }

  /* ── Page header/footer (printed pages) ──────────────────────────────────── */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 7pt;
    border-bottom: 1pt solid ${BRAND.border};
    margin-bottom: 12pt;
    font-size: 8pt;
    color: ${BRAND.textMuted};
  }
  .page-header__brand {
    font-weight: 700;
    color: ${primaryColor};
    font-size: 8.5pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* ── Two-column layout ───────────────────────────────────────────────────── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }
  .three-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10pt; }

  /* ── Comparison table ────────────────────────────────────────────────────── */
  .compare-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-bottom: 10pt;
  }
  .compare-table thead th {
    background: ${BRAND.offWhite};
    color: ${BRAND.textSecondary};
    padding: 5pt 8pt;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1.5pt solid ${primaryColor};
    text-align: left;
  }
  .compare-table thead th:first-child { text-align: left; }
  .compare-table thead th:not(:first-child) { text-align: right; }
  .compare-table tbody tr { page-break-inside: avoid; }
  .compare-table tbody td {
    padding: 5pt 8pt;
    border-bottom: 0.5pt solid ${BRAND.borderLight};
  }
  .compare-table tbody td:not(:first-child) { text-align: right; }
  .compare-table tbody tr.row--header td {
    background: ${primaryColor};
    color: #fff;
    font-weight: 700;
    font-size: 8.5pt;
  }
  .compare-table tbody tr:nth-child(even):not(.row--header) { background: ${BRAND.offWhite}; }

  /* ── Chart container (placeholder for Puppeteer-rendered charts) ─────────── */
  .chart-container {
    border: 1pt solid ${BRAND.border};
    border-radius: 4pt;
    background: ${BRAND.offWhite};
    padding: 10pt;
    margin-bottom: 10pt;
    page-break-inside: avoid;
  }
  .chart-bar-row {
    display: flex;
    align-items: center;
    gap: 6pt;
    margin-bottom: 5pt;
    font-size: 8.5pt;
  }
  .chart-bar-label { width: 80pt; color: ${BRAND.textSecondary}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chart-bar-track { flex: 1; height: 10pt; background: ${BRAND.borderLight}; border-radius: 2pt; }
  .chart-bar-fill { height: 100%; border-radius: 2pt; background: ${primaryColor}; }
  .chart-bar-fill--accent { background: ${BRAND.greenAccent}; }
  .chart-bar-fill--amber { background: ${BRAND.amber}; }
  .chart-bar-fill--negative { background: ${BRAND.negative}; }
  .chart-bar-value { width: 60pt; text-align: right; font-variant-numeric: tabular-nums; }

  /* ── Print / Puppeteer safe ──────────────────────────────────────────────── */
  @media print {
    body { background: #ffffff !important; }
    a { color: inherit; text-decoration: none; }
    .no-print { display: none; }
  }
</style>`;
}

// ─── Component builders ───────────────────────────────────────────────────────

/** Page header repeated on each content page */
export function pageHeader(reportTitle: string, entityName: string, period: string): string {
  return `
<div class="page-header">
  <span class="page-header__brand">FinanceOS</span>
  <span>${escHtml(entityName)} &mdash; ${escHtml(reportTitle)}</span>
  <span>${escHtml(period)}</span>
</div>`;
}

/** Section heading with optional number and subtitle */
export function sectionHeading(
  title: string,
  opts: { number?: number | string; subtitle?: string } = {},
): string {
  const numBadge = opts.number !== undefined
    ? `<span class="section-heading__number">${opts.number}</span>`
    : "";
  const subtitle = opts.subtitle
    ? `<span class="section-heading__subtitle">${escHtml(opts.subtitle)}</span>`
    : "";
  return `
<div class="section-heading">
  ${numBadge}
  <h2 class="section-heading__title">${escHtml(title)}</h2>
  ${subtitle}
</div>`;
}

/** Single KPI card */
export function kpiCard(
  label: string,
  value: string,
  opts: { change?: string; changeClass?: string; accent?: boolean; smallValue?: boolean } = {},
): string {
  const accentClass = opts.accent ? " kpi-card--accent" : "";
  const valueClass = opts.smallValue ? " kpi-card__value--sm" : "";
  const change = opts.change
    ? `<div class="kpi-card__change ${opts.changeClass ?? ""}">${escHtml(opts.change)}</div>`
    : "";
  return `
<div class="kpi-card${accentClass}">
  <div class="kpi-card__label">${escHtml(label)}</div>
  <div class="kpi-card__value${valueClass}">${value}</div>
  ${change}
</div>`;
}

/** Status badge */
export function badge(text: string, color: "green" | "red" | "amber" | "blue" | "gray" = "gray"): string {
  return `<span class="badge badge--${color}">${escHtml(text)}</span>`;
}

/** Insight / callout block */
export function insight(
  title: string,
  text: string,
  variant: "positive" | "warning" | "critical" | "info" | "neutral" = "neutral",
): string {
  const icons: Record<string, string> = {
    positive: "✓",
    warning: "⚠",
    critical: "✗",
    info: "ℹ",
    neutral: "→",
  };
  return `
<div class="insight insight--${variant}">
  <span class="insight__icon">${icons[variant] ?? "•"}</span>
  <div class="insight__body">
    <div class="insight__title">${escHtml(title)}</div>
    <div class="insight__text">${escHtml(text)}</div>
  </div>
</div>`;
}

/** Empty state placeholder */
export function emptyState(message: string): string {
  return `<div class="empty-state">${escHtml(message)}</div>`;
}

/** Data-source footer */
export function dataFooter(items: string[]): string {
  return `<div class="data-footer">${items.map(escHtml).join(" &middot; ")}</div>`;
}

/** Horizontal bar chart row */
export function barRow(
  label: string,
  value: number | null | undefined,
  maxValue: number,
  formatted: string,
  variant: "default" | "accent" | "amber" | "negative" = "default",
): string {
  const fillPct = maxValue > 0 && value != null && Number.isFinite(value)
    ? Math.min(100, (Math.abs(value) / Math.abs(maxValue)) * 100)
    : 0;
  const fillClass =
    variant === "accent" ? "chart-bar-fill--accent"
    : variant === "amber" ? "chart-bar-fill--amber"
    : variant === "negative" ? "chart-bar-fill--negative"
    : "chart-bar-fill";
  return `
<div class="chart-bar-row">
  <span class="chart-bar-label" title="${escHtml(label)}">${escHtml(label)}</span>
  <span class="chart-bar-track"><span class="${fillClass}" style="width:${fillPct.toFixed(1)}%"></span></span>
  <span class="chart-bar-value">${escHtml(formatted)}</span>
</div>`;
}
