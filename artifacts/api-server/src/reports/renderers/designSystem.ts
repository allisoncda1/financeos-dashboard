/**
 * FinanceOS Report Design System — v3
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
 *                   – NEW: refPageHeader, refSectionHeader, refKpiRow,
 *                     refInsightPanel, refRecommendationCallout, refNarrative,
 *                     refSmallNote, refSubHeading
 *                   – NEW SVGs: svgSimpleBars, svgGroupedBars, svgHBarRef, svgLineRef
 */

import { readFileSync, statSync } from "fs";
import { resolve, join, sep, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ─── Logo root resolution (path-safe, env-overridable) ───────────────────────
//
// When esbuild bundles all modules into dist/index.mjs, import.meta.url
// resolves to the bundle location (artifacts/api-server/dist/), not the
// original source file. The "../../../../" path only works from the source
// tree. We probe multiple candidate paths and use the first that exists on
// disk. An env var override wins above all.

function _findLogoRoot(): string {
  if (process.env.FINANCEOS_PUBLIC_DIR) return process.env.FINANCEOS_PUBLIC_DIR;

  const candidates = [
    // ESM bundle at dist/index.mjs → artifacts/api-server/dist/ → ../../financeos/public
    resolve(__dirname, "../../financeos/public"),
    // Source: src/reports/renderers/ → ../../../../financeos/public
    resolve(__dirname, "../../../../financeos/public"),
    // Replit: workspace root may be different
    resolve(__dirname, "../../../../../financeos/public"),
    resolve(process.cwd(), "artifacts/financeos/public"),
    resolve(process.cwd(), "financeos/public"),
  ];

  for (const candidate of candidates) {
    try {
      const st = statSync(candidate);
      if (st.isDirectory()) return candidate;
    } catch { /* not found */ }
  }

  // Return first candidate as fallback (will likely fail — logged at read time)
  return candidates[0]!;
}

const _LOGO_ROOT = _findLogoRoot();

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
  sectionExec:    "#0f2e1f",
  sectionPerf:    "#1e3a5f",
  sectionPnL:     "#1e293b",
  sectionBS:      "#1e3a5f",
  sectionCF:      "#134e4a",
  sectionARAP:    "#3b0764",
  sectionAlerts:  "#7c2d12",
  sectionInteg:   "#1e293b",

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

  // v3 additions
  accent:         "#2563eb",
  coverBg:        "#0f172a",
} as const;

// ─── Logo embed (path-safe, cached) ──────────────────────────────────────────

const _LOGO_CACHE = new Map<string, string | null>();

export function embedLogoPath(logoPath: string | null): string | null {
  if (!logoPath) return null;
  if (_LOGO_CACHE.has(logoPath)) return _LOGO_CACHE.get(logoPath) ?? null;
  try {
    const relative = logoPath.replace(/^\//, "");
    const diskPath = resolve(join(_LOGO_ROOT, relative));
    // Path-traversal guard
    if (!diskPath.startsWith(_LOGO_ROOT + sep)) { _LOGO_CACHE.set(logoPath, null); return null; }
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
  const cssClass = isNeg !== invertColor ? "amount--negative" : "amount--positive";
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

/** SVG line/area chart for trend data. Improved with data labels and $K Y-axis grid. */
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
  const W = opts.width ?? 380;
  const H = opts.height ?? 120;
  const color = opts.color ?? BRAND.accent;
  const valid = data.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length < 2) return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="9" fill="${BRAND.textFaint}">No trend data</text></svg>`;

  const PAD_L = 42;
  const PAD_R = 12;
  const PAD_T = 18;
  const PAD_B = opts.labels ? 22 : 10;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  // Nice Y axis ticks
  const gridLevels = 4;
  const gridLines: string[] = [];
  const gridLabels: string[] = [];
  for (let i = 0; i <= gridLevels; i++) {
    const frac = i / gridLevels;
    const val = min + frac * range;
    const y = PAD_T + chartH - frac * chartH;
    gridLines.push(`<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${(W - PAD_R).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#f3f4f6" stroke-width="0.75" />`);
    const labelTxt = Math.abs(val) >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val.toFixed(0)}`;
    gridLabels.push(`<text x="${(PAD_L - 4).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="6.5" fill="${BRAND.textFaint}">${escHtml(labelTxt)}</text>`);
  }

  const pts: { x: number; y: number; v: number }[] = [];
  data.forEach((v, i) => {
    if (v !== null && Number.isFinite(v)) {
      const x = PAD_L + (i / (data.length - 1)) * chartW;
      const y = PAD_T + chartH - ((v - min) / range) * chartH;
      pts.push({ x, y, v });
    }
  });

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoly = [
    `${pts[0]!.x.toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
    ...pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${pts[pts.length - 1]!.x.toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
  ].join(" ");

  const fillOpacity = opts.fillOpacity ?? 0.10;

  const dotEls = (opts.showDots !== false && pts.length <= 14)
    ? pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}" />`).join("")
    : "";

  // Data labels above dots
  const dataLabels = (opts.showDots !== false && pts.length <= 14)
    ? pts.map((p) => {
        const lbl = Math.abs(p.v) >= 1000 ? `$${(p.v / 1000).toFixed(0)}K` : `$${p.v.toFixed(0)}`;
        return `<text x="${p.x.toFixed(1)}" y="${(p.y - 6).toFixed(1)}" text-anchor="middle" font-size="6.5" font-weight="600" fill="${color}">${escHtml(lbl)}</text>`;
      }).join("")
    : "";

  let labelHtml = "";
  if (opts.labels && opts.labels.length > 0) {
    const step = data.length > 1 ? chartW / (data.length - 1) : chartW;
    labelHtml = opts.labels.map((lbl, i) => {
      const x = PAD_L + i * step;
      return `<text x="${x.toFixed(1)}" y="${(H - 3).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="${BRAND.textFaint}">${escHtml(lbl)}</text>`;
    }).join("");
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${PAD_L}" y="${PAD_T}" width="${chartW}" height="${chartH}" fill="#f9fafb" />
    ${gridLines.join("")}
    ${gridLabels.join("")}
    <polygon points="${areaPoly}" fill="${color}" opacity="${fillOpacity}" />
    <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" />
    ${dotEls}
    ${dataLabels}
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

  const points: { start: number; end: number; label: string; color: string; isTotal: boolean }[] = [];
  let running = 0;
  for (const bar of bars) {
    if (bar.isTotal) {
      points.push({ start: 0, end: bar.value, label: bar.label, color: bar.color ?? BRAND.accent, isTotal: true });
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

    const labelY = H - PAD_B + 12;
    labelsHtml += `<text x="${(x + barW / 2).toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="6.5" fill="${BRAND.textSecondary}">${escHtml(p.label)}</text>`;

    const valY = y1 - 3;
    const valText = fmtCurrency(p.isTotal ? p.end : p.end - p.start, { compact: true });
    const valColor = p.isTotal ? BRAND.textPrimary : p.color;
    labelsHtml += `<text x="${(x + barW / 2).toFixed(1)}" y="${valY.toFixed(1)}" text-anchor="middle" font-size="6.5" font-weight="600" fill="${valColor}">${escHtml(valText)}</text>`;

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
    const color = bar.color ?? BRAND.accent;
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

// ─── NEW SVG charts ───────────────────────────────────────────────────────────

/** Simple vertical bar chart matching reference style. */
export function svgSimpleBars(
  data: { label: string; value: number }[],
  opts: {
    width?: number;
    height?: number;
    color?: string;
    unit?: string;
    title?: string;
  } = {},
): string {
  const W = opts.width ?? 380;
  const H = opts.height ?? 160;
  const color = opts.color ?? BRAND.accent;
  const PAD_L = 42;
  const PAD_R = 10;
  const PAD_T = opts.title ? 22 : 16;
  const PAD_B = 22;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (data.length === 0) {
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="9" fill="${BRAND.textFaint}">No data</text></svg>`;
  }

  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const gridLevels = 4;
  const gridLines: string[] = [];
  const gridLabels: string[] = [];
  for (let i = 0; i <= gridLevels; i++) {
    const frac = i / gridLevels;
    const val = frac * maxVal;
    const y = PAD_T + chartH - frac * chartH;
    gridLines.push(`<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${(W - PAD_R).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5" />`);
    const labelTxt = val >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val.toFixed(0)}`;
    gridLabels.push(`<text x="${(PAD_L - 4).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="6.5" fill="#9ca3af">${escHtml(labelTxt)}</text>`);
  }

  const barW = Math.max((chartW / data.length) * 0.6, 4);
  const slot = chartW / data.length;

  let bars = "";
  let labels = "";
  let dataLabels = "";
  data.forEach((d, i) => {
    const x = PAD_L + i * slot + (slot - barW) / 2;
    const barH = Math.max((Math.abs(d.value) / maxVal) * chartH, 1);
    const y = PAD_T + chartH - barH;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" rx="2" />`;
    // Label above bar
    const lbl = Math.abs(d.value) >= 1000 ? `$${(d.value / 1000).toFixed(0)}K` : `$${d.value.toFixed(0)}`;
    dataLabels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="6.5" font-weight="600" fill="${color}">${escHtml(lbl)}</text>`;
    // X label
    labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(H - 4).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="#6b7280">${escHtml(d.label)}</text>`;
  });

  const titleEl = opts.title ? `<text x="${PAD_L}" y="12" font-size="8" font-weight="600" fill="#374151">${escHtml(opts.title)}</text>` : "";

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${PAD_L}" y="${PAD_T}" width="${chartW}" height="${chartH}" fill="#f3f4f6" />
    ${titleEl}
    ${gridLines.join("")}
    ${gridLabels.join("")}
    ${bars}
    ${dataLabels}
    ${labels}
  </svg>`;
}

/** Grouped vertical bar chart (e.g. prior vs current). */
export function svgGroupedBars(
  groups: string[],
  series: { label: string; color: string; values: number[] }[],
  opts: {
    width?: number;
    height?: number;
    unit?: string;
    title?: string;
  } = {},
): string {
  const W = opts.width ?? 380;
  const H = opts.height ?? 160;
  const PAD_L = 42;
  const PAD_R = 10;
  const PAD_T = opts.title ? 22 : 16;
  const PAD_B = 26;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  if (groups.length === 0 || series.length === 0) {
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="9" fill="${BRAND.textFaint}">No data</text></svg>`;
  }

  const allVals = series.flatMap((s) => s.values.map(Math.abs));
  const maxVal = Math.max(...allVals, 1);

  const gridLevels = 4;
  const gridLines: string[] = [];
  const gridLabels: string[] = [];
  for (let i = 0; i <= gridLevels; i++) {
    const frac = i / gridLevels;
    const val = frac * maxVal;
    const y = PAD_T + chartH - frac * chartH;
    gridLines.push(`<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${(W - PAD_R).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5" />`);
    const labelTxt = val >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val.toFixed(0)}`;
    gridLabels.push(`<text x="${(PAD_L - 4).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="6.5" fill="#9ca3af">${escHtml(labelTxt)}</text>`);
  }

  const slot = chartW / groups.length;
  const groupPad = slot * 0.12;
  const barW = Math.max((slot - groupPad * 2) / series.length, 3);

  let bars = "";
  let xlabels = "";
  let dataLabels = "";

  groups.forEach((grp, gi) => {
    const groupX = PAD_L + gi * slot + groupPad;
    series.forEach((s, si) => {
      const val = s.values[gi] ?? 0;
      const x = groupX + si * barW;
      const barH = Math.max((Math.abs(val) / maxVal) * chartH, 1);
      const y = PAD_T + chartH - barH;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW - 1).toFixed(1)}" height="${barH.toFixed(1)}" fill="${s.color}" rx="1.5" />`;
      const lbl = Math.abs(val) >= 1000 ? `$${(val / 1000).toFixed(0)}K` : `$${val.toFixed(0)}`;
      dataLabels += `<text x="${(x + (barW - 1) / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="5.5" fill="${s.color}">${escHtml(lbl)}</text>`;
    });
    const midX = groupX + (series.length * barW) / 2;
    xlabels += `<text x="${midX.toFixed(1)}" y="${(H - 10).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="#6b7280">${escHtml(grp)}</text>`;
  });

  // Legend
  const legendY = H - 2;
  const legendItems = series.map((s, i) => {
    const lx = PAD_L + i * 70;
    return `<rect x="${lx}" y="${(legendY - 7).toFixed(1)}" width="8" height="6" fill="${s.color}" rx="1" /><text x="${(lx + 11).toFixed(1)}" y="${legendY.toFixed(1)}" font-size="6.5" fill="#6b7280">${escHtml(s.label)}</text>`;
  }).join("");

  const titleEl = opts.title ? `<text x="${PAD_L}" y="12" font-size="8" font-weight="600" fill="#374151">${escHtml(opts.title)}</text>` : "";

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${PAD_L}" y="${PAD_T}" width="${chartW}" height="${chartH}" fill="#f3f4f6" />
    ${titleEl}
    ${gridLines.join("")}
    ${gridLabels.join("")}
    ${bars}
    ${dataLabels}
    ${xlabels}
    ${legendItems}
  </svg>`;
}

/** Horizontal bar chart matching reference "Top 5 Customers" style. */
export function svgHBarRef(
  items: { label: string; value: number; color?: string }[],
  opts: {
    width?: number;
    height?: number;
    unit?: string;
    maxValue?: number;
  } = {},
): string {
  const W = opts.width ?? 380;
  const rowH = 22;
  const PAD_L = 100;
  const PAD_R = 60;
  const H = items.length * rowH + 8;
  const chartW = W - PAD_L - PAD_R;
  const maxVal = opts.maxValue ?? Math.max(...items.map((d) => Math.abs(d.value)), 1);

  let rows = "";
  items.forEach((item, i) => {
    const y = i * rowH + 4;
    const barH = 11;
    const barY = y + (rowH - barH) / 2;
    const bw = Math.max((Math.abs(item.value) / maxVal) * chartW, 1);
    const color = item.color ?? BRAND.accent;
    const valLbl = Math.abs(item.value) >= 1000 ? `$${(item.value / 1000).toFixed(0)}K` : `$${item.value.toFixed(0)}`;

    rows += `
      <text x="${(PAD_L - 6).toFixed(1)}" y="${(barY + barH * 0.75).toFixed(1)}" text-anchor="end" font-size="7.5" fill="#374151">${escHtml(item.label)}</text>
      <rect x="${PAD_L}" y="${barY.toFixed(1)}" width="${bw.toFixed(1)}" height="${barH}" fill="${color}" rx="2" />
      <text x="${(PAD_L + bw + 5).toFixed(1)}" y="${(barY + barH * 0.75).toFixed(1)}" font-size="7.5" font-weight="600" fill="#374151">${escHtml(valLbl)}</text>`;
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${rows}
  </svg>`;
}

/** Line chart with shaded area, data labels, and grid — reference "Cash Balance" style. */
export function svgLineRef(
  data: { label: string; value: number }[],
  opts: {
    width?: number;
    height?: number;
    color?: string;
    title?: string;
    yFormat?: "currency" | "percent" | "number";
  } = {},
): string {
  const W = opts.width ?? 380;
  const H = opts.height ?? 160;
  const color = opts.color ?? BRAND.accent;
  const PAD_L = 48;
  const PAD_R = 12;
  const PAD_T = opts.title ? 22 : 18;
  const PAD_B = 22;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const yFmt = opts.yFormat ?? "currency";

  if (data.length < 2) {
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="9" fill="${BRAND.textFaint}">No data</text></svg>`;
  }

  const vals = data.map((d) => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const formatY = (v: number): string => {
    if (yFmt === "currency") return Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`;
    if (yFmt === "percent") return `${v.toFixed(1)}%`;
    return v.toFixed(0);
  };

  const gridLevels = 4;
  const gridLines: string[] = [];
  const gridLabels: string[] = [];
  for (let i = 0; i <= gridLevels; i++) {
    const frac = i / gridLevels;
    const val = minV + frac * range;
    const y = PAD_T + chartH - frac * chartH;
    gridLines.push(`<line x1="${PAD_L}" y1="${y.toFixed(1)}" x2="${(W - PAD_R).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="0.5" />`);
    gridLabels.push(`<text x="${(PAD_L - 4).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="6.5" fill="#9ca3af">${escHtml(formatY(val))}</text>`);
  }

  const pts = data.map((d, i) => ({
    x: PAD_L + (i / (data.length - 1)) * chartW,
    y: PAD_T + chartH - ((d.value - minV) / range) * chartH,
    v: d.value,
    lbl: d.label,
  }));

  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoly = [
    `${pts[0]!.x.toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
    ...pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${pts[pts.length - 1]!.x.toFixed(1)},${(PAD_T + chartH).toFixed(1)}`,
  ].join(" ");

  const dots = pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}" />`).join("");
  const dataLabels = pts.map((p) => `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" text-anchor="middle" font-size="6.5" font-weight="600" fill="${color}">${escHtml(formatY(p.v))}</text>`).join("");
  const xLabels = pts.map((p) => `<text x="${p.x.toFixed(1)}" y="${(H - 4).toFixed(1)}" text-anchor="middle" font-size="6.5" fill="#6b7280">${escHtml(p.lbl)}</text>`).join("");

  const titleEl = opts.title ? `<text x="${PAD_L}" y="12" font-size="8" font-weight="600" fill="#374151">${escHtml(opts.title)}</text>` : "";

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${PAD_L}" y="${PAD_T}" width="${chartW}" height="${chartH}" fill="#f9fafb" />
    ${titleEl}
    ${gridLines.join("")}
    ${gridLabels.join("")}
    <polygon points="${areaPoly}" fill="${color}" opacity="0.08" />
    <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round" />
    ${dots}
    ${dataLabels}
    ${xLabels}
  </svg>`;
}

// ─── CSS Design System ────────────────────────────────────────────────────────

export function buildBaseStyles(accentColor: string): string {
  return `<style>
/* ── Reset & print ───────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

@page { size: A4; background: #fff; margin: 16mm 18mm; }
/* Cover page: zero margins so dark background fills the full A4 sheet */
@page :first { margin: 0; }

html, body {
  background: #fff;
  color: #111827;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
  line-height: 1.55;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}

/* ── Page break utilities ────────────────────────────── */
.page-break-before { page-break-before: always; break-before: page; }
.page-break-after  { page-break-after:  always; break-after:  page; }
.no-break          { page-break-inside: avoid; break-inside: avoid; }

/* ── Page section ────────────────────────────────────── */
.page-section { page-break-before: always; }
.page-section:first-of-type { page-break-before: auto; }

/* ── Cover page — fixed A4 height, zero-margin first page ─────── */
/* height:297mm matches the full A4 sheet (margins are 0 on page :first) */
.cover {
  background: #0f172a;
  height: 297mm;
  width: 100%;
  padding: 0;
  display: flex;
  flex-direction: column;
  color: #fff;
  page-break-after: always;
  break-after: page;
  overflow: hidden;
}
/* Class names used by buildCover() in monthlyClose.ts */
.cover__strip { height: 6pt; background: var(--entity-color, ${accentColor}); width: 100%; flex-shrink: 0; }
.cover__body { flex: 1; padding: 36pt 40pt 24pt; display: flex; flex-direction: column; gap: 14pt; overflow: hidden; }
.cover__logo-wrap { margin-bottom: 4pt; }
.cover__logo { height: 48pt; max-width: 220pt; object-fit: contain; filter: brightness(0) invert(1); display: block; }
.cover__logo-text { display: inline-flex; align-items: center; justify-content: center; width: 52pt; height: 52pt; border-radius: 8pt; font-size: 22pt; font-weight: 700; color: #fff; }
.cover__eyebrow { font-size: 7.5pt; letter-spacing: 0.12em; color: #94a3b8; text-transform: uppercase; }
.cover__period { font-size: 32pt; font-weight: 300; letter-spacing: -0.02em; line-height: 1.1; font-family: Georgia,'Times New Roman',serif; color: #f1f5f9; }
.cover__subtitle { font-size: 11pt; color: #94a3b8; }
.cover__divider { border: none; border-top: 1px solid #334155; margin: 4pt 0; }
.cover__meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt 24pt; margin-top: 8pt; }
.cover__meta-item {}
.cover__meta-label { font-size: 6.5pt; letter-spacing: 0.10em; color: #64748b; text-transform: uppercase; margin-bottom: 2pt; }
.cover__meta-value { font-size: 9.5pt; color: #e2e8f0; }
/* Logo strip for portfolio cover */
.cover__entity-strip { display: flex; gap: 16pt; align-items: center; flex-wrap: wrap; margin-top: 8pt; }
.cover__entity-logo { height: 24pt; max-width: 80pt; object-fit: contain; filter: brightness(0) invert(1) opacity(0.7); }
.cover__entity-badge { display: inline-flex; align-items: center; justify-content: center; padding: 3pt 8pt; border-radius: 3pt; font-size: 7.5pt; font-weight: 700; color: #fff; opacity: 0.85; }
.cover__footer { padding: 12pt 40pt; font-size: 7.5pt; color: #475569; font-style: italic; border-top: 1px solid #1e293b; flex-shrink: 0; }

/* ── Page header — logo left, report name right, rule below ── */
.page-hdr { display: flex; align-items: center; justify-content: space-between; padding: 14pt 0 10pt; border-bottom: 0.75pt solid #e5e7eb; margin-bottom: 22pt; }
.page-hdr__logo img, .page-hdr__logo-img { height: 18pt; width: auto; object-fit: contain; display: block; }
.page-hdr__logo-text { font-size: 11pt; font-weight: 700; color: #111827; }
.page-hdr__right { font-size: 8pt; color: #9ca3af; }
/* legacy compat */
.page-hdr__logo { height: 20pt; width: auto; object-fit: contain; }
.page-hdr__logo--fallback { height: 20pt; width: 20pt; border-radius: 4pt; display: inline-flex; align-items: center; justify-content: center; background: ${accentColor}; color: #fff; font-weight: 700; font-size: 8pt; }
.page-hdr__center { font-size: 7.5pt; color: #6b7280; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; }

/* ── Section header — number label, big H1, thin rule ── */
.sec-label { font-size: 7.5pt; font-weight: 700; color: #2563eb; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 6pt; }
.sec-title { font-size: 22pt; font-weight: 400; color: #111827; line-height: 1.2; }
.sec-rule { border: none; border-top: 0.75pt solid #e5e7eb; margin: 10pt 0 18pt; }

/* ── Body narrative ──────────────────────────────────── */
.narrative p { font-size: 10pt; color: #111827; line-height: 1.6; margin-bottom: 10pt; }
.narrative p:last-child { margin-bottom: 0; }
p.note { font-size: 8pt; color: #6b7280; font-style: italic; margin-top: 8pt; line-height: 1.5; }

/* ── KPI stat row (inline, no boxes) ─────────────────── */
.kpi-row { display: flex; margin: 16pt 0; }
.kpi-stat { flex: 1; padding-right: 12pt; }
.kpi-stat:last-child { padding-right: 0; }
.kpi-stat__label { font-size: 7.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3pt; }
.kpi-stat__value { font-size: 20pt; font-weight: 700; color: #111827; line-height: 1; }
.kpi-stat__change { font-size: 8pt; margin-top: 4pt; }
.change--pos { color: #2563eb; }
.change--neg { color: #dc2626; }
.change--neu { color: #6b7280; }
.change--green { color: #16a34a; }

/* ── Insight panels (left-border callouts) ───────────── */
.ins-panel { border-left: 3pt solid #2563eb; background: #f8fafc; padding: 11pt 14pt; margin: 10pt 0; position: relative; page-break-inside: avoid; }
.ins-panel--amber { border-color: #d97706; background: #fffbeb; }
.ins-panel--green { border-color: #16a34a; background: #f0fdf4; }
.ins-panel--red { border-color: #dc2626; background: #fef2f2; }
.ins-panel--gray { border-color: #94a3b8; background: #f8fafc; }
.ins-panel__header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5pt; }
.ins-panel__title { font-weight: 700; font-size: 10pt; color: #111827; }
.ins-panel__body { font-size: 9.5pt; color: #374151; line-height: 1.55; }
.ins-panel__badge { font-size: 7.5pt; font-weight: 600; padding: 2pt 8pt; border-radius: 3pt; white-space: nowrap; background: #e5e7eb; color: #374151; }
.ins-panel__badge--green { background: #dcfce7; color: #15803d; }
.ins-panel__badge--amber { background: #fef3c7; color: #b45309; }
.ins-panel__badge--blue { background: #dbeafe; color: #1d4ed8; }
.ins-panel__badge--gray { background: #f3f4f6; color: #6b7280; }

/* ── Recommendation callout ──────────────────────────── */
.rec-callout { border-left: 3pt solid #2563eb; background: #f8fafc; padding: 12pt 14pt; margin: 14pt 0; page-break-inside: avoid; }
.rec-callout__label { font-size: 9pt; font-weight: 700; color: #111827; margin-bottom: 5pt; }
.rec-callout__body { font-size: 9.5pt; color: #374151; line-height: 1.55; }

/* ── Reference-style table (horizontal rules only) ───── */
.ref-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 8pt 0; }
.ref-table th { font-size: 8pt; color: #6b7280; font-weight: 400; text-align: left; padding: 7pt 8pt; border-top: 0.75pt solid #e5e7eb; border-bottom: 0.75pt solid #e5e7eb; }
/* Prevent individual table rows from splitting mid-row; the table itself may span pages */
.ref-table tr { page-break-inside: avoid; break-inside: avoid; }
.ref-table th.num { text-align: right; }
.ref-table td { padding: 7pt 8pt; border-bottom: 0.5pt solid #f3f4f6; color: #111827; vertical-align: top; }
.ref-table tr:last-child td { border-bottom: none; }
.ref-table tr.row-total td { font-weight: 700; border-top: 0.75pt solid #e5e7eb; border-bottom: 0.75pt solid #e5e7eb; }
.ref-table tr.row-subtotal td { font-weight: 600; }
.ref-table tr.row-section td { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; padding-top: 12pt; padding-bottom: 2pt; border-bottom: none; }
.ref-table tr.row-alt td { background: #fafafa; }
.ref-table td.num { text-align: right; }
.ref-table td.neg { color: #dc2626; }
.ref-table td.pos { color: #16a34a; }
.ref-table td.var-pos { color: #2563eb; }
.ref-table td.var-neg { color: #dc2626; }
.ref-table td.var-neu { color: #6b7280; }
.ref-table tfoot td { font-size: 8pt; color: #6b7280; font-style: italic; padding-top: 8pt; border-top: 0.5pt solid #e5e7eb; }

/* ── Legacy financial table ──────────────────────────── */
.fin-table { width: 100%; border-collapse: collapse; font-size: 8pt; font-variant-numeric: tabular-nums; margin-bottom: 10pt; }
.fin-table thead tr { background: ${BRAND.forestGreen}; }
.fin-table thead tr th { padding: 6pt 9pt; color: #fff; font-size: 7pt; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; text-align: left; border: none; white-space: nowrap; }
.fin-table thead tr th.num { text-align: right; }
.fin-table thead tr.fin-table__subhead th { background: #1a3d2b; font-size: 6.5pt; padding: 4pt 9pt; }
.fin-table tbody tr td { padding: 4.5pt 9pt; border-bottom: 0.5pt solid ${BRAND.borderLight}; color: ${BRAND.textPrimary}; vertical-align: middle; }
.fin-table tbody tr td.num { text-align: right; font-family: 'Courier New', 'Lucida Console', monospace; font-size: 7.5pt; letter-spacing: 0; }
.fin-table tbody tr.row--section { background: ${BRAND.bgMid}; }
.fin-table tbody tr.row--section td { font-weight: 700; font-size: 7pt; letter-spacing: 0.06em; text-transform: uppercase; color: ${BRAND.forestGreen}; padding: 5pt 9pt; border-bottom: none; border-top: 1pt solid ${BRAND.borderMid}; }
.fin-table tbody tr.row--indent td:first-child { padding-left: 18pt; }
.fin-table tbody tr.row--indent2 td:first-child { padding-left: 30pt; }
.fin-table tbody tr.row--subtotal { background: ${BRAND.bgLight}; }
.fin-table tbody tr.row--subtotal td { font-weight: 700; border-top: 1pt solid ${BRAND.borderMid}; border-bottom: 1pt solid ${BRAND.borderMid}; padding: 5pt 9pt; }
.fin-table tbody tr.row--total { background: ${BRAND.bgMid}; }
.fin-table tbody tr.row--total td { font-weight: 700; font-size: 8.5pt; border-top: 1.5pt solid ${BRAND.forestGreen}; border-bottom: 3pt double ${BRAND.forestGreen}; padding: 5.5pt 9pt; }
.fin-table tbody tr.row--spacer td { border-bottom: none; padding: 3pt 9pt; }

/* ── Chart containers ────────────────────────────────── */
.chart-wrap { margin: 12pt 0; page-break-inside: avoid; }
.chart-title { font-size: 8.5pt; color: #374151; margin-bottom: 5pt; }
.chart-legend { display: flex; gap: 14pt; font-size: 7.5pt; color: #6b7280; margin-bottom: 6pt; flex-wrap: wrap; }
.legend-swatch { width: 9pt; height: 9pt; border-radius: 1.5pt; display: inline-block; margin-right: 4pt; vertical-align: middle; }
/* legacy chart-box */
.chart-box { background: ${BRAND.bgLight}; border: 1pt solid ${BRAND.borderLight}; border-radius: 4pt; padding: 10pt 12pt; margin-bottom: 10pt; page-break-inside: avoid; }
.chart-box__title { font-size: 8pt; font-weight: 700; color: ${BRAND.textSecondary}; margin-bottom: 8pt; letter-spacing: 0.03em; text-transform: uppercase; }
.chart-box__subtitle { font-size: 7pt; color: ${BRAND.textFaint}; margin-top: -6pt; margin-bottom: 8pt; }

/* ── KPI grid (legacy card style) ───────────────────── */
.kpi-grid { display: grid; gap: 8pt; }
.kpi-grid--2 { grid-template-columns: repeat(2, 1fr); }
.kpi-grid--3 { grid-template-columns: repeat(3, 1fr); }
.kpi-grid--4 { grid-template-columns: repeat(4, 1fr); }
.kpi-grid--5 { grid-template-columns: repeat(5, 1fr); }
.kpi-grid--6 { grid-template-columns: repeat(6, 1fr); }
.kpi-card { background: #fff; border: 1pt solid ${BRAND.borderLight}; border-radius: 4pt; padding: 9pt 10pt 7pt; display: flex; flex-direction: column; gap: 2pt; page-break-inside: avoid; break-inside: avoid; }
.kpi-card--primary { border-top: 3pt solid ${accentColor}; }
.kpi-card--accent { background: ${BRAND.bgLight}; border-top: 3pt solid ${accentColor}; }
.kpi-card--positive { border-top: 3pt solid ${BRAND.positive}; }
.kpi-card--negative { border-top: 3pt solid ${BRAND.negative}; background: #fef2f2; }
.kpi-card--warning { border-top: 3pt solid ${BRAND.warning}; background: #fffbeb; }
.kpi-card__label { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.07em; color: ${BRAND.textFaint}; font-weight: 600; line-height: 1; }
.kpi-card__value { font-size: 16pt; font-weight: 700; color: ${BRAND.textPrimary}; line-height: 1.1; font-variant-numeric: tabular-nums; }
.kpi-card__value--lg { font-size: 20pt; }
.kpi-card__sub { font-size: 7pt; color: ${BRAND.textMuted}; margin-top: 1pt; }
.kpi-card__change { display: flex; align-items: center; gap: 4pt; margin-top: 2pt; }

/* ── Variance pills ──────────────────────────────────── */
.vpill { display: inline-block; padding: 1.5pt 5pt; border-radius: 10pt; font-size: 7pt; font-weight: 700; letter-spacing: 0.03em; }
.vpill--pos { background: #dcfce7; color: #166534; }
.vpill--neg { background: #fee2e2; color: #b91c1c; }
.vpill--na  { background: ${BRAND.bgMid}; color: ${BRAND.textFaint}; }

/* ── Amount coloring ─────────────────────────────────── */
.amount--negative { color: #dc2626; }
.amount--positive { color: #111827; }
.amount--unavailable { color: #9ca3af; }

/* ── Variance coloring ───────────────────────────────── */
.variance--fav     { color: ${BRAND.positive}; font-weight: 600; }
.variance--unfav   { color: ${BRAND.negative}; font-weight: 600; }
.variance--neutral { color: ${BRAND.textMuted}; }
.variance--na      { color: ${BRAND.textFaint}; }

/* ── Badges ──────────────────────────────────────────── */
.badge { display: inline-block; padding: 2pt 7pt; border-radius: 10pt; font-size: 7pt; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; }
.badge--green  { background: #dcfce7; color: #166534; }
.badge--red    { background: #fee2e2; color: #b91c1c; }
.badge--amber  { background: #fef3c7; color: #92400e; }
.badge--blue   { background: #dbeafe; color: #1e40af; }
.badge--purple { background: #ede9fe; color: #6d28d9; }
.badge--gray   { background: #f1f5f9; color: #475569; }
.badge--teal   { background: #ccfbf1; color: #0f766e; }

/* ── Legacy insight blocks ───────────────────────────── */
.insight { display: flex; gap: 10pt; padding: 10pt 12pt; border-radius: 4pt; border-left: 4pt solid; margin-bottom: 8pt; page-break-inside: avoid; }
.insight--positive { background: #f0fdf4; border-color: ${BRAND.positive}; }
.insight--warning  { background: #fffbeb; border-color: ${BRAND.warning}; }
.insight--critical { background: #fef2f2; border-color: ${BRAND.negative}; }
.insight--info     { background: #eff6ff; border-color: ${BRAND.info}; }
.insight--neutral  { background: ${BRAND.bgLight}; border-color: ${BRAND.borderMid}; }
.insight__icon     { font-size: 11pt; flex-shrink: 0; line-height: 1.4; }
.insight__title    { font-weight: 700; font-size: 8.5pt; margin-bottom: 2pt; }
.insight__text     { font-size: 8pt; color: ${BRAND.textSecondary}; line-height: 1.45; }

/* ── Checklist (close status) ────────────────────────── */
.check-row { display: flex; align-items: flex-start; gap: 12pt; padding: 9pt 0; border-bottom: 0.5pt solid #f3f4f6; page-break-inside: avoid; }
.check-icon { width: 12pt; flex-shrink: 0; font-size: 10pt; }
.check-icon--pass { color: #16a34a; }
.check-icon--prog { color: #d97706; }
.check-icon--pend { color: #94a3b8; }
.check-text { flex: 1; font-size: 9.5pt; color: #111827; line-height: 1.45; }
.check-badge { font-size: 7.5pt; font-weight: 600; padding: 2pt 8pt; border-radius: 3pt; white-space: nowrap; }
.check-badge--green { background: #dcfce7; color: #15803d; }
.check-badge--amber { background: #fef3c7; color: #b45309; }
.check-badge--gray { background: #f3f4f6; color: #6b7280; }

/* ── TOC ─────────────────────────────────────────────── */
.toc-entry { display: flex; justify-content: space-between; align-items: baseline; padding: 7pt 0; border-bottom: 0.5pt solid #f3f4f6; font-size: 9.5pt; }
.toc-pg { color: #6b7280; flex-shrink: 0; padding-left: 8pt; }

/* ── Two/three column layouts ────────────────────────── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20pt; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10pt; }
.col-60-40 { display: grid; grid-template-columns: 60% 38%; gap: 2%; }
.col-55-45 { display: grid; grid-template-columns: 55fr 45fr; gap: 12pt; }
.col-40-60 { display: grid; grid-template-columns: 40fr 60fr; gap: 12pt; }

/* ── Divider ─────────────────────────────────────────── */
.divider { border: none; border-top: 1pt solid ${BRAND.borderLight}; margin: 10pt 0; }
.divider--heavy { border-top: 2pt solid ${BRAND.borderMid}; }

/* ── Data footer ─────────────────────────────────────── */
.data-footer { font-size: 6.5pt; color: ${BRAND.textFaint}; text-align: right; padding-top: 6pt; border-top: 0.5pt solid ${BRAND.borderLight}; margin-top: 10pt; letter-spacing: 0.02em; }

/* ── Legend ──────────────────────────────────────────── */
.legend { display: flex; flex-wrap: wrap; gap: 8pt; margin-top: 6pt; }
.legend__item { display: flex; align-items: center; gap: 4pt; font-size: 7pt; color: ${BRAND.textSecondary}; }
.legend__dot  { width: 8pt; height: 8pt; border-radius: 50%; flex-shrink: 0; }
.legend__line { width: 14pt; height: 2pt; border-radius: 1pt; flex-shrink: 0; }

/* ── Aging bar ───────────────────────────────────────── */
.aging-bar { display: flex; height: 8pt; border-radius: 4pt; overflow: hidden; margin: 3pt 0; }
.aging-bar__seg { height: 100%; }

/* ── Section wrapper ─────────────────────────────────── */
.section { margin-bottom: 0; }
.section--break { page-break-before: always; break-before: page; }

/* ── Utility ─────────────────────────────────────────── */
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
.sub-heading { font-size: 12pt; font-weight: 600; color: #111827; margin: 16pt 0 6pt; }
.small-note { font-size: 7.5pt; color: #6b7280; font-style: italic; margin-top: 6pt; line-height: 1.5; }
</style>`;
}

// ─── Component builders (legacy API) ─────────────────────────────────────────

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
  return refPageHeader(opts.logoPath ?? null, opts.entityName, opts.reportTitle, opts.primaryColor);
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
  // Delegate to new reference-style section header
  const numStr = opts.number != null ? String(opts.number).padStart(2, "0") : null;
  const label = opts.subtitle ?? title;
  const heading = opts.subtitle ? title : title;
  return refSectionHeader(numStr, label, heading);
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
  color: string = BRAND.accent,
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

// ─── New reference component builders ────────────────────────────────────────

/** Repeating page header: logo left, report title right, thin rule below. */
export function refPageHeader(
  logoPath: string | null,
  entityName: string,
  reportTitle: string,
  primaryColor?: string,
): string {
  const src = embedLogoPath(logoPath);
  let logoHtml: string;
  if (src) {
    logoHtml = `<div class="page-hdr__logo"><img class="page-hdr__logo-img" src="${src}" alt="${escHtml(entityName)}" /></div>`;
  } else {
    // Initials fallback
    const initials = entityName.slice(0, 2).toUpperCase();
    const bg = primaryColor ?? BRAND.accent;
    logoHtml = `<div class="page-hdr__logo"><span style="display:inline-flex;align-items:center;justify-content:center;width:18pt;height:18pt;border-radius:4pt;background:${escHtml(bg)};color:#fff;font-weight:700;font-size:8pt;font-family:Arial,sans-serif">${escHtml(initials)}</span></div>`;
  }

  return `<div class="page-hdr no-break">
  ${logoHtml}
  <div class="page-hdr__right">${escHtml(reportTitle)}</div>
</div>`;
}

/** Section header: small blue uppercase label + large normal-weight H1 + horizontal rule. */
export function refSectionHeader(
  sectionNum: string | number | null,
  sectionLabel: string,
  title: string,
): string {
  const numPrefix = sectionNum != null ? `${String(sectionNum).padStart(2, "0")} ` : "";
  return `<div class="sec-label no-break">${escHtml(numPrefix + sectionLabel)}</div>
<h1 class="sec-title">${escHtml(title)}</h1>
<hr class="sec-rule" />`;
}

/** Flat inline KPI stat row — no card boxes. */
export function refKpiRow(
  stats: {
    label: string;
    value: string;
    change?: string;
    changeClass?: string;
    sub?: string;
  }[],
): string {
  const items = stats.map((s) => {
    const cls = s.changeClass ? `change--${s.changeClass}` : "change--neu";
    return `<div class="kpi-stat">
  <div class="kpi-stat__label">${escHtml(s.label)}</div>
  <div class="kpi-stat__value">${escHtml(s.value)}</div>
  ${s.change ? `<div class="kpi-stat__change ${cls}">${escHtml(s.change)}</div>` : ""}
  ${s.sub ? `<div class="kpi-stat__change change--neu">${escHtml(s.sub)}</div>` : ""}
</div>`;
  }).join("");
  return `<div class="kpi-row no-break">${items}</div>`;
}

/** Left-border insight callout panel. */
export function refInsightPanel(
  title: string,
  body: string,
  variant: "blue" | "amber" | "green" | "red" | "gray" = "blue",
  badge?: string,
  badgeVariant: "green" | "amber" | "blue" | "gray" = "gray",
): string {
  const variantClass = variant === "blue" ? "" : ` ins-panel--${variant}`;
  const badgeHtml = badge
    ? `<span class="ins-panel__badge ins-panel__badge--${badgeVariant}">${escHtml(badge)}</span>`
    : "";
  return `<div class="ins-panel${variantClass}">
  <div class="ins-panel__header">
    <div class="ins-panel__title">${escHtml(title)}</div>
    ${badgeHtml}
  </div>
  <div class="ins-panel__body">${escHtml(body)}</div>
</div>`;
}

/** Blue-left-border recommendation block. */
export function refRecommendationCallout(label: string, body: string): string {
  return `<div class="rec-callout no-break">
  <div class="rec-callout__label">${escHtml(label)}</div>
  <div class="rec-callout__body">${escHtml(body)}</div>
</div>`;
}

/** Wrap paragraphs in a narrative div. */
export function refNarrative(...paragraphs: string[]): string {
  return `<div class="narrative">${paragraphs.map((p) => `<p>${escHtml(p)}</p>`).join("")}</div>`;
}

/**
 * Render narrative blocks with inline-edit markers for the draft preview.
 * Blocks with commentaryType management_commentary or recommended_action
 * receive data-editable="true" and data-block-id so the iframe editing
 * script can make them click-to-edit. FinanceOS Analysis blocks are locked.
 * In final generation (isPreview=false) all blocks render as plain <p> tags.
 */
export type NarrativeBlockSpec = {
  id:   string | null;
  text: string;
  type: string;
  editable: boolean;
};

export function refNarrativeBlocks(blocks: NarrativeBlockSpec[], isPreview: boolean): string {
  if (blocks.length === 0) return "";
  const items = blocks.map((b) => {
    const p = `<p>${escHtml(b.text)}</p>`;
    if (isPreview && b.editable && b.id) {
      return `<div class="narrative-block" data-editable="true" data-block-id="${escHtml(b.id)}" data-block-type="${escHtml(b.type)}">${p}</div>`;
    }
    return `<div class="narrative-block">${p}</div>`;
  });
  return `<div class="narrative">${items.join("")}</div>`;
}

/** Small italic note paragraph. */
export function refSmallNote(text: string): string {
  return `<p class="note">${escHtml(text)}</p>`;
}

/** Bold sub-heading. */
export function refSubHeading(text: string): string {
  return `<div class="sub-heading">${escHtml(text)}</div>`;
}
