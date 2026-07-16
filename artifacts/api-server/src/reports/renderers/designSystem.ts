/**
 * FinanceOS Report Design System — v2
 *
 * Premium design system for print-ready financial reports.
 * Outputs are pure HTML/CSS/SVG strings; no runtime dependencies.
 *
 * Architecture:
 *   BRAND           – color & typography constants
 *   Format helpers  – escHtml, fmtCurrency, fmtPercent, fmtDate, fmtMonthYear
 *   Cell helpers    – amountCell, varianceCell, variancePill
 *   CSS             – buildBaseStyles (A4-optimized, print-safe, @page rule)
 *   SVG charts      – inline SVG generators for line, bar, waterfall, donut
 *   Components      – cover, pageHeader, sectionBanner, kpiCard, table helpers,
 *                     insight, badge, emptyState, dataFooter
 */

import { readFileSync } from "fs";
import { resolve, join, sep } from "path";

// ─── Brand tokens ─────────────────────────────────────────────────────────────

export const BRAND = {
  // Primary brand
  forestGreen:    "#0f2e1f",
  darkGreen:      "#1a4731",
  green:          "#166534",
  greenMid:       "#15803d",
  greenLight:     "#dcfce7",

  // Financial status
  positive:       "#16a34a",
  negative:       "#b91c1c",
  warning:        "#d97706",
  info:           "#1d4ed8",

  // Section accent colors
  sectionExec:    "#0f2e1f",   // Executive — forest green
  sectionPerf:    "#1e3a5f",   // Performance — deep blue
  sectionPnL:     "#1e293b",   // P&L — slate navy
  sectionBS:      "#1e3a5f",   // Balance Sheet — deep blue
  sectionCF:      "#134e4a",   // Cash Flow — dark teal
  sectionARAP:    "#3b0764",   // AR/AP — deep purple
  sectionAlerts:  "#7c2d12",   // Alerts — deep orange/red
  sectionInteg:   "#1e293b",   // Data Integrity — slate

  // Text
  textPrimary:    "#0f172a",
  textSecondary:  "#334155",
  textMuted:      "#64748b",
  textFaint:      "#94a3b8",

  // Surfaces
  white:          "#ffffff",
  bgLight:        "#f8fafc",
  bgMid:          "#f1f5f9",
  bgTable:        "#fafbfc",
  borderLight:    "#e2e8f0",
  borderMid:      "#cbd5e1",
  borderDark:     "#94a3b8",
} as const;

// ─── Logo embed (path-safe, cached) ──────────────────────────────────────────

const _LOGO_CACHE = new Map<string, string | null>();

export function embedLogoPath(logoPath: string | null): string | null {
  if (!logoPath) return null;
  if (_LOGO_CACHE.has(logoPath)) return _LOGO_CACHE.get(logoPath) ?? null;
  try {
    const relative = logoPath.replace(/^\//, "");
    const logoRoot = resolve(__dirname, "../../../../financeos/public");
    const diskPath = resolve(join(logoRoot, relative));
    if (!diskPath.startsWith(logoRoot + sep)) { _LOGO_CACHE.set(logoPath, null); return null; }
    const bytes = readFileSync(diskPath);
    const ext = diskPath.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    _LOGO_CACHE.set(logoPath, dataUrl);
    return dataUrl;
  } catch {
    _LOGO_CACHE.set(logoPath, null);
    return null;
  }
}

export function logoImg(
  logoPath: string | null,
  name: string,
  primaryColor: string,
  opts: { height?: string; className?: string } = {},
): string {
  const src = embedLogoPath(logoPath);
  const h = opts.height ?? "32pt";
  const cls = opts.className ? ` class="${opts.className}"` : "";
  if (src) {
    return `<img${cls} src="${src}" alt="${escHtml(name)}" style="height:${h};width:auto;object-fit:contain;display:block" />`;
  }
  const initials = escHtml(name.slice(0, 2).toUpperCase());
  const size = opts.height ?? "32pt";
  return `<span${cls} style="display:inline-flex;align-items:center;justify-content:center;width:${size};height:${size};border-radius:6pt;background:${escHtml(primaryColor)};color:#fff;font-weight:700;font-size:12pt;font-family:Arial,sans-serif">${initials}</span>`;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function escHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtCurrency(
  value: number | null | undefined,
  opts: { showParens?: boolean; compact?: boolean; decimals?: number } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  let formatted: string;
  if (opts.compact && abs >= 1_000_000) {
    formatted = `$${(abs / 1_000_000).toFixed(1)}M`;
  } else if (opts.compact && abs >= 1_000) {
    formatted = `$${(abs / 1_000).toFixed(0)}K`;
  } else {
    const dec = opts.decimals ?? 2;
    formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(abs);
  }
  if (value < 0) {
    return opts.showParens !== false ? `(${formatted})` : `-${formatted}`;
  }
  return formatted;
}

export function fmtPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "" : "";
  return `${value.toFixed(decimals)}%`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value.includes("T") ? value : value + "T12:00:00Z");
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  } catch { return String(value); }
}

export function fmtMonthYear(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value.includes("T") ? value : value + "T12:00:00Z");
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  } catch { return String(value); }
}

export function fmtMonthShort(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value.includes("T") ? value : value + "T12:00:00Z");
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  } catch { return "—"; }
}

// ─── Cell helpers ─────────────────────────────────────────────────────────────

export function amountCell(
  value: number | null | undefined,
  invertColor = false,
): { html: string; cssClass: string } {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { html: '<span class="amount--unavailable">—</span>', cssClass: "amount--unavailable" };
  }
  const formatted = fmtCurrency(value, { showParens: true });
  const isNeg = value < 0;
  const cssClass = isNeg ? "amount--negative" : "amount--positive";
  return { html: `<span class="${cssClass}">${formatted}</span>`, cssClass };
}

export function varianceCell(
  current: number | null | undefined,
  prior: number | null | undefined,
  favorableWhenPositive = true,
): string {
  if (
    current === null || current === undefined || !Number.isFinite(current as number) ||
    prior === null || prior === undefined || !Number.isFinite(prior as number)
  ) {
    return '<span class="variance--na">—</span>';
  }
  const delta = (current as number) - (prior as number);
  const favorable = favorableWhenPositive ? delta >= 0 : delta <= 0;
  const cssClass = delta === 0 ? "variance--neutral" : favorable ? "variance--fav" : "variance--unfav";
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  const label = delta === 0 ? "—" : `${arrow} ${fmtCurrency(Math.abs(delta), { compact: true })}`;
  return `<span class="${cssClass}">${label}</span>`;
}

export function variancePill(
  value: number | null | undefined,
  isPositiveFav = true,
  showPercent = true,
): string {
  if (value === null || value === undefined || !Number.isFinite(value as number)) {
    return '<span class="vpill vpill--na">—</span>';
  }
  const v = value as number;
  const favorable = isPositiveFav ? v >= 0 : v <= 0;
  const cls = favorable ? "vpill--pos" : "vpill--neg";
  const arrow = v > 0 ? "▲" : v < 0 ? "▼" : "";
  const text = showPercent
    ? `${arrow} ${Math.abs(v).toFixed(1)}%`
    : `${arrow} ${fmtCurrency(Math.abs(v), { compact: true })}`;
  return `<span class="vpill ${cls}">${text}</span>`;
}

// ─── SVG Chart generators ─────────────────────────────────────────────────────

/** SVG line/area chart for trend data. Returns self-contained SVG element. */
export function svgLineChart(
  data: (number | null)[],
  opts: {
    width?: number;
    height?: number;
    color?: string;
    fillOpacity?: number;
    labels?: string[];
    showDots?: boolean;
    showGrid?: boolean;
    unit?: string;
    compact?: boolean;
  } = {},
): string {
  const W = opts.width ?? 280;
  const H = opts.height ?? 70;
  const color = opts.color ?? BRAND.darkGreen;
  const valid = data.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length < 2) return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="9" fill="${BRAND.textFaint}">No trend data</text></svg>`;

  const PAD_L = opts.labels ? 8 : 8;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = opts.labels ? 18 : 8;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const indices: number[] = [];
  const pts: { x: number; y: number }[] = [];

  data.forEach((v, i) => {
    if (v !== null && Number.isFinite(v)) {
      const x = PAD_L + (i / (data.length - 1)) * chartW;
      const y = PAD_T + chartH - ((v - min) / range) * chartH;
      indices.push(i);
      pts.push({ x, y });
    }
  });

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoly = [
    `${pts[0]!.x.toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
    ...pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${pts[pts.length - 1]!.x.toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
  ].join(" ");

  const fillOpacity = opts.fillOpacity ?? 0.12;

  let dots = "";
  if (opts.showDots !== false && pts.length <= 12) {
    dots = pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="${color}" />`).join("");
  }

  let grid = "";
  if (opts.showGrid) {
    const gridY1 = PAD_T + chartH * 0.33;
    const gridY2 = PAD_T + chartH * 0.67;
    grid = `
      <line x1="${PAD_L}" y1="${gridY1.toFixed(1)}" x2="${W - PAD_R}" y2="${gridY1.toFixed(1)}" stroke="${BRAND.borderLight}" stroke-width="0.5" />
      <line x1="${PAD_L}" y1="${gridY2.toFixed(1)}" x2="${W - PAD_R}" y2="${gridY2.toFixed(1)}" stroke="${BRAND.borderLight}" stroke-width="0.5" />`;
  }

  let labelHtml = "";
  if (opts.labels && opts.labels.length >= 2) {
    const first = opts.labels[0]!;
    const last = opts.labels[opts.labels.length - 1]!;
    labelHtml = `
      <text x="${PAD_L}" y="${H - 2}" font-size="7" fill="${BRAND.textFaint}">${escHtml(first)}</text>
      <text x="${W - PAD_R}" y="${H - 2}" text-anchor="end" font-size="7" fill="${BRAND.textFaint}">${escHtml(last)}</text>`;
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    <polygon points="${areaPoly}" fill="${color}" opacity="${fillOpacity}" />
    <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    ${dots}
    ${labelHtml}
  </svg>`;
}

/** SVG waterfall chart for cash flow. */
export function svgWaterfallChart(
  bars: { label: string; value: number; isTotal?: boolean; color?: string }[],
  opts: { width?: number; height?: number } = {},
): string {
  const W = opts.width ?? 480;
  const H = opts.height ?? 140;
  const PAD_L = 40;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 32;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Compute running totals
  const points: { start: number; end: number; label: string; color: string; isTotal: boolean }[] = [];
  let running = 0;
  for (const bar of bars) {
    if (bar.isTotal) {
      points.push({ start: 0, end: bar.value, label: bar.label, color: bar.color ?? BRAND.darkGreen, isTotal: true });
    } else {
      const start = running;
      running += bar.value;
      const color = bar.color ?? (bar.value >= 0 ? "#16a34a" : "#b91c1c");
      points.push({ start, end: running, label: bar.label, color, isTotal: false });
    }
  }

  const allVals = points.flatMap((p) => [p.start, p.end]);
  const rawMin = Math.min(0, ...allVals);
  const rawMax = Math.max(0, ...allVals);
  const range = rawMax - rawMin || 1;

  const toY = (v: number) => PAD_T + chartH - ((v - rawMin) / range) * chartH;
  const zeroY = toY(0);
  const barW = (chartW / points.length) * 0.65;
  const gap = (chartW / points.length) * 0.35;

  let barsHtml = "";
  let labelsHtml = "";
  let connectors = "";

  points.forEach((p, i) => {
    const x = PAD_L + (i / points.length) * chartW + gap / 2;
    const y1 = toY(Math.max(p.start, p.end));
    const y2 = toY(Math.min(p.start, p.end));
    const bh = Math.max(y2 - y1, 2);
    barsHtml += `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${p.color}" rx="1.5" />`;

    // Label below
    const labelY = H - PAD_B + 12;
    labelsHtml += `<text x="${(x + barW / 2).toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="6.5" fill="${BRAND.textSecondary}">${escHtml(p.label)}</text>`;

    // Value above bar
    const valY = y1 - 3;
    const valText = fmtCurrency(p.isTotal ? p.end : p.end - p.start, { compact: true });
    const valColor = p.isTotal ? BRAND.textPrimary : p.color;
    labelsHtml += `<text x="${(x + barW / 2).toFixed(1)}" y="${valY.toFixed(1)}" text-anchor="middle" font-size="6.5" font-weight="600" fill="${valColor}">${escHtml(valText)}</text>`;

    // Connector to next bar
    if (i < points.length - 1 && !p.isTotal) {
      const nextX = PAD_L + ((i + 1) / points.length) * chartW + gap / 2;
      connectors += `<line x1="${(x + barW).toFixed(1)}" y1="${toY(p.end).toFixed(1)}" x2="${nextX.toFixed(1)}" y2="${toY(p.end).toFixed(1)}" stroke="${BRAND.borderMid}" stroke-width="0.75" stroke-dasharray="2,2" />`;
    }
  });

  const zeroLine = `<line x1="${PAD_L}" y1="${zeroY.toFixed(1)}" x2="${(W - PAD_R).toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="${BRAND.borderMid}" stroke-width="0.75" />`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${zeroLine}
    ${connectors}
    ${barsHtml}
    ${labelsHtml}
  </svg>`;
}

/** SVG horizontal grouped bar chart for entity comparison or aging. */
export function svgHBars(
  bars: { label: string; value: number; color?: string; maxValue?: number; secondaryValue?: number; secondaryColor?: string }[],
  opts: { width?: number; height?: number; unit?: string; maxValue?: number } = {},
): string {
  const W = opts.width ?? 380;
  const rowH = 20;
  const PAD_L = 90;
  const PAD_R = 60;
  const H = bars.length * rowH + 12;
  const chartW = W - PAD_L - PAD_R;
  const maxVal = opts.maxValue ?? Math.max(...bars.map((b) => b.value), 1);

  let rows = "";
  bars.forEach((bar, i) => {
    const y = i * rowH + 4;
    const barH = 10;
    const barY = y + (rowH - barH) / 2;
    const bw = Math.max((Math.abs(bar.value) / Math.max(maxVal, 1)) * chartW, 0);
    const color = bar.color ?? BRAND.darkGreen;
    const labelText = fmtCurrency(bar.value, { compact: true });
    const negative = bar.value < 0;

    rows += `
      <text x="${PAD_L - 6}" y="${barY + barH * 0.75}" text-anchor="end" font-size="7.5" fill="${BRAND.textSecondary}">${escHtml(bar.label)}</text>
      <rect x="${PAD_L}" y="${barY}" width="${chartW}" height="${barH}" fill="${BRAND.bgMid}" rx="2" />
      <rect x="${PAD_L}" y="${barY}" width="${bw.toFixed(1)}" height="${barH}" fill="${negative ? "#b91c1c" : color}" rx="2" />
      <text x="${(PAD_L + bw + 4).toFixed(1)}" y="${barY + barH * 0.75}" font-size="7" font-weight="600" fill="${negative ? "#b91c1c" : BRAND.textSecondary}">${escHtml(labelText)}</text>`;
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${rows}
  </svg>`;
}

/** SVG donut/pie chart for proportional data. */
export function svgDonut(
  segments: { label: string; value: number; color: string }[],
  opts: { size?: number; centerLabel?: string; centerSub?: string } = {},
): string {
  const SIZE = opts.size ?? 120;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = SIZE * 0.38;
  const r = SIZE * 0.22;

  const total = segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0);
  if (total <= 0) return `<svg width="${SIZE}" height="${SIZE}"><text x="${cx}" y="${cy}" text-anchor="middle" font-size="9" fill="${BRAND.textFaint}">—</text></svg>`;

  let startAngle = -Math.PI / 2;
  const slices: string[] = [];

  segments.forEach((seg) => {
    if (seg.value <= 0) return;
    const angle = (seg.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);
    const xi1 = cx + r * Math.cos(startAngle);
    const yi1 = cy + r * Math.sin(startAngle);
    const xi2 = cx + r * Math.cos(endAngle);
    const yi2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${xi2.toFixed(2)} ${yi2.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${xi1.toFixed(2)} ${yi1.toFixed(2)} Z`;
    slices.push(`<path d="${d}" fill="${seg.color}" />`);
    startAngle = endAngle;
  });

  const centerLabel = opts.centerLabel ? `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="11" font-weight="700" fill="${BRAND.textPrimary}">${escHtml(opts.centerLabel)}</text>` : "";
  const centerSub = opts.centerSub ? `<text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="7" fill="${BRAND.textMuted}">${escHtml(opts.centerSub)}</text>` : "";

  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
    ${slices.join("")}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" />
    ${centerLabel}
    ${centerSub}
  </svg>`;
}

// ─── CSS Design System ────────────────────────────────────────────────────────

export function buildBaseStyles(primaryColor: string): string {
  return `<style>
/* ── Reset & print ───────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@page {
  size: A4;
  margin: 18mm 14mm 20mm 14mm;
  background: #ffffff;
}

html, body {
  background: #ffffff;
  color: ${BRAND.textPrimary};
  font-family: Arial, Helvetica, 'Liberation Sans', sans-serif;
  font-size: 9pt;
  line-height: 1.5;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

/* ── Page break utilities ────────────────────────────── */
.page-break-before { page-break-before: always; break-before: page; }
.page-break-after  { page-break-after:  always; break-after:  page; }
.no-break          { page-break-inside: avoid; break-inside: avoid; }

/* ── Page header (all pages after cover) ─────────────── */
.page-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6pt;
  margin-bottom: 12pt;
  border-bottom: 1.5pt solid ${primaryColor};
}
.page-hdr__logo { height: 22pt; width: auto; object-fit: contain; }
.page-hdr__logo--fallback {
  height: 22pt; width: 22pt; border-radius: 4pt;
  display: inline-flex; align-items: center; justify-content: center;
  background: ${primaryColor}; color: #fff; font-weight: 700; font-size: 8pt;
}
.page-hdr__center { font-size: 7.5pt; color: ${BRAND.textMuted}; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; }
.page-hdr__right  { font-size: 7.5pt; color: ${BRAND.textMuted}; text-align: right; }

/* ── Cover page ──────────────────────────────────────── */
.cover {
  page-break-after: always;
  position: relative;
  min-height: 257mm;
  display: flex;
  flex-direction: column;
}
.cover__hero {
  background: ${BRAND.forestGreen};
  padding: 28pt 28pt 24pt;
  display: flex;
  flex-direction: column;
  min-height: 112pt;
  position: relative;
  overflow: hidden;
}
.cover__hero-pattern {
  position: absolute;
  top: 0; right: 0; bottom: 0; width: 50%;
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 10pt,
    rgba(255,255,255,0.025) 10pt,
    rgba(255,255,255,0.025) 20pt
  );
  pointer-events: none;
}
.cover__fin-logo { height: 28pt; width: auto; object-fit: contain; }
.cover__fin-logo--text {
  font-size: 18pt; font-weight: 700; color: #fff;
  letter-spacing: 0.02em; font-family: Georgia, 'Times New Roman', serif;
}
.cover__tagline { font-size: 7.5pt; color: rgba(255,255,255,0.6); letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3pt; }
.cover__report-type {
  margin-top: auto;
  font-size: 13pt;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  letter-spacing: 0.04em;
}
.cover__accent-bar {
  height: 4pt;
  background: ${primaryColor};
}
.cover__body {
  background: #fff;
  padding: 22pt 28pt;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.cover__entity-row {
  display: flex;
  align-items: center;
  gap: 12pt;
  padding-bottom: 14pt;
  margin-bottom: 14pt;
  border-bottom: 1pt solid ${BRAND.borderLight};
}
.cover__entity-name {
  font-size: 22pt;
  font-weight: 700;
  color: ${BRAND.forestGreen};
  line-height: 1.1;
  font-family: Georgia, 'Times New Roman', serif;
}
.cover__entity-sub {
  font-size: 9pt;
  color: ${BRAND.textMuted};
  margin-top: 2pt;
}
.cover__period {
  font-size: 13pt;
  font-weight: 600;
  color: ${BRAND.textSecondary};
  margin-bottom: 16pt;
}
.cover__meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10pt;
  margin-bottom: 16pt;
}
.cover__meta-cell {
  padding: 9pt 10pt;
  background: ${BRAND.bgLight};
  border: 1pt solid ${BRAND.borderLight};
  border-radius: 4pt;
  border-left: 3pt solid ${primaryColor};
}
.cover__meta-label {
  font-size: 7pt;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${BRAND.textFaint};
  margin-bottom: 3pt;
}
.cover__meta-value {
  font-size: 9pt;
  font-weight: 600;
  color: ${BRAND.textPrimary};
}
.cover__entity-chips { display: flex; flex-wrap: wrap; gap: 5pt; margin-bottom: 10pt; }
.cover__entity-chip {
  display: inline-flex; align-items: center; gap: 5pt;
  padding: 4pt 8pt;
  background: ${BRAND.bgMid};
  border: 1pt solid ${BRAND.borderLight};
  border-radius: 3pt;
  font-size: 8pt;
  font-weight: 600;
  color: ${BRAND.textSecondary};
}
.cover__footer {
  margin-top: auto;
  padding-top: 10pt;
  border-top: 1pt solid ${BRAND.borderLight};
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 7.5pt;
  color: ${BRAND.textFaint};
}
.cover__confidential {
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${BRAND.textMuted};
  padding: 3pt 8pt;
  border: 1pt solid ${BRAND.borderMid};
  border-radius: 2pt;
}

/* ── Section banner ──────────────────────────────────── */
.sect-banner {
  page-break-after: avoid;
  break-after: avoid;
  margin-bottom: 14pt;
  display: flex;
  align-items: stretch;
  gap: 0;
}
.sect-banner__num {
  width: 30pt;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24pt;
  font-weight: 900;
  color: rgba(255,255,255,0.25);
  font-family: Georgia, serif;
  flex-shrink: 0;
}
.sect-banner__bar {
  width: 5pt;
  border-radius: 2pt 0 0 2pt;
  flex-shrink: 0;
}
.sect-banner__content {
  flex: 1;
  padding: 8pt 12pt 7pt;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.sect-banner__title {
  font-size: 11.5pt;
  font-weight: 700;
  font-family: Georgia, 'Times New Roman', serif;
  line-height: 1.1;
}
.sect-banner__subtitle {
  font-size: 7.5pt;
  opacity: 0.75;
  margin-top: 2pt;
}

/* ── KPI cards ───────────────────────────────────────── */
.kpi-grid { display: grid; gap: 8pt; }
.kpi-grid--2 { grid-template-columns: repeat(2, 1fr); }
.kpi-grid--3 { grid-template-columns: repeat(3, 1fr); }
.kpi-grid--4 { grid-template-columns: repeat(4, 1fr); }
.kpi-grid--5 { grid-template-columns: repeat(5, 1fr); }
.kpi-grid--6 { grid-template-columns: repeat(6, 1fr); }

.kpi-card {
  background: #fff;
  border: 1pt solid ${BRAND.borderLight};
  border-radius: 4pt;
  padding: 9pt 10pt 7pt;
  display: flex;
  flex-direction: column;
  gap: 2pt;
  page-break-inside: avoid;
  break-inside: avoid;
}
.kpi-card--primary {
  border-top: 3pt solid ${primaryColor};
}
.kpi-card--accent {
  background: ${BRAND.bgLight};
  border-top: 3pt solid ${primaryColor};
}
.kpi-card--positive {
  border-top: 3pt solid ${BRAND.positive};
}
.kpi-card--negative {
  border-top: 3pt solid ${BRAND.negative};
  background: #fef2f2;
}
.kpi-card--warning {
  border-top: 3pt solid ${BRAND.warning};
  background: #fffbeb;
}
.kpi-card__label {
  font-size: 6.5pt;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${BRAND.textFaint};
  font-weight: 600;
  line-height: 1;
}
.kpi-card__value {
  font-size: 16pt;
  font-weight: 700;
  color: ${BRAND.textPrimary};
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.kpi-card__value--lg {
  font-size: 20pt;
}
.kpi-card__sub {
  font-size: 7pt;
  color: ${BRAND.textMuted};
  margin-top: 1pt;
}
.kpi-card__change {
  display: flex;
  align-items: center;
  gap: 4pt;
  margin-top: 2pt;
}

/* ── Variance pills ──────────────────────────────────── */
.vpill {
  display: inline-block;
  padding: 1.5pt 5pt;
  border-radius: 10pt;
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.vpill--pos { background: #dcfce7; color: #166534; }
.vpill--neg { background: #fee2e2; color: #b91c1c; }
.vpill--na  { background: ${BRAND.bgMid}; color: ${BRAND.textFaint}; }

/* ── Financial table ─────────────────────────────────── */
.fin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8pt;
  font-variant-numeric: tabular-nums;
  margin-bottom: 10pt;
}
.fin-table thead tr {
  background: ${BRAND.forestGreen};
}
.fin-table thead tr th {
  padding: 6pt 9pt;
  color: #fff;
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: left;
  border: none;
  white-space: nowrap;
}
.fin-table thead tr th.num {
  text-align: right;
}
.fin-table thead tr.fin-table__subhead th {
  background: #1a3d2b;
  font-size: 6.5pt;
  padding: 4pt 9pt;
}

/* Statement row types */
.fin-table tbody tr td {
  padding: 4.5pt 9pt;
  border-bottom: 0.5pt solid ${BRAND.borderLight};
  color: ${BRAND.textPrimary};
  vertical-align: middle;
}
.fin-table tbody tr td.num {
  text-align: right;
  font-family: 'Courier New', 'Lucida Console', monospace;
  font-size: 7.5pt;
  letter-spacing: 0;
}
.fin-table tbody tr.row--section {
  background: ${BRAND.bgMid};
}
.fin-table tbody tr.row--section td {
  font-weight: 700;
  font-size: 7pt;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${BRAND.forestGreen};
  padding: 5pt 9pt;
  border-bottom: none;
  border-top: 1pt solid ${BRAND.borderMid};
}
.fin-table tbody tr.row--section td::before {
  content: "";
  display: inline-block;
  width: 3pt;
  height: 9pt;
  background: ${primaryColor};
  margin-right: 6pt;
  border-radius: 1pt;
  vertical-align: middle;
}
.fin-table tbody tr.row--indent td:first-child { padding-left: 18pt; }
.fin-table tbody tr.row--indent2 td:first-child { padding-left: 30pt; }
.fin-table tbody tr.row--indent td.no-pad,
.fin-table tbody tr.row--indent2 td.no-pad { padding-left: 9pt; }

.fin-table tbody tr.row--subtotal {
  background: ${BRAND.bgLight};
}
.fin-table tbody tr.row--subtotal td {
  font-weight: 700;
  border-top: 1pt solid ${BRAND.borderMid};
  border-bottom: 1pt solid ${BRAND.borderMid};
  padding: 5pt 9pt;
}
.fin-table tbody tr.row--total {
  background: ${BRAND.bgMid};
}
.fin-table tbody tr.row--total td {
  font-weight: 700;
  font-size: 8.5pt;
  border-top: 1.5pt solid ${BRAND.forestGreen};
  border-bottom: 3pt double ${BRAND.forestGreen};
  padding: 5.5pt 9pt;
}
.fin-table tbody tr.row--spacer td {
  border-bottom: none;
  padding: 3pt 9pt;
}

/* Amount coloring */
.amount--negative { color: ${BRAND.negative}; }
.amount--positive { color: inherit; }
.amount--unavailable { color: ${BRAND.textFaint}; }

/* Variance coloring */
.variance--fav     { color: ${BRAND.positive}; font-weight: 600; }
.variance--unfav   { color: ${BRAND.negative}; font-weight: 600; }
.variance--neutral { color: ${BRAND.textMuted}; }
.variance--na      { color: ${BRAND.textFaint}; }

/* ── Badges ──────────────────────────────────────────── */
.badge {
  display: inline-block;
  padding: 2pt 7pt;
  border-radius: 10pt;
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}
.badge--green  { background: #dcfce7; color: #166534; }
.badge--red    { background: #fee2e2; color: #b91c1c; }
.badge--amber  { background: #fef3c7; color: #92400e; }
.badge--blue   { background: #dbeafe; color: #1e40af; }
.badge--purple { background: #ede9fe; color: #6d28d9; }
.badge--gray   { background: #f1f5f9; color: #475569; }
.badge--teal   { background: #ccfbf1; color: #0f766e; }

/* ── Insight / callout blocks ────────────────────────── */
.insight {
  display: flex;
  gap: 10pt;
  padding: 10pt 12pt;
  border-radius: 4pt;
  border-left: 4pt solid;
  margin-bottom: 8pt;
  page-break-inside: avoid;
}
.insight--positive { background: #f0fdf4; border-color: ${BRAND.positive}; }
.insight--warning  { background: #fffbeb; border-color: ${BRAND.warning}; }
.insight--critical { background: #fef2f2; border-color: ${BRAND.negative}; }
.insight--info     { background: #eff6ff; border-color: ${BRAND.info}; }
.insight--neutral  { background: ${BRAND.bgLight}; border-color: ${BRAND.borderMid}; }
.insight__icon     { font-size: 11pt; flex-shrink: 0; line-height: 1.4; }
.insight__title    { font-weight: 700; font-size: 8.5pt; margin-bottom: 2pt; }
.insight__text     { font-size: 8pt; color: ${BRAND.textSecondary}; line-height: 1.45; }

/* ── Alert severity cards ────────────────────────────── */
.alert-card {
  display: flex;
  gap: 10pt;
  padding: 9pt 12pt;
  border-radius: 4pt;
  border-left: 4pt solid;
  margin-bottom: 7pt;
  page-break-inside: avoid;
  break-inside: avoid;
  background: #fff;
  border: 1pt solid ${BRAND.borderLight};
}
.alert-card--critical { border-left-color: ${BRAND.negative}; background: #fff8f8; }
.alert-card--high     { border-left-color: #ea580c; background: #fff7f0; }
.alert-card--medium   { border-left-color: ${BRAND.warning}; background: #fffdf0; }
.alert-card--low      { border-left-color: #64748b; background: ${BRAND.bgLight}; }
.alert-card__severity { flex-shrink: 0; padding-top: 1pt; }
.alert-card__body     { flex: 1; }
.alert-card__entity   { font-size: 7pt; color: ${BRAND.textMuted}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2pt; }
.alert-card__title    { font-size: 9pt; font-weight: 700; color: ${BRAND.textPrimary}; margin-bottom: 3pt; }
.alert-card__desc     { font-size: 8pt; color: ${BRAND.textSecondary}; margin-bottom: 4pt; line-height: 1.4; }
.alert-card__meta     { font-size: 7.5pt; color: ${BRAND.textMuted}; }
.alert-card__action   { font-size: 8pt; color: ${BRAND.info}; font-weight: 600; margin-top: 4pt; }

/* ── Entity comparison table ─────────────────────────── */
.entity-table thead th { font-size: 7pt; }
.entity-table td.entity-name-cell { font-weight: 700; }
.entity-logo-cell img { height: 18pt; width: auto; max-width: 40pt; object-fit: contain; }

/* ── Status / progress blocks ────────────────────────── */
.status-block {
  display: flex;
  gap: 8pt;
  align-items: center;
  padding: 8pt 10pt;
  border-radius: 4pt;
  border: 1pt solid;
  margin-bottom: 6pt;
  page-break-inside: avoid;
}
.status-block--pass { background: #f0fdf4; border-color: #86efac; }
.status-block--fail { background: #fef2f2; border-color: #fca5a5; }
.status-block--warn { background: #fffbeb; border-color: #fcd34d; }
.status-block--gray { background: ${BRAND.bgLight}; border-color: ${BRAND.borderLight}; }
.status-block__icon { font-size: 12pt; flex-shrink: 0; }
.status-block__title { font-weight: 700; font-size: 8.5pt; }
.status-block__sub   { font-size: 7.5pt; color: ${BRAND.textMuted}; margin-top: 1pt; }

/* ── Chart containers ────────────────────────────────── */
.chart-box {
  background: ${BRAND.bgLight};
  border: 1pt solid ${BRAND.borderLight};
  border-radius: 4pt;
  padding: 10pt 12pt;
  margin-bottom: 10pt;
  page-break-inside: avoid;
}
.chart-box__title {
  font-size: 8pt;
  font-weight: 700;
  color: ${BRAND.textSecondary};
  margin-bottom: 8pt;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.chart-box__subtitle {
  font-size: 7pt;
  color: ${BRAND.textFaint};
  margin-top: -6pt;
  margin-bottom: 8pt;
}

/* ── Two/three column layouts ────────────────────────── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10pt; }
.col-60-40 { display: grid; grid-template-columns: 60fr 40fr; gap: 12pt; }
.col-55-45 { display: grid; grid-template-columns: 55fr 45fr; gap: 12pt; }
.col-40-60 { display: grid; grid-template-columns: 40fr 60fr; gap: 12pt; }

/* ── Divider ─────────────────────────────────────────── */
.divider {
  border: none;
  border-top: 1pt solid ${BRAND.borderLight};
  margin: 10pt 0;
}
.divider--heavy {
  border-top: 2pt solid ${BRAND.borderMid};
}

/* ── Data footer ─────────────────────────────────────── */
.data-footer {
  font-size: 6.5pt;
  color: ${BRAND.textFaint};
  text-align: right;
  padding-top: 6pt;
  border-top: 0.5pt solid ${BRAND.borderLight};
  margin-top: 10pt;
  letter-spacing: 0.02em;
}

/* ── Legend ──────────────────────────────────────────── */
.legend { display: flex; flex-wrap: wrap; gap: 8pt; margin-top: 6pt; }
.legend__item { display: flex; align-items: center; gap: 4pt; font-size: 7pt; color: ${BRAND.textSecondary}; }
.legend__dot  { width: 8pt; height: 8pt; border-radius: 50%; flex-shrink: 0; }
.legend__line { width: 14pt; height: 2pt; border-radius: 1pt; flex-shrink: 0; }

/* ── Utility spacing ─────────────────────────────────── */
.mb-4  { margin-bottom: 4pt; }
.mb-8  { margin-bottom: 8pt; }
.mb-12 { margin-bottom: 12pt; }
.mb-16 { margin-bottom: 16pt; }
.mt-8  { margin-top: 8pt; }
.mt-12 { margin-top: 12pt; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.font-mono { font-family: 'Courier New', 'Lucida Console', monospace; }
.nowrap { white-space: nowrap; }
.small { font-size: 7pt; color: ${BRAND.textMuted}; }

/* ── Aging bar ────────────────────────────────────────── */
.aging-bar { display: flex; height: 8pt; border-radius: 4pt; overflow: hidden; margin: 3pt 0; }
.aging-bar__seg { height: 100%; }

/* ── Scorecard ───────────────────────────────────────── */
.scorecard {
  border: 1.5pt solid ${BRAND.borderMid};
  border-radius: 6pt;
  overflow: hidden;
  margin-bottom: 12pt;
  page-break-inside: avoid;
}
.scorecard__header {
  padding: 10pt 14pt 9pt;
  display: flex;
  align-items: center;
  gap: 12pt;
}
.scorecard__name {
  font-size: 14pt;
  font-weight: 700;
  font-family: Georgia, serif;
  color: #fff;
}
.scorecard__sub {
  font-size: 7.5pt;
  color: rgba(255,255,255,0.75);
  margin-top: 1pt;
}
.scorecard__body { padding: 12pt 14pt; }

/* ── Section wrapper ─────────────────────────────────── */
.section { margin-bottom: 0; }
.section--break { page-break-before: always; break-before: page; }
</style>`;
}

// ─── Component builders ───────────────────────────────────────────────────────

export function pageHeader(
  opts: {
    reportTitle: string;
    entityName: string;
    period: string;
    logoPath?: string | null;
    logoFallback?: string;
    primaryColor?: string;
  },
): string {
  const color = opts.primaryColor ?? BRAND.forestGreen;
  const src = embedLogoPath(opts.logoPath ?? null);
  const logoHtml = src
    ? `<img class="page-hdr__logo" src="${src}" alt="${escHtml(opts.entityName)}" style="height:20pt;width:auto;object-fit:contain;display:block" />`
    : `<span class="page-hdr__logo--fallback" style="background:${escHtml(color)}">${escHtml((opts.logoFallback ?? opts.entityName).slice(0, 2).toUpperCase())}</span>`;

  return `
<div class="page-hdr no-break">
  ${logoHtml}
  <div class="page-hdr__center">${escHtml(opts.reportTitle)}</div>
  <div class="page-hdr__right">${escHtml(opts.entityName)} &middot; ${escHtml(opts.period)}</div>
</div>`;
}

export function sectionBanner(
  title: string,
  opts: {
    subtitle?: string;
    number?: number | string;
    bgColor?: string;
    accentColor?: string;
    textColor?: string;
  } = {},
): string {
  const bg = opts.bgColor ?? BRAND.forestGreen;
  const accent = opts.accentColor ?? BRAND.darkGreen;
  const text = opts.textColor ?? "#fff";
  const numHtml = opts.number != null
    ? `<div class="sect-banner__num" style="color:rgba(255,255,255,0.18);background:rgba(0,0,0,0.15)">${opts.number}</div>`
    : "";

  return `
<div class="sect-banner no-break" style="background:${escHtml(bg)};border-radius:4pt;margin-bottom:14pt;overflow:hidden">
  ${numHtml}
  <div class="sect-banner__bar" style="background:${escHtml(accent)}"></div>
  <div class="sect-banner__content">
    <div class="sect-banner__title" style="color:${escHtml(text)}">${escHtml(title)}</div>
    ${opts.subtitle ? `<div class="sect-banner__subtitle" style="color:rgba(255,255,255,0.7)">${escHtml(opts.subtitle)}</div>` : ""}
  </div>
</div>`;
}

export function kpiCard(
  label: string,
  valueHtml: string,
  opts: {
    sub?: string;
    changeHtml?: string;
    accent?: boolean;
    variant?: "primary" | "positive" | "negative" | "warning" | "default";
    size?: "sm" | "md" | "lg";
  } = {},
): string {
  const variantClass = opts.variant === "positive" ? "kpi-card--positive"
    : opts.variant === "negative" ? "kpi-card--negative"
    : opts.variant === "warning" ? "kpi-card--warning"
    : opts.variant === "primary" ? "kpi-card--primary"
    : opts.accent ? "kpi-card--accent"
    : "";
  const valClass = opts.size === "lg" ? "kpi-card__value kpi-card__value--lg" : "kpi-card__value";

  return `
<div class="kpi-card ${variantClass} no-break">
  <div class="kpi-card__label">${escHtml(label)}</div>
  <div class="${valClass}">${valueHtml}</div>
  ${opts.sub ? `<div class="kpi-card__sub">${escHtml(opts.sub)}</div>` : ""}
  ${opts.changeHtml ? `<div class="kpi-card__change">${opts.changeHtml}</div>` : ""}
</div>`;
}

export function badge(text: string, color: "green" | "red" | "amber" | "blue" | "purple" | "gray" | "teal"): string {
  return `<span class="badge badge--${color}">${escHtml(text)}</span>`;
}

export function insight(
  title: string,
  text: string,
  variant: "positive" | "warning" | "critical" | "info" | "neutral" = "neutral",
): string {
  const icon = variant === "positive" ? "✓" : variant === "critical" ? "⚠" : variant === "warning" ? "⚑" : variant === "info" ? "ℹ" : "•";
  return `
<div class="insight insight--${variant}">
  <span class="insight__icon">${icon}</span>
  <div>
    <div class="insight__title">${escHtml(title)}</div>
    <div class="insight__text">${escHtml(text)}</div>
  </div>
</div>`;
}

export function emptyState(msg: string): string {
  return `<p style="font-size:8pt;color:${BRAND.textFaint};font-style:italic;padding:8pt 0;text-align:center">${escHtml(msg)}</p>`;
}

export function dataFooter(parts: string[]): string {
  return `<div class="data-footer">${parts.map(escHtml).join(" &middot; ")}</div>`;
}

export function sectionHeading(title: string, opts: { number?: number; subtitle?: string } = {}): string {
  const numHtml = opts.number != null ? `<span style="font-size:7pt;font-weight:700;color:${BRAND.textFaint};letter-spacing:0.1em;text-transform:uppercase;margin-right:6pt">${opts.number}.</span>` : "";
  return `
<div class="no-break" style="margin-bottom:10pt;padding-bottom:6pt;border-bottom:1pt solid ${BRAND.borderLight}">
  <div style="font-size:11pt;font-weight:700;font-family:Georgia,serif;color:${BRAND.textPrimary}">${numHtml}${escHtml(title)}</div>
  ${opts.subtitle ? `<div style="font-size:7.5pt;color:${BRAND.textMuted};margin-top:2pt">${escHtml(opts.subtitle)}</div>` : ""}
</div>`;
}

export function barRow(
  label: string,
  value: number | null | undefined,
  maxValue: number,
  displayValue: string,
  color: string = BRAND.darkGreen,
): string {
  const pct = value != null && maxValue > 0 ? Math.min(Math.abs(value) / Math.max(Math.abs(maxValue), 1) * 100, 100) : 0;
  const isNeg = (value ?? 0) < 0;
  return `
<div style="display:flex;align-items:center;gap:8pt;margin-bottom:5pt;font-size:7.5pt">
  <div style="width:80pt;text-align:right;color:${BRAND.textSecondary};flex-shrink:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${escHtml(label)}</div>
  <div style="flex:1;height:8pt;background:${BRAND.bgMid};border-radius:4pt;overflow:hidden">
    <div style="width:${pct.toFixed(1)}%;height:100%;background:${isNeg ? BRAND.negative : color};border-radius:4pt"></div>
  </div>
  <div style="width:54pt;font-weight:600;color:${isNeg ? BRAND.negative : BRAND.textPrimary};font-size:7pt;flex-shrink:0">${escHtml(displayValue)}</div>
</div>`;
}

export function agingBars(
  buckets: { label: string; amount: number; color: string }[],
): string {
  const total = buckets.reduce((s, b) => s + Math.max(b.amount, 0), 0);
  if (total <= 0) return "";
  return `<div class="aging-bar">
    ${buckets.map((b) => {
      const pct = (Math.max(b.amount, 0) / total * 100).toFixed(1);
      return `<div class="aging-bar__seg" style="width:${pct}%;background:${b.color}" title="${escHtml(b.label)}: ${fmtCurrency(b.amount)}"></div>`;
    }).join("")}
  </div>`;
}

/** Legend row for charts */
export function legendItems(
  items: { label: string; color: string; type?: "dot" | "line" }[],
): string {
  return `<div class="legend">${items.map((item) =>
    `<div class="legend__item">
      <div class="${item.type === "line" ? "legend__line" : "legend__dot"}" style="background:${item.color}"></div>
      <span>${escHtml(item.label)}</span>
    </div>`
  ).join("")}</div>`;
}
